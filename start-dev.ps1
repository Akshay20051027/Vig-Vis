# Start Both Frontend and Backend Servers

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Mahotsav 26 - Starting Development Servers" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

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
Write-Host "Starting Backend Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev"

Start-Sleep -Seconds 2

Write-Host "Starting Frontend Server..." -ForegroundColor Green  
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Servers Starting!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend will run on:  http://localhost:5000" -ForegroundColor Yellow
Write-Host "Frontend will run on: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Two new terminal windows will open." -ForegroundColor White
Write-Host "Press Ctrl+C in each terminal to stop the servers." -ForegroundColor White
Write-Host ""
Write-Host "⏳ Please wait 10-15 seconds for servers to start..." -ForegroundColor Cyan
Write-Host ""
