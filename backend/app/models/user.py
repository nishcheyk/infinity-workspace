from datetime import datetime
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field


from typing import Annotated, Any
from pydantic import BaseModel, EmailStr, Field, BeforeValidator, ConfigDict

# Helper to automatically convert ObjectId to string
PyObjectId = Annotated[str, BeforeValidator(str)]

class MongoBaseModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        # In V2, strict checking might still fail if we don't convert first
    )


class UserBase(MongoBaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserInDB(UserBase):
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserResponse(UserBase):
    id: Optional[PyObjectId] = Field(None, alias="_id")


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RefreshToken(BaseModel):
    refresh_token: str
