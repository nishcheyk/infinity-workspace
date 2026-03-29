from qdrant_client import QdrantClient, models
from app.core.config import settings
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class QdrantDB:
    client: Optional[QdrantClient] = None

    def connect(self):
        """Establish connection to Qdrant."""
        if self.client is not None:
            return
        try:
            self.client = QdrantClient(url=settings.QDRANT_URL)
            logger.info(f"Connected to Qdrant at {settings.QDRANT_URL}")
        except Exception as e:
            logger.error(f"Failed to connect to Qdrant: {e}")
            raise

    def ensure_collection(self, collection_name: str, vector_size: int = 384):
        """Ensure collection exists with indexing for hybrid search and isolation."""
        self.connect()
        try:
            collections = self.client.get_collections().collections
            if not any(c.name == collection_name for c in collections):
                self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=models.VectorParams(
                        size=vector_size, distance=models.Distance.COSINE
                    ),
                )
                # Text index for keyword-based search components
                self.client.create_payload_index(
                    collection_name=collection_name,
                    field_name="text",
                    field_schema=models.TextIndexParams(
                        type="text",
                        tokenizer=models.TokenizerType.WORD,
                        min_token_len=2,
                        lowercase=True,
                    ),
                )
                # Keyword index for user-wise isolation
                self.client.create_payload_index(
                    collection_name=collection_name,
                    field_name="user_id",
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )
                logger.info(f"Initialized collection: {collection_name}")
        except Exception as e:
            logger.error(f"Error checking/creating collection {collection_name}: {e}")

    def search(
        self,
        collection_name: str,
        vector: List[float],
        user_id: str,
        limit: int = 5,
        score_threshold: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """Perform vector search with user-wise isolation."""
        self.connect()
        try:
            results = self.client.search(
                collection_name=collection_name,
                query_vector=vector,
                query_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="user_id", match=models.MatchValue(value=user_id)
                        )
                    ]
                ),
                limit=limit,
                score_threshold=score_threshold,
                with_payload=True,
            )
            return [
                {
                    "content": hit.payload.get("text", ""),
                    "metadata": {k: v for k, v in hit.payload.items() if k != "text"},
                    "score": hit.score,
                }
                for hit in results
            ]
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []


qdrant_db = QdrantDB()
