import logging

from bson import ObjectId

from app.core.config import settings
from app.db.mongodb import mongo_db
from app.services.ai.llm_client import groq_client

logger = logging.getLogger(__name__)


class SynthesisService:
    async def synthesize_documents(self, doc_ids: list[str], user_id: str, topic: str = "comprehensive summary"):
        """
        Multi-agent synthesis pipeline:
        1. Researcher Agent: Analyzes each document for key facts related to the topic.
        2. Writer Agent: Synthesizes facts into a professional report.
        """
        db = mongo_db.db

        # 1. Researcher Phase
        research_notes = []
        for doc_id in doc_ids:
            doc = await db.documents.find_one({"_id": ObjectId(doc_id), "user_id": user_id})
            if not doc:
                continue

            # Robust Research: Fetch multiple chunks from Qdrant for full context
            from qdrant_client import models as qmodels

            from app.db.qdrant import qdrant_db

            try:
                points, _ = qdrant_db.client.scroll(
                    collection_name="documents",
                    scroll_filter=qmodels.Filter(
                        must=[qmodels.FieldCondition(key="doc_id", match=qmodels.MatchValue(value=doc_id))]
                    ),
                    limit=10,  # Fetch up to 10 key segments
                    with_payload=True,
                )
                if points:
                    content_to_analyze = "\n[--SEGMENT--]\n".join([p.payload.get("text", "") for p in points])
                else:
                    content_to_analyze = doc.get("summary", "") or doc.get("filename", "")
            except Exception:
                content_to_analyze = doc.get("summary", "") or doc.get("filename", "")

            research_prompt = f"""[Researcher Agent]
            Analyze the following document fragments focused on: {topic}
            Extract key facts, statistics, and critical insights.

            Document: {doc['filename']}
            Content Fragments:
            {content_to_analyze[:10000]}

            Research Notes:"""

            try:
                notes = await groq_client.generate_completion(settings.GROQ_MODEL, research_prompt)
                research_notes.append(f"FROM {doc['filename']}:\n{notes}")
            except Exception as e:
                logger.error(f"Researcher agent failed for {doc_id}: {e}")

        if not research_notes:
            return "No data found to synthesize."

        # 2. Writer Phase
        all_notes = "\n\n---\n\n".join(research_notes)
        writer_prompt = f"""[Writer Agent]
        You are a professional Senior Analyst.
        Synthesize the following research notes into a high-fidelity, sophisticated report about: {topic}

        Format the report with:
        # Executive Summary
        ## Key Findings
        ## Detailed Synthesis
        ## Strategic Conclusion

        Research Notes:
        {all_notes}

        Final Professional Report:"""

        try:
            report = await groq_client.generate_completion(settings.GROQ_MODEL, writer_prompt)
            return report
        except Exception as e:
            logger.error(f"Writer agent failed: {e}")
            return "Synthesis failed during the writing phase."


synthesis_service = SynthesisService()
