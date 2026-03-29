@echo off
REM Activate virtual environment and start all services locally

echo ========================================
echo   AI Document Platform - Local Setup
echo ========================================
REM Set Playwright browsers path to F drive
set PLAYWRIGHT_BROWSERS_PATH=F:\ms-playwright

REM Activate virtual environment
echo [1/6] Activating virtual environment...
call venv\Scripts\activate.bat

REM Start databases in Docker
echo [2/6] Starting databases (Docker)...
docker-compose up -d mongo redis qdrant ollama unstructured

REM Wait for databases
echo [3/6] Waiting for databases to be ready...
timeout /t 5 /nobreak

REM Start backend API
echo [4/6] Starting backend API (Uvicorn)...
start "Backend API" cmd /k "venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

REM Wait a bit
timeout /t 3 /nobreak

REM Start Celery workers
echo [5/6] Starting Celery workers...
start "Celery Scraping Worker" cmd /k "venv\Scripts\activate.bat && python -m celery -A app.celery_app worker -Q scraping --loglevel=info --concurrency=2"
start "Celery Default Worker" cmd /k "venv\Scripts\activate.bat && python -m celery -A app.celery_app worker -Q default --loglevel=info --concurrency=2"

REM Start frontend
echo [6/6] Starting frontend (npm)...
cd ..\frontend
start "Frontend Dev Server" cmd /k "npm run dev"

echo.
echo ========================================
echo   All services started!
echo ========================================
echo   Backend API: http://localhost:8000
echo   Frontend:    http://localhost:3000
echo   API Docs:    http://localhost:8000/docs
echo ========================================
