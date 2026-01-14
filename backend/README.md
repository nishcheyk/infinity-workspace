# Infinity Intelligence: Backend

FastAPI-powered RAG engine for the Infinity Intelligence platform.

## Local Development (Native)

### 1. Prerequisites
- Python 3.10+
- MongoDB & Qdrant (Required)

### 2. Setup
1.  **Initialize Virtual Environment**:
    ```bash
    python -m venv venv
    .\venv\Scripts\activate  # Windows
    # source venv/bin/activate # Linux/macOS
    ```
2.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
3.  **Environment Configuration**:
    Copy `.env.example` to `.env` and fill in:
    - `GROQ_API_KEY`: Your Groq Cloud API key.
    - `MONGODB_URL`: Connection string for MongoDB.
    - `QDRANT_URL`: URL for Qdrant vector store.

### 3. Run Server
```bash
uvicorn app.main:app --reload --port 8000
```

## API Documentation
Once running, you can access the interactive API docs at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
