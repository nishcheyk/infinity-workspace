"""User profile management endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from app.api import deps
from app.db.mongodb import get_db
from app.models.user import UserResponse

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user: UserResponse = Depends(deps.get_current_user)):
    """Get current user profile."""
    return current_user


@router.put("/profile")
async def update_profile(
    request: UpdateProfileRequest,
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update user profile."""

    update_data = {}
    if request.full_name:
        update_data["full_name"] = request.full_name

    if request.email:
        # Check if email is already taken
        existing_user = await db.users.find_one({"email": request.email})
        if existing_user and str(existing_user["_id"]) != str(current_user.id):
            raise HTTPException(status_code=400, detail="Email already registered")
        update_data["email"] = request.email
        update_data["email_verified"] = False  # Require re-verification

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.users.update_one({"_id": current_user.id}, {"$set": update_data})

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "Profile updated successfully"}


@router.put("/profile/password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Change user password."""

    # Get user with password
    user = await db.users.find_one({"_id": current_user.id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify current password
    if not pwd_context.verify(request.current_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    # Hash and update new password
    hashed_password = pwd_context.hash(request.new_password)
    await db.users.update_one({"_id": current_user.id}, {"$set": {"hashed_password": hashed_password}})

    return {"message": "Password changed successfully"}


@router.post("/profile/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(deps.get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Upload user avatar."""
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read file
    contents = await file.read()

    # Store in database (or cloud storage in production)
    await db.users.update_one({"_id": current_user.id}, {"$set": {"avatar": contents}})

    return {"message": "Avatar uploaded successfully"}


@router.get("/profile/avatar")
async def get_avatar(
    current_user: UserResponse = Depends(deps.get_current_user), db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get user avatar."""
    user = await db.users.find_one({"_id": current_user.id})

    if not user or "avatar" not in user:
        raise HTTPException(status_code=404, detail="Avatar not found")

    from fastapi.responses import Response

    return Response(content=user["avatar"], media_type="image/jpeg")
