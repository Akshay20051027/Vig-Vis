# Mahotsav 26 Website - Setup and Run Script

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Mahotsav 26 - Campus Navigator Setup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Install backend dependencies
Write-Host "Step 1: Installing backend dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error installing backend dependencies!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Backend dependencies installed successfully!" -ForegroundColor Green
Write-Host ""

# 2. Install frontend dependencies
Write-Host "Step 2: Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location client
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error installing frontend dependencies!" -ForegroundColor Red
    exit 1
}
Set-Location ..
Write-Host "✓ Frontend dependencies installed successfully!" -ForegroundColor Green
Write-Host ""

# 3. Check if MongoDB is running
Write-Host "Step 3: Checking MongoDB connection..." -ForegroundColor Yellow
Write-Host "⚠ Please make sure MongoDB is running on localhost:27017" -ForegroundColor Yellow
Write-Host "  If not installed, download from: https://www.mongodb.com/try/download/community" -ForegroundColor Yellow
Write-Host ""
$response = Read-Host "Is MongoDB running? (y/n)"
if ($response -ne 'y') {
    Write-Host "Please start MongoDB and run this script again." -ForegroundColor Red
    exit 0
}
Write-Host ""

# 4. Seed the database
Write-Host "Step 4: Seeding database with initial data..." -ForegroundColor Yellow
node server/seed.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Warning: Database seeding failed. You may need to seed manually." -ForegroundColor Yellow
} else {
    Write-Host "✓ Database seeded successfully!" -ForegroundColor Green
}
Write-Host ""

# 5. Ready to run
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Setup Complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the application, run:" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Or start separately:" -ForegroundColor Yellow
Write-Host "  Terminal 1: npm run server" -ForegroundColor White
Write-Host "  Terminal 2: npm run client" -ForegroundColor White
Write-Host ""
Write-Host "The application will be available at:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor White
Write-Host ""
