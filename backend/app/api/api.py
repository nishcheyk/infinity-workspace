from fastapi import APIRouter

from app.api.endpoints import auth, ingestion, intelligence, password_reset, profile

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(password_reset.router, prefix="/auth", tags=["auth"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(ingestion.router, prefix="/ingestion", tags=["ingestion"])
api_router.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])
