import os
import shutil
import tempfile
from datetime import datetime

from fastapi import UploadFile

from app.core.config import settings

# Ensure temp directory exists
UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "ai_doc_uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_timestamp():
    return datetime.utcnow()


async def save_upload_file(upload_file: UploadFile, doc_id: str) -> str:
    destination = os.path.join(UPLOAD_DIR, f"{doc_id}_{upload_file.filename}")
    with open(destination, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    return destination


# Global model instance
_embedding_model = None


def get_embedding_model():
    """Get the sentence transformer model for embeddings with CPU fallback"""
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            model_name = settings.EMBEDDING_MODEL or "all-MiniLM-L6-v2"
            
            # Try GPU first, fallback to CPU on Windows DLL errors
            try:
                _embedding_model = SentenceTransformer(model_name)
            except Exception as gpu_error:
                print(f"GPU initialization failed, using CPU: {gpu_error}")
                import torch
                _embedding_model = SentenceTransformer(model_name, device='cpu')
                
        except Exception as e:
            print(f"ERROR: Failed to initialize embedding model: {e}")
            raise
    return _embedding_model
