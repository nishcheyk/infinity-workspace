"""Password reset and email verification endpoints."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.db.mongodb import get_db
from app.services.email import send_password_reset_email, send_verification_email

router = APIRouter()


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    token: str


def create_reset_token(email: str) -> str:
    """Create a password reset token that expires in 1 hour."""
    expires = datetime.utcnow() + timedelta(hours=1)
    to_encode = {"sub": email, "exp": expires, "type": "password_reset"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_verification_token(email: str) -> str:
    """Create an email verification token that expires in 24 hours."""
    expires = datetime.utcnow() + timedelta(hours=24)
    to_encode = {"sub": email, "exp": expires, "type": "email_verification"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str, token_type: str) -> str:
    """Verify a token and return the email."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        typ: str = payload.get("type")

        if email is None or typ != token_type:
            raise HTTPException(status_code=400, detail="Invalid token")

        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=400, detail="Invalid token")


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Send password reset email."""

    # Check if user exists
    user = await db.users.find_one({"email": request.email})

    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If the email exists, a password reset link has been sent"}

    # Create reset token
    reset_token = create_reset_token(request.email)

    # Store token in database with expiration
    await db.password_resets.update_one(
        {"email": request.email},
        {
            "$set": {
                "token": reset_token,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(hours=1),
            }
        },
        upsert=True,
    )

    # Send email
    send_password_reset_email(request.email, reset_token)

    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Reset password using token."""
    # Verify token
    email = verify_token(request.token, "password_reset")

    # Check if token exists and is not expired
    reset_record = await db.password_resets.find_one(
        {"email": email, "token": request.token, "expires_at": {"$gt": datetime.utcnow()}}
    )

    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # Hash new password
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(request.new_password)

    # Update user password
    result = await db.users.update_one({"email": email}, {"$set": {"hashed_password": hashed_password}})

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete used token
    await db.password_resets.delete_one({"email": email})

    return {"message": "Password reset successfully"}


@router.post("/send-verification")
async def send_verification(request: ForgotPasswordRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Resend email verification."""

    user = await db.users.find_one({"email": request.email})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("email_verified"):
        return {"message": "Email already verified"}

    # Create verification token
    verification_token = create_verification_token(request.email)

    # Store token
    await db.email_verifications.update_one(
        {"email": request.email},
        {
            "$set": {
                "token": verification_token,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(hours=24),
            }
        },
        upsert=True,
    )

    # Send email
    send_verification_email(request.email, verification_token)

    return {"message": "Verification email sent"}


@router.post("/verify-email")
async def verify_email(request: VerifyEmailRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Verify email using token."""
    # Verify token
    email = verify_token(request.token, "email_verification")

    # Check if token exists and is not expired
    verification_record = await db.email_verifications.find_one(
        {"email": email, "token": request.token, "expires_at": {"$gt": datetime.utcnow()}}
    )

    if not verification_record:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # Update user email_verified status
    result = await db.users.update_one({"email": email}, {"$set": {"email_verified": True}})

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete used token
    await db.email_verifications.delete_one({"email": email})

    return {"message": "Email verified successfully"}
