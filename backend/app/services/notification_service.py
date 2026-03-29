import json
import logging

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = await redis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def publish_status(self, user_id: str, doc_id: str, status: str, filename: str = None, progress: int = 0, error: str = None):
        """
        Publish a document status update to the user's notification channel.
        """
        try:
            r = await self._get_redis()
            channel = f"user_{user_id}_sync"
            message = {
                "type": "doc_status", 
                "doc_id": doc_id, 
                "status": status, 
                "filename": filename,
                "progress": progress,
                "error": error
            }
            await r.publish(channel, json.dumps(message))
            logger.info(f"Published status '{status}' ({progress}%) for doc {doc_id} to channel {channel}")
        except Exception as e:
            logger.error(f"Failed to publish status update: {e}")

    async def subscribe_to_user_updates(self, user_id: str):
        """
        Generator that yields messages from the user's notification channel.
        """
        r = await self._get_redis()
        pubsub = r.pubsub()
        channel = f"user_{user_id}_sync"
        await pubsub.subscribe(channel)

        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield message["data"]
        finally:
            await pubsub.unsubscribe(channel)


notification_service = NotificationService()
