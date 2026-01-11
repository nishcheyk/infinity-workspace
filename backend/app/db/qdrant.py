from qdrant_client import QdrantClient

from app.core.config import settings


class QdrantDB:
    client: QdrantClient = None

    def connect(self):
        # QdrantClient handles connection pooling internally usually,
        # but here we initialize it.
        # For Async, we might need AsyncQdrantClient, but standard client is often used for operations.
        # Let's use the standard synchronous client for simplicity in vector searches first,
        # or check if we need async. Qdrant 1.7+ supports async.
        # We will use the synchronous client wrapped or AsyncQdrantClient if preferred.
        # For now, standard client is safer for broad compatibility.
        self.client = QdrantClient(url=settings.QDRANT_URL)
        print(f"Connected to Qdrant at {settings.QDRANT_URL}")


qdrant_db = QdrantDB()
