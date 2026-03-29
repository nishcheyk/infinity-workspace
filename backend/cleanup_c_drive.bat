@echo off
REM Clean up C: drive Python packages and use virtual environment

echo ========================================
echo   Cleaning C: Drive Python Packages
echo ========================================
echo.

echo WARNING: This will uninstall packages from your system Python!
echo Press Ctrl+C to cancel, or
pause

echo.
echo [1/3] Uninstalling large packages from C: drive...
pip uninstall torch torchvision torchaudio sentence-transformers transformers -y
pip uninstall playwright beautifulsoup4 celery redis motor pymongo qdrant-client -y
pip uninstall fastapi uvicorn pydantic langgraph langchain-core langchain-community -y
pip uninstall spacy scikit-learn numpy pandas -y

echo.
echo [2/3] Cleaning pip cache...
pip cache purge

echo.
echo [3/3] Removing temporary files...
del /q /s %TEMP%\pip-* 2>nul

echo.
echo ========================================
echo   C: Drive cleanup complete!
echo ========================================
echo.
echo Next steps:
echo 1. Activate venv: venv\Scripts\activate
echo 2. Install deps: pip install -r requirements.txt
echo 3. Install Playwright: playwright install chromium
echo ========================================
pause
