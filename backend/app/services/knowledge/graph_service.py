import logging
from typing import Any

from app.db.mongodb import mongo_db

logger = logging.getLogger(__name__)

# Global variable for lazy loading
_nlp = None


def get_nlp():
    global _nlp
    if _nlp is None:
        import spacy

        try:
            _nlp = spacy.load("en_core_web_sm")
        except Exception:
            import os
            import sys

            logger.info("Downloading en_core_web_sm...")
            os.system(f"{sys.executable} -m spacy download en_core_web_sm")
            _nlp = spacy.load("en_core_web_sm")
    return _nlp


async def extract_and_store_graph_data(doc_id: str, text: str, user_id: str):
    """
    Extract entities from text and store nodes/edges in MongoDB.
    """
    db = mongo_db.db
    unique_entities = {}

    try:
        nlp = get_nlp()
        doc = nlp(text[:20000])  # Smaller sample for spacy to avoid memory issues

        # Relevant entity types
        target_labels = {"ORG", "PERSON", "GPE", "PRODUCT", "EVENT"}

        for ent in doc.ents:
            if ent.label_ in target_labels and len(ent.text.strip()) > 1:
                key = ent.text.strip().lower()
                if key not in unique_entities:
                    unique_entities[key] = {"text": ent.text.strip(), "label": ent.label_}
    except Exception as e:
        logger.warning(f"Spacy extraction failed, falling back to Groq: {e}")
        import json

        from app.core.config import settings
        from app.services.ai.llm_client import groq_client

        prompt = f"""Extract key people, organizations, and products from the following text fragment.
Return ONLY a JSON array of objects with keys "text" and "label".
Labels must be one of: PERSON, ORG, PRODUCT, GPE.

Text:
{text[:4000]}
"""
        try:
            raw_entities = await groq_client.generate_completion(settings.GROQ_MODEL, prompt)
            # Find JSON block
            if "[" in raw_entities:
                json_str = raw_entities[raw_entities.find("[") : raw_entities.rfind("]") + 1]
                entity_list = json.loads(json_str)
                for ent in entity_list:
                    key = str(ent.get("text", "")).strip().lower()
                    if key and len(key) > 1:
                        unique_entities[key] = {"text": ent.get("text"), "label": ent.get("label", "ORG")}
        except Exception as le:
            logger.error(f"LLM Entity extraction fallback failed: {le}")

    # ... rest of the function remains the same ...
    # Store in MongoDB
    for key, ent in unique_entities.items():
        # Upsert Entity Node
        await db.graph_nodes.update_one(
            {"id": key, "user_id": user_id},
            {"$set": {"id": key, "name": ent["text"], "type": ent["label"], "user_id": user_id}},
            upsert=True,
        )

        # Create Edge (Document -> Entity)
        edge_id = f"{doc_id}_{key}"
        await db.graph_edges.update_one(
            {"id": edge_id, "user_id": user_id},
            {"$set": {"id": edge_id, "source": doc_id, "target": key, "relationship": "mentions", "user_id": user_id}},
            upsert=True,
        )


async def get_graph_data(user_id: str) -> dict[str, Any]:
    """
    Retrieve all nodes and edges for a user's knowledge graph.
    """
    db = mongo_db.db

    # Fetch documents as nodes
    doc_nodes = []
    cursor = db.documents.find({"user_id": user_id, "status": "completed"})
    async for d in cursor:
        doc_nodes.append(
            {
                "id": str(d["_id"]),
                "name": d["filename"],
                "type": "DOCUMENT",
                "val": 15,  # Larger size for documents
            }
        )

    # Fetch entity nodes
    ent_nodes = []
    cursor = db.graph_nodes.find({"user_id": user_id})
    async for n in cursor:
        # Check if node has any edges to avoid orphans
        edge_count = await db.graph_edges.count_documents({"target": n["id"], "user_id": user_id})
        if edge_count > 0:
            ent_nodes.append(
                {
                    "id": n["id"],
                    "name": n["name"],
                    "type": n["type"],
                    "val": 5 + (edge_count * 2),  # Size based on connectivity
                }
            )

    # Fetch edges
    edges = []
    cursor = db.graph_edges.find({"user_id": user_id})
    async for e in cursor:
        edges.append({"source": e["source"], "target": e["target"], "relationship": e.get("relationship", "mentions")})

    return {"nodes": doc_nodes + ent_nodes, "links": edges}


async def get_entity_mentions(user_id: str, entity_name: str) -> list[dict[str, Any]]:
    """
    Search for paragraphs across all documents that mention a specific entity.
    """
    from qdrant_client import models as qmodels

    from app.db.qdrant import qdrant_db

    try:
        results, _ = qdrant_db.client.scroll(
            collection_name="documents",
            scroll_filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(key="user_id", match=qmodels.MatchValue(value=user_id)),
                    qmodels.FieldCondition(key="text", match=qmodels.MatchText(text=entity_name)),
                ]
            ),
            limit=10,
            with_payload=True,
        )

        mentions = []
        for res in results:
            mentions.append(
                {
                    "doc_id": res.payload.get("doc_id"),
                    "filename": res.payload.get("filename"),
                    "text": res.payload.get("text"),
                }
            )
        return mentions
    except Exception as e:
        logger.error(f"Failed to fetch entity mentions: {e}")
        return []
