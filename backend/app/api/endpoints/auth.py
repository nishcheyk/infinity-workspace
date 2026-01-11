from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api import deps
from app.core import security
from app.core.config import settings
from app.db.mongodb import get_db
from app.models.user import Token, UserCreate, UserInDB, UserResponse, RefreshToken

router = APIRouter()


@router.post("/signup", response_model=UserResponse)
async def create_user(
    user_in: UserCreate, db: AsyncIOMotorDatabase = Depends(get_db)
) -> Any:
    """
    Create new user.
    """
    user = await db.users.find_one({"email": user_in.email})
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )

    user_data = user_in.model_dump()
    password = user_data.pop("password")
    hashed_password = security.get_password_hash(password)

    db_user = UserInDB(**user_data, hashed_password=hashed_password)

    result = await db.users.insert_one(
        db_user.model_dump(by_alias=True, exclude={"id"})
    )

    # Fetch the created user
    created_user = await db.users.find_one({"_id": result.inserted_id})
    return UserResponse(**created_user)


@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncIOMotorDatabase = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = await db.users.find_one({"email": form_data.username})
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if not security.verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=str(user["_id"]), expires_delta=access_token_expires
    )
    refresh_token = security.create_refresh_token(subject=str(user["_id"]))
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=Token)
async def refresh_token(
    body: RefreshToken,
) -> Any:
    """
    Renew access token using a refresh token
    """
    from jose import jwt, JWTError
    try:
        payload = jwt.decode(
            body.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Invalid token type")
        
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid token payload")
            
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = security.create_access_token(
            subject=user_id, expires_delta=access_token_expires
        )
        # We also issue a new refresh token (token rotation)
        new_refresh_token = security.create_refresh_token(subject=user_id)
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: UserResponse = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user
