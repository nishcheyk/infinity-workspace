from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings


class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

    def connect(self):
        self.client = AsyncIOMotorClient(settings.MONGODB_URL)
        self.db = self.client[settings.DATABASE_NAME]
        print("Connected to MongoDB")

    def close(self):
        if self.client:
            self.client.close()
            print("Closed MongoDB connection")


mongo_db = MongoDB()


async def get_db():
    return mongo_db.db
