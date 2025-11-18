# Codemagic Build Status Checker
# Usage: .\scripts\check-codemagic-build.ps1 -ApiToken "your-token" -AppId "your-app-id" -WorkflowId "android-build" -Branch "feature/android-native-launch"
# Or from scripts directory: .\check-codemagic-build.ps1 -ApiToken "your-token" -AppId "your-app-id"

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiToken,
    
    [Parameter(Mandatory=$true)]
    [string]$AppId,
    
    [Parameter(Mandatory=$false)]
    [string]$WorkflowId = "android-build",
    
    [Parameter(Mandatory=$false)]
    [string]$Branch = "feature/android-native-launch",
    
    [Parameter(Mandatory=$false)]
    [string]$BuildId = ""
)

$headers = @{
    "Content-Type" = "application/json"
    "x-auth-token" = $ApiToken
}

if ($BuildId) {
    # Check specific build status
    Write-Host "Checking build status for Build ID: $BuildId" -ForegroundColor Cyan
    $url = "https://api.codemagic.io/builds/$BuildId"
    
    try {
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
        Write-Host "`nBuild Status:" -ForegroundColor Green
        Write-Host "  Build ID: $($response.build.buildId)" -ForegroundColor Yellow
        Write-Host "  Status: $($response.build.status)" -ForegroundColor $(if ($response.build.status -eq "finished") { "Green" } elseif ($response.build.status -eq "failed") { "Red" } else { "Yellow" })
        Write-Host "  Started: $($response.build.startedAt)" -ForegroundColor Gray
        Write-Host "  Finished: $($response.build.finishedAt)" -ForegroundColor Gray
        Write-Host "  Branch: $($response.build.branch)" -ForegroundColor Gray
        Write-Host "  Workflow: $($response.build.workflowId)" -ForegroundColor Gray
        
        if ($response.build.status -eq "failed") {
            Write-Host "`n❌ Build failed!" -ForegroundColor Red
        } elseif ($response.build.status -eq "finished") {
            Write-Host "`n✅ Build completed successfully!" -ForegroundColor Green
        }
        
        return $response
    } catch {
        Write-Host "Error checking build status: $_" -ForegroundColor Red
        return $null
    }
} else {
    # List recent builds for the app/workflow
    Write-Host "Fetching recent builds for App: $AppId, Workflow: $WorkflowId, Branch: $Branch" -ForegroundColor Cyan
    $url = "https://api.codemagic.io/builds?appId=$AppId&workflowId=$WorkflowId&branch=$Branch"
    
    try {
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
        
        if ($response.builds -and $response.builds.Count -gt 0) {
            Write-Host "`nRecent Builds:" -ForegroundColor Green
            foreach ($build in $response.builds | Select-Object -First 5) {
                $statusColor = if ($build.status -eq "finished") { "Green" } elseif ($build.status -eq "failed") { "Red" } else { "Yellow" }
                Write-Host "  Build ID: $($build.buildId) - Status: $($build.status) - Started: $($build.startedAt)" -ForegroundColor $statusColor
            }
            
            $latestBuild = $response.builds[0]
            Write-Host "`nLatest Build Details:" -ForegroundColor Cyan
            Write-Host "  Build ID: $($latestBuild.buildId)" -ForegroundColor Yellow
            Write-Host "  Status: $($latestBuild.status)" -ForegroundColor $(if ($latestBuild.status -eq "finished") { "Green" } elseif ($latestBuild.status -eq "failed") { "Red" } else { "Yellow" })
            Write-Host "  Started: $($latestBuild.startedAt)" -ForegroundColor Gray
            
            return $latestBuild
        } else {
            Write-Host "No builds found for the specified criteria." -ForegroundColor Yellow
            return $null
        }
    } catch {
        Write-Host "Error fetching builds: $_" -ForegroundColor Red
        Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
        return $null
    }
}

Write-Host "`nTo get your API token:" -ForegroundColor Cyan
Write-Host "  1. Go to https://codemagic.io" -ForegroundColor Gray
Write-Host "  2. Navigate to User Settings > Integrations > Codemagic API" -ForegroundColor Gray
Write-Host "  3. Click 'Show' to reveal your API token" -ForegroundColor Gray
Write-Host "`nTo get your App ID:" -ForegroundColor Cyan
Write-Host "  - Go to your app in Codemagic UI" -ForegroundColor Gray
Write-Host "  - The App ID is in the URL: https://codemagic.io/app/<app-id>" -ForegroundColor Gray

