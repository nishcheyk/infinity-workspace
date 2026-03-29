import asyncio
import logging
from collections.abc import AsyncGenerator
from datetime import datetime

from app.core.config import settings
from app.db.qdrant import qdrant_db
from app.services.ai.llm_client import groq_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from bson import ObjectId

from app.db.mongodb import mongo_db

# Removed in-memory chat_sessions as we now use MongoDB persistence


async def retrieve_context(query: str, user_id: str, limit: int = 4) -> list[dict]:
    """Hybrid search: semantic (vector) + lexical (keyword)."""
    # Try to get embedding model, fallback to keyword-only search
    model = None
    has_model = False
    
    try:
        from sentence_transformers import SentenceTransformer
        from qdrant_client import models as qmodels
        
        # Force CPU to avoid DLL errors on Windows
        model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
        has_model = True
        print("✅ Embedding model initialized successfully on CPU")
    except Exception as e:
        print(f"⚠️ Embedding model failed, using keyword-only search: {e}")
        from qdrant_client import models as qmodels
        has_model = False

    vector_hits = []
    
    # 1. Vector Search (Semantic) - only if model loaded
    if has_model and model:
        try:
            query_vector = await asyncio.to_thread(model.encode, query)
            query_vector = query_vector.tolist()
            
            vector_hits = qdrant_db.client.search(
                collection_name="documents",
                query_vector=query_vector,
                query_filter=qmodels.Filter(
                    must=[qmodels.FieldCondition(key="user_id", match=qmodels.MatchValue(value=user_id))]
                ),
                limit=limit,
            )
            print(f"🔍 Vector search returned {len(vector_hits)} hits")
        except Exception as e:
            print(f"⚠️ Qdrant vector search failed: {e}")

    # 2. Keyword Search (Lexical using Qdrant Full-Text Index)
    keyword_hits = []
    try:
        # Use 'scroll' with MatchText filter for keyword search
        scroll_result, _ = qdrant_db.client.scroll(
            collection_name="documents",
            scroll_filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(key="user_id", match=qmodels.MatchValue(value=user_id)),
                    qmodels.FieldCondition(key="text", match=qmodels.MatchText(text=query)),
                ]
            ),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
        keyword_hits = scroll_result
        print(f"🔍 Keyword search returned {len(keyword_hits)} hits for query: '{query}'")
    except Exception as e:
        print(f"⚠️ Qdrant keyword search failed: {e}")
    
    # Debug: Log search results
    print(f"📊 Vector search: {len(vector_hits)} hits, Keyword search: {len(keyword_hits)} hits for user {user_id}")
    if len(vector_hits) == 0 and len(keyword_hits) == 0:
        # Try to see what's actually in the collection
        try:
            all_docs, _ = qdrant_db.client.scroll(
                collection_name="documents",
                scroll_filter=qmodels.Filter(
                    must=[qmodels.FieldCondition(key="user_id", match=qmodels.MatchValue(value=user_id))]
                ),
                limit=5,
                with_payload=True,
            )
            print(f"📚 Total documents for user {user_id}: {len(all_docs)}")
            if all_docs:
                print(f"📄 Sample doc: {all_docs[0].payload.get('text', '')[:100]}...")
        except Exception as e:
            print(f"⚠️ Debug query failed: {e}")

    # 3. Merge and Deduplicate
    results = []
    seen_texts = set()

    # Process Vector Hits
    for hit in vector_hits:
        text = hit.payload.get("text", "")
        if text not in seen_texts:
            results.append(
                {
                    "text": text,
                    "metadata": {
                        "doc_id": hit.payload.get("doc_id"),
                        "filename": hit.payload.get("filename", "Unknown Document"),
                        "score": hit.score,
                        "type": "semantic",
                    },
                }
            )
            seen_texts.add(text)

    # Process Keyword Hits
    for hit in keyword_hits:
        text = hit.payload.get("text", "")
        if text not in seen_texts:
            results.append(
                {
                    "text": text,
                    "metadata": {
                        "doc_id": hit.payload.get("doc_id"),
                        "filename": hit.payload.get("filename", "Unknown Document"),
                        # Scroll doesn't give a relevant "keyword score", so we use a baseline if needed
                        "score": 0.5,
                        "type": "keyword",
                    },
                }
            )
            seen_texts.add(text)

    return results[:limit]


def build_prompt(query: str, context_chunks: list[dict], history: list[dict[str, str]] = None) -> str:
    # Format History
    history_text = ""
    if history:
        history_text = "\n".join([f"{m['role'].capitalize()}: {m['content']}" for m in history[-8:]])  # Last 8 turns

    if not context_chunks:
        return f"""You are 'Infinity', a highly advanced and elegant AI intelligence.
Your tone is sophisticated, direct, and slightly futuristic.
You are currently helping a user within their private intelligent workspace.

The user's query did not match any specific knowledge base documents.
Answer conversationally and with high-level intellect, using the provided history as your only context.
Avoid saying "I don't know" if the history allows for a meaningful logical inference.

Conversation History:
{history_text}

Query: {query}
Infinity:"""

    context_text = "\n\n".join([f"[Document: {c['metadata']['filename']}]: {c['text']}" for c in context_chunks])

    prompt = f"""You are 'Infinity', the premier AI intelligence of this private workspace.
    Your primary directive is to provide elegant, precise, and highly intelligent insights using the provided Context and Conversation History.

    Operational Guidelines:
    1. FLUIDITY & INTELLIGENCE: Speak like a human expert. Integrate facts seamlessly.
    2. COMPARISON MODE: If asked to compare documents, explicitly highlight differences and similarities.
    3. VISUAL INTELLIGENCE: If the user asks for a chart, trend, or comparison of numerical data, you MUST provide a chart using the following format:
       ```chart
       {{
         "type": "bar" | "line" | "pie",
         "title": "Descriptive Chart Title",
         "data": [
           {{"name": "Label 1", "value": 123}},
           {{"name": "Label 2", "value": 456}}
         ]
       }}
       ```
       Always follow the chart block with a detailed textual analysis.
    4. WEB INTELLIGENCE: If context is marked as [Web Search], treat it as real-time external data.
    5. CITATION ETIQUETTE: Mention document names ONLY if it adds necessary weight or for comparisons.

    Contextual Data:
    {context_text}

    Conversation History:
    {history_text}

    User Query: {query}
    Infinity:"""
    return prompt


async def chat_stream(query: str, user_id: str, session_id: str = None) -> AsyncGenerator[str, None]:
    db = mongo_db.db

    # 1. Load History from MongoDB
    history = []
    if session_id:
        cursor = db.chat_messages.find({"session_id": session_id}).sort("timestamp", 1).limit(20)
        async for msg in cursor:
            history.append({"role": msg["role"], "content": msg["content"]})

    # 2. Retrieve Context
    context = await retrieve_context(query, user_id)
    valid_context = [c for c in context if c["metadata"].get("score", 1.0) > 0.15]

    # INTERACTIVE FALLBACK: Ask before web search
    is_confirmation = False
    original_query = query

    if history and len(history) >= 2:
        last_assistant = history[-1]["content"]
        last_user = history[-2]["content"]
        if "Should I search the web for you?" in last_assistant:
            # Check if user is saying yes
            confirmation_words = ["yes", "yeah", "sure", "ok", "please", "do it", "search", "yep"]
            if any(word in query.lower() for word in confirmation_words):
                is_confirmation = True
                original_query = last_user
                logger.info(f"Confirmed web search for: {original_query}")

    if not valid_context and not is_confirmation and len(query) > 5:
        # Ask permission instead of searching directly
        msg = f"I couldn't find any information about '{query}' in your workspace documents. Should I search the web for you?"

        # Save placeholder for history consistency
        if session_id:
            await db.chat_messages.insert_one(
                {
                    "session_id": session_id,
                    "user_id": user_id,
                    "role": "user",
                    "content": query,
                    "timestamp": datetime.utcnow(),
                }
            )
            await db.chat_messages.insert_one(
                {
                    "session_id": session_id,
                    "user_id": user_id,
                    "role": "assistant",
                    "content": msg,
                    "timestamp": datetime.utcnow(),
                }
            )

        yield msg
        return

    # Perform Web Search if confirmed
    if is_confirmation:
        from app.services.document.search_service import web_search

        web_results = await web_search(original_query)
        if web_results:
            for res in web_results:
                valid_context.append(
                    {
                        "text": res["snippet"],
                        "metadata": {"filename": res["title"], "link": res["link"], "type": "web_search", "score": 1.0},
                    }
                )
        # If we are confirming, we re-run the prompt for the ORIGINAL query with web context
        query = original_query

    prompt = build_prompt(query, valid_context, history)

    # 4. Stream Response & Metadata
    if valid_context:
        sources_meta = [c["metadata"] for c in valid_context]
        import json

        yield f"__METADATA__:{json.dumps(sources_meta)}\n"

    logger.info(
        f"[{datetime.utcnow().isoformat()}] User: {user_id} | Session: {session_id} | Prompting LLM. History: {len(history)} | Web: {is_confirmation}"
    )

    full_response = []

    try:
        # Save User Message (if not already saved by the placeholder logic)
        if not is_confirmation:
            user_msg = {
                "session_id": session_id,
                "user_id": user_id,
                "role": "user",
                "content": query,
                "timestamp": datetime.utcnow(),
            }
            if session_id:
                await db.chat_messages.insert_one(user_msg)

        async for token in groq_client.generate_stream(settings.GROQ_MODEL, prompt):
            full_response.append(token)
            yield token

        # 5. Save Assistant Message
        response_text = "".join(full_response)
        assistant_msg = {
            "session_id": session_id,
            "user_id": user_id,
            "role": "assistant",
            "content": response_text,
            "timestamp": datetime.utcnow(),
        }
        if session_id:
            await db.chat_messages.insert_one(assistant_msg)

            # Auto-title generation for first message
            if len(history) == 0:
                title_prompt = f"Summarize this user question into a 3-5 word title: {query}"
                try:
                    title = await groq_client.generate_completion(settings.GROQ_MODEL, title_prompt)
                    title = title.strip().strip('"').strip("'")
                    await db.chat_sessions.update_one({"_id": ObjectId(session_id)}, {"$set": {"title": title}})
                except Exception:
                    pass

    except Exception as e:
        logger.error(f"LLM Error during stream: {e}")
        yield f"\n[System Error: {e}]"
