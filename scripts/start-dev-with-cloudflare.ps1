# scripts/start-dev-with-cloudflare.ps1
# Purpose: Helper script to start local dev server and Cloudflare tunnel in separate windows
# Usage: .\scripts\start-dev-with-cloudflare.ps1

Write-Host "Starting development environment..." -ForegroundColor Green
Write-Host ""
Write-Host "This will open two separate PowerShell windows:" -ForegroundColor Yellow
Write-Host "  1. Local dev server (port 8080)" -ForegroundColor Cyan
Write-Host "  2. Cloudflare tunnel" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can close/restart each window independently." -ForegroundColor Yellow
Write-Host ""

# Get the project root directory (parent of scripts folder)
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Start local dev server in new window
Write-Host "Starting local dev server..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; npm run dev:local"

# Wait a moment for the server to start
Start-Sleep -Seconds 2

# Start Cloudflare tunnel in new window
Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; npm run tunnel:cloudflare"

Write-Host ""
Write-Host "Both servers are starting in separate windows." -ForegroundColor Green
Write-Host "Check the Cloudflare tunnel window for your public URL." -ForegroundColor Yellow
Write-Host ""
Write-Host "To stop:" -ForegroundColor Yellow
Write-Host "  - Close the respective window, or" -ForegroundColor Gray
Write-Host "  - Press Ctrl+C in that window" -ForegroundColor Gray


