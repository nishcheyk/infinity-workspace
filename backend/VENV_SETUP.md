# AI Document Platform - Virtual Environment Setup

## Quick Start

### 1. Create Virtual Environment (One-time setup)
```bash
cd backend
python -m venv venv
```

### 2. Activate Virtual Environment
**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
playwright install chromium
```

### 4. Start All Services
```bash
# Option A: Use the automated script
start_local_venv.bat

# Option B: Manual start
# Terminal 1: Databases
docker-compose up -d mongo redis qdrant ollama unstructured

# Terminal 2: Backend API
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3: Celery Scraping Worker
python -m celery -A app.celery_app worker -Q scraping --loglevel=info --concurrency=2

# Terminal 4: Celery Default Worker  
python -m celery -A app.celery_app worker -Q default --loglevel=info --concurrency=2

# Terminal 5: Frontend
cd ../frontend
npm run dev
```

## Benefits of Virtual Environment

✅ **Isolated Dependencies** - No conflicts with system Python
✅ **E: Drive Storage** - All packages installed in `backend/venv/`
✅ **Easy Cleanup** - Just delete `venv/` folder
✅ **Reproducible** - Same environment across machines
