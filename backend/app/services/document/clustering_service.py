import logging

import numpy as np
from bson import ObjectId
from sklearn.cluster import KMeans

from app.core.config import settings
from app.db.mongodb import mongo_db
from app.db.qdrant import qdrant_db
from app.services.ai.llm_client import groq_client

logger = logging.getLogger(__name__)


class ClusteringService:
    async def cluster_user_documents(self, user_id: str):
        """
        Organize documents into semantic clusters:
        1. Fetch all document embeddings from Qdrant.
        2. Run K-Means clustering.
        3. Use LLM to name each cluster.
        """
        db = mongo_db.db

        # 1. Fetch all documents for the user
        docs_cursor = db.documents.find({"user_id": user_id, "status": "completed"})
        docs = await docs_cursor.to_list(length=100)

        if len(docs) < 3:
            return {"clusters": [{"name": "All Documents", "doc_ids": [str(d["_id"]) for d in docs]}]}

        doc_ids = [str(d["_id"]) for d in docs]

        embeddings = []
        final_doc_ids = []

        for d_id in doc_ids:
            try:
                # Robust Representation: Fetch up to 10 chunks to get a thematic average
                from qdrant_client import models as qmodels

                points, _ = qdrant_db.client.scroll(
                    collection_name="documents",
                    scroll_filter=qmodels.Filter(
                        must=[qmodels.FieldCondition(key="doc_id", match=qmodels.MatchValue(value=d_id))]
                    ),
                    limit=10,
                    with_vectors=True,
                )

                if points:
                    vectors = [p.vector for p in points if p.vector is not None]
                    if vectors:
                        avg_vector = np.mean(vectors, axis=0)
                        embeddings.append(avg_vector)
                        final_doc_ids.append(d_id)
            except Exception as e:
                logger.warning(f"Failed to fetch embedding for doc {d_id}: {e}")

        if not embeddings:
            return {"clusters": []}

        # 3. K-Means
        num_clusters = min(len(embeddings), 5)  # Max 5 clusters for now
        kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=10)
        clusters_labels = kmeans.fit_predict(np.array(embeddings))

        # 4. Group IDs and Name Clusters via LLM
        groups = {}
        for idx, label in enumerate(clusters_labels):
            if label not in groups:
                groups[label] = []
            groups[label].append(final_doc_ids[idx])

        final_clusters = []
        for label, ids in groups.items():
            # Get filenames for LLM naming
            sample_docs = await db.documents.find({"_id": {"$in": [ObjectId(i) for i in ids[:5]]}}).to_list(length=5)
            filenames = ", ".join([d["filename"] for d in sample_docs])

            naming_prompt = f"Given these document filenames: {filenames}\nProvide a short, 2-3 word professional category name for this group.\nName:"
            try:
                cluster_name = await groq_client.generate_completion(settings.GROQ_MODEL, naming_prompt)
                cluster_name = cluster_name.strip().strip('"')
            except Exception:
                cluster_name = f"Cluster {label + 1}"

            final_clusters.append({"name": cluster_name, "doc_ids": ids})

        return {"clusters": final_clusters}


clustering_service = ClusteringService()
