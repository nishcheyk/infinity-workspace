from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.mongodb import mongo_db
from app.db.qdrant import qdrant_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    mongo_db.connect()
    qdrant_db.connect()
    yield
    mongo_db.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://localhost:8000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

from app.api.api import api_router
from app.api.endpoints import chats, tts, websockets

app.include_router(api_router, prefix="/api/v1")
app.include_router(chats.router, prefix="/api/v1/chats", tags=["chats"])
app.include_router(tts.router, prefix="/api/v1/tts", tags=["tts"])
app.add_api_websocket_route("/ws", websockets.websocket_endpoint)


@app.get("/")
async def root():
    return {"message": "AI Document Intelligence Platform API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}
