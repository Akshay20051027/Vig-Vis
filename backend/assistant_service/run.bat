@echo off
REM ================================================
REM  Vignan University Assistant Service Launcher
REM ================================================

echo.
echo ========================================
echo  Starting Assistant Service...
echo ========================================
echo.

REM Check if virtual environment exists
if not exist ".venv\Scripts\python.exe" (
    echo ERROR: Virtual environment not found!
    echo Please ensure .venv folder exists.
    echo.
    pause
    exit /b 1
)

REM Activate virtual environment
echo [1/2] Activating virtual environment...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment!
    pause
    exit /b 1
)

REM Run the API server
echo [2/2] Starting API Server...
echo.
echo ----------------------------------------
echo  API Server Running
echo  Press Ctrl+C to stop
echo ----------------------------------------
echo.

python api_server.py
if errorlevel 1 (
    echo.
    echo ========================================
    echo  ERROR: Server crashed or failed!
    echo ========================================
    echo.
    pause
    exit /b 1
)

pause
