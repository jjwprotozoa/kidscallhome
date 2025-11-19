# Wrapper script to fix Windows file locking issue with Gradle problems report
# Usage: .\bundleRelease.ps1

# Stop any running Gradle daemons
Write-Host "Stopping Gradle daemons..." -ForegroundColor Yellow
& .\gradlew.bat --stop 2>&1 | Out-Null

# Delete the problematic file if it exists
$problemsReportFile = "build\reports\problems\problems-report.html"
if (Test-Path $problemsReportFile) {
    Write-Host "Removing locked problems report file..." -ForegroundColor Yellow
    try {
        # Try to delete, wait a bit if locked
        $retries = 5
        $deleted = $false
        for ($i = 0; $i -lt $retries; $i++) {
            try {
                Remove-Item -Path $problemsReportFile -Force -ErrorAction Stop
                $deleted = $true
                break
            } catch {
                Start-Sleep -Milliseconds 500
            }
        }
        if (-not $deleted) {
            Write-Host "Warning: Could not delete file, but continuing anyway..." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Warning: Could not delete file: $_" -ForegroundColor Yellow
    }
}

# Run the build
Write-Host "Starting bundleRelease build..." -ForegroundColor Green
& .\gradlew.bat bundleRelease --no-daemon

