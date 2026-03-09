# Start Both Frontend and Backend Servers

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "   VIGNAN UNIVERSITY NAVIGATOR - Starting Development Servers" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""

function Test-PortListening {
    param(
        [Parameter(Mandatory = $true)][int]$Port
    )

    # Prefer Get-NetTCPConnection (fast), fall back to Test-NetConnection.
    try {
        $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        return $null -ne $listener
    } catch {
        try {
            return (Test-NetConnection -ComputerName "localhost" -Port $Port -WarningAction SilentlyContinue).TcpTestSucceeded
        } catch {
            return $false
        }
    }
}

# Check if MongoDB is running
Write-Host "Checking MongoDB..." -ForegroundColor Yellow
$mongoRunning = Get-Process mongod -ErrorAction SilentlyContinue
if (!$mongoRunning) {
    Write-Host "⚠️  MongoDB is not running!" -ForegroundColor Red
    Write-Host "Please start MongoDB first: mongod" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Continue anyway? (y/n)"
    if ($response -ne 'y') {
        exit
    }
}

Write-Host ""
if (Test-PortListening -Port 5000) {
    Write-Host "✅ Backend already running on http://localhost:5000" -ForegroundColor Green
} else {
    Write-Host "Starting Backend Server..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev"
}

Start-Sleep -Seconds 1

if (Test-PortListening -Port 5001) {
    Write-Host "✅ Assistant already running on http://localhost:5001" -ForegroundColor Green
} else {
    Write-Host "Starting Python Assistant Service..." -ForegroundColor Green
    $pythonExe = Join-Path $PSScriptRoot "backend\assistant_service\.venv\Scripts\python.exe"
    if (Test-Path $pythonExe) {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend\assistant_service'; & '$pythonExe' api_server.py"
    } else {
        Write-Host "⚠️  Could not find venv at $pythonExe" -ForegroundColor Yellow
        Write-Host "   Falling back to system 'python' on PATH." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend\assistant_service'; python api_server.py"
    }
}

Start-Sleep -Seconds 2

if (Test-PortListening -Port 3000) {
    Write-Host "✅ Frontend already running on http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "Starting Frontend Server..." -ForegroundColor Green  
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Servers Starting!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend will run on:  http://localhost:5000" -ForegroundColor Yellow
Write-Host "Assistant will run on: http://localhost:5001" -ForegroundColor Yellow
Write-Host "Frontend will run on: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "One to three new terminal windows may open (only for services not running)." -ForegroundColor White
Write-Host "Press Ctrl+C in each terminal to stop the servers." -ForegroundColor White
Write-Host ""
Write-Host "⏳ Please wait 10-15 seconds for servers to start..." -ForegroundColor Cyan
Write-Host ""
