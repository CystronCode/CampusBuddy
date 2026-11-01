# PowerShell script to run Campus Intelligence locally
Write-Host "Starting Campus Intelligence Backend..." -ForegroundColor Cyan

# Set default test environment variables if .env doesn't exist
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example" -ForegroundColor Yellow
}

# Run Uvicorn
py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
