from typing import List, Union

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Doc Platform"
    API_V1_STR: str = "/api/v1"

    # CORS
    BACKEND_CORS_ORIGINS: Union[List[AnyHttpUrl], str] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            # Support both JSON-like "['a','b']" and comma-separated "a,b"
            if v.startswith("["):
                import json
                try:
                    return json.loads(v.replace("'", '"'))  # Handle simple single-quote json
                except json.JSONDecodeError:
                    pass
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        raise ValueError(v)

    # Database
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "doc_intelligence"
    QDRANT_URL: str = "http://localhost:6333"


    # AI
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    UNSTRUCTURED_URL: str = "http://localhost:8000"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    
    # Groq Cloud API
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    # Security
    SECRET_KEY: str = "CHANGE_THIS_TO_A_SECURE_SECRET_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    MAX_CONTENT_LENGTH: int = 10 * 1024 * 1024  # 10 MB

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore"
    )


settings = Settings()
