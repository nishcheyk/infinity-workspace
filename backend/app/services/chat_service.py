import asyncio
import time
from datetime import datetime
import logging
from typing import AsyncGenerator, Dict, List

from qdrant_client.models import FieldCondition, Filter, MatchValue

from app.db.qdrant import qdrant_db
from app.services.ingestion_service import get_embedding_model
from app.services.llm_client import groq_client
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from bson import ObjectId
from app.db.mongodb import mongo_db

# Removed in-memory chat_sessions as we now use MongoDB persistence

async def retrieve_context(query: str, user_id: str, limit: int = 4) -> List[Dict]:
    model = get_embedding_model()
    # Run blocking encode in thread pool
    query_vector = await asyncio.to_thread(model.encode, query)
    query_vector = query_vector.tolist()

    try:
        hits = qdrant_db.client.search(
            collection_name="documents",
            query_vector=query_vector,
            query_filter=Filter(
                must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))]
            ),
            limit=limit,
        )
    except Exception as e:
        logger.warning(f"Qdrant search failed: {e}")
        return []

    results = []
    logger.info(f"Query: '{query}' for User: {user_id}")
    
    db = mongo_db.db
    
    for hit in hits:
        doc_id = hit.payload.get("doc_id")
        filename = hit.payload.get("filename")
        
        # Fallback for legacy documents (fetch filename from MongoDB)
        if not filename and doc_id:
            try:
                doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
                if doc:
                    filename = doc.get("filename")
            except Exception:
                pass
        
        filename = filename or "Unknown Document"
        
        logger.info(f" - Hit: {filename} (Score: {hit.score:.4f}): {hit.payload.get('text', '')[:50]}...")
        results.append(
            {
                "text": hit.payload.get("text", ""),
                "metadata": {
                    "doc_id": doc_id, 
                    "filename": filename,
                    "score": hit.score
                },
            }
        )
    return results


def build_prompt(query: str, context_chunks: List[Dict], history: List[Dict[str, str]] = None) -> str:
    # Format History
    history_text = ""
    if history:
        history_text = "\n".join([f"{m['role'].capitalize()}: {m['content']}" for m in history[-8:]]) # Last 8 turns

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

    context_text = "\n\n".join(
        [f"[Document: {c['metadata']['filename']}]: {c['text']}" for c in context_chunks]
    )

    prompt = f"""You are 'Infinity', a premier AI intelligence integrated into this private workspace.
Your primary directive is to provide elegant, precise, and highly intelligent insights based on the user's uploaded knowledge and conversation history.

Guidelines:
1. FLUIDITY OVER FORMALITY: Speak like a human expert, not a search engine. Integrate document facts seamlessly into your narrative without always roboticly citing "According to...".
2. SEAMLESS KNOWLEDGE: Use the provided Context to construct your reality. If the information is there, state it as a fact. 
3. CITATION ETIQUETTE: Mention document names ONLY if it adds necessary weight to an answer, or if you are comparing information from multiple sources.
4. CONTEXTUAL MEMORY: Heavily rely on the Conversation History to maintain the "flow" of deep thought.
5. NO REPETITION: Do not repeat phrases like "Based on the information provided" or "I can answer based on history". Just speak.

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
    # Be more lenient with score to show sources if any exist
    valid_context = [c for c in context if c["metadata"]["score"] > 0.20]

    # 3. Build Prompt with History
    prompt = build_prompt(query, valid_context, history)

    # 4. Stream Response
    logger.info(f"[{datetime.utcnow().isoformat()}] User: {user_id} | Session: {session_id} | Prompting LLM. History: {len(history)}")
    
    full_response = []

    try:
        # Save User Message
        user_msg = {
            "session_id": session_id,
            "user_id": user_id,
            "role": "user",
            "content": query,
            "timestamp": datetime.utcnow()
        }
        if session_id:
            await db.chat_messages.insert_one(user_msg)
            # Update session last activity
            await db.chat_sessions.update_one(
                {"_id": ObjectId(session_id)},
                {"$set": {"updated_at": datetime.utcnow()}}
            )

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
            "timestamp": datetime.utcnow()
        }
        if session_id:
            await db.chat_messages.insert_one(assistant_msg)
            
            # Auto-title generation for first message
            if len(history) == 0:
                title_prompt = f"Summarize this user question into a 3-5 word title: {query}"
                try:
                    title = await groq_client.generate_completion(settings.GROQ_MODEL, title_prompt)
                    title = title.strip().strip('"').strip("'")
                    await db.chat_sessions.update_one(
                        {"_id": ObjectId(session_id)},
                        {"$set": {"title": title}}
                    )
                except Exception:
                    pass

    except Exception as e:
        logger.error(f"LLM Error during stream: {e}")
        yield f"\n[System Error: {e}]"
