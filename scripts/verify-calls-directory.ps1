# Verification script for src/features/calls/ directory (PowerShell)
# This script helps verify changes before they are made

$CallsDir = "src/features/calls"
$ProtectedFile = Join-Path $CallsDir "PROTECTED.md"

Write-Host "🔒 Calls Directory Protection Verification" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if protected file exists
if (-not (Test-Path $ProtectedFile)) {
    Write-Host "❌ ERROR: PROTECTED.md not found in $CallsDir" -ForegroundColor Red
    Write-Host "   This directory should be protected!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Protection file found: $ProtectedFile" -ForegroundColor Green
Write-Host ""

# Check for uncommitted changes
$gitStatus = git status --porcelain $CallsDir
if ([string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Host "✅ No uncommitted changes in $CallsDir" -ForegroundColor Green
} else {
    Write-Host "⚠️  WARNING: Uncommitted changes detected in $CallsDir" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Changed files:"
    git status --porcelain $CallsDir | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    $response = Read-Host "Do you want to see the diff? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        git diff $CallsDir
    }
}

Write-Host ""
Write-Host "📋 Protection Checklist:" -ForegroundColor Cyan
Write-Host "  [ ] Read PROTECTED.md"
Write-Host "  [ ] Read README.md"
Write-Host "  [ ] Understood why change is necessary"
Write-Host "  [ ] Got user confirmation"
Write-Host "  [ ] Reviewed diff preview"
Write-Host "  [ ] Got explicit approval"
Write-Host ""
Write-Host "✅ Verification complete. Proceed with caution!" -ForegroundColor Green

