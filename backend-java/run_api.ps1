$ErrorActionPreference = "Stop"

# Ensure we are in the script's directory (backend-java)
$scriptPath = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path $scriptPath
Set-Location $scriptDir

Write-Host "Starting Java API from: $scriptDir"
Write-Host "Database expected at: ../backend/app.db"

# Check if DB exists relative to here
if (Test-Path "../backend/app.db") {
    Write-Host "Database file FOUND." -ForegroundColor Green
} else {
    Write-Host "WARNING: Database file NOT FOUND at ../backend/app.db" -ForegroundColor Red
}

./mvnw spring-boot:run
