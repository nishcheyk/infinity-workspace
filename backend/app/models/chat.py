from datetime import datetime
from typing import Optional, List, Annotated
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict
from bson import ObjectId

# Helper to automatically convert ObjectId to string
PyObjectId = Annotated[str, BeforeValidator(str)]

class MongoBaseModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

class ChatMessage(MongoBaseModel):
    id: Optional[PyObjectId] = Field(None, alias="_id")
    session_id: str
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatSession(MongoBaseModel):
    id: Optional[PyObjectId] = Field(None, alias="_id")
    user_id: str
    title: str = "New Chat"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def model_dump(self, **kwargs):
        d = super().model_dump(**kwargs)
        if "_id" in d and d["_id"]:
            d["id"] = str(d["_id"])
        return d

class ChatSessionResponse(ChatSession):
    pass

class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessage]
