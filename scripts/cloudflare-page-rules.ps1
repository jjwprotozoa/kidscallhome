# Cloudflare Page Rules Management Script
# Manages page rules for kidscallhome.com domain

param(
    [Parameter(Mandatory=$false)]
    [string]$Action = "list",  # list, create, delete, get
    
    [Parameter(Mandatory=$false)]
    [string]$PageRuleId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiToken = $env:CLOUDFLARE_API_TOKEN
)

# Configuration
$ZoneId = "47da5b94667c38fe40fe90419402ac78"
$BaseUrl = "https://api.cloudflare.com/client/v4/zones/$ZoneId/pagerules"

# Check for API token
if (-not $ApiToken) {
    Write-Host "Error: CLOUDFLARE_API_TOKEN environment variable not set" -ForegroundColor Red
    Write-Host "Set it with: `$env:CLOUDFLARE_API_TOKEN = 'your-token-here'" -ForegroundColor Yellow
    Write-Host "Or get a token from: https://dash.cloudflare.com/profile/api-tokens" -ForegroundColor Yellow
    exit 1
}

# Headers
$Headers = @{
    "Authorization" = "Bearer $ApiToken"
    "Content-Type" = "application/json"
}

function List-PageRules {
    Write-Host "Fetching page rules..." -ForegroundColor Cyan
    try {
        $Response = Invoke-RestMethod -Uri $BaseUrl -Method Get -Headers $Headers
        if ($Response.success) {
            Write-Host "`nPage Rules Found: $($Response.result.Count)" -ForegroundColor Green
            foreach ($rule in $Response.result) {
                Write-Host "`n--- Page Rule: $($rule.id) ---" -ForegroundColor Yellow
                Write-Host "Status: $($rule.status)" -ForegroundColor $(if ($rule.status -eq "active") { "Green" } else { "Red" })
                Write-Host "Priority: $($rule.priority)"
                Write-Host "Targets:"
                foreach ($target in $rule.targets) {
                    Write-Host "  - $($target.constraint.value)" -ForegroundColor Gray
                }
                Write-Host "Actions:"
                foreach ($action in $rule.actions) {
                    if ($action.id -eq "forwarding_url") {
                        Write-Host "  - Redirect: $($action.value.url) (Status: $($action.value.status_code))" -ForegroundColor Gray
                    } else {
                        Write-Host "  - $($action.id): $($action.value)" -ForegroundColor Gray
                    }
                }
            }
        } else {
            Write-Host "Error: $($Response.errors | ConvertTo-Json)" -ForegroundColor Red
        }
    } catch {
        Write-Host "Error fetching page rules: $_" -ForegroundColor Red
    }
}

function Get-PageRule {
    if (-not $PageRuleId) {
        Write-Host "Error: PageRuleId is required for 'get' action" -ForegroundColor Red
        exit 1
    }
    Write-Host "Fetching page rule: $PageRuleId..." -ForegroundColor Cyan
    try {
        $Response = Invoke-RestMethod -Uri "$BaseUrl/$PageRuleId" -Method Get -Headers $Headers
        if ($Response.success) {
            Write-Host "`nPage Rule Details:" -ForegroundColor Green
            $Response.result | ConvertTo-Json -Depth 10
        } else {
            Write-Host "Error: $($Response.errors | ConvertTo-Json)" -ForegroundColor Red
        }
    } catch {
        Write-Host "Error fetching page rule: $_" -ForegroundColor Red
    }
}

function Create-RootDomainRedirect {
    Write-Host "Creating page rule to redirect kidscallhome.com → www.kidscallhome.com..." -ForegroundColor Cyan
    
    $Body = @{
        targets = @(
            @{
                target = "url"
                constraint = @{
                    operator = "matches"
                    value = "http://kidscallhome.com/*"
                }
            },
            @{
                target = "url"
                constraint = @{
                    operator = "matches"
                    value = "https://kidscallhome.com/*"
                }
            }
        )
        actions = @(
            @{
                id = "forwarding_url"
                value = @{
                    url = "https://www.kidscallhome.com/`$1"
                    status_code = 301
                }
            }
        )
        priority = 1
        status = "active"
    } | ConvertTo-Json -Depth 10
    
    try {
        $Response = Invoke-RestMethod -Uri $BaseUrl -Method Post -Headers $Headers -Body $Body
        if ($Response.success) {
            Write-Host "`n✅ Page Rule Created Successfully!" -ForegroundColor Green
            Write-Host "Rule ID: $($Response.result.id)" -ForegroundColor Yellow
            Write-Host "`nRule will be active in 1-2 minutes." -ForegroundColor Cyan
            Write-Host "Test with: curl -I http://kidscallhome.com" -ForegroundColor Gray
        } else {
            Write-Host "Error: $($Response.errors | ConvertTo-Json)" -ForegroundColor Red
        }
    } catch {
        Write-Host "Error creating page rule: $_" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
}

function Delete-PageRule {
    if (-not $PageRuleId) {
        Write-Host "Error: PageRuleId is required for 'delete' action" -ForegroundColor Red
        Write-Host "Usage: .\cloudflare-page-rules.ps1 -Action delete -PageRuleId 'rule-id'" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Deleting page rule: $PageRuleId..." -ForegroundColor Cyan
    try {
        $Response = Invoke-RestMethod -Uri "$BaseUrl/$PageRuleId" -Method Delete -Headers $Headers
        if ($Response.success) {
            Write-Host "✅ Page Rule Deleted Successfully!" -ForegroundColor Green
        } else {
            Write-Host "Error: $($Response.errors | ConvertTo-Json)" -ForegroundColor Red
        }
    } catch {
        Write-Host "Error deleting page rule: $_" -ForegroundColor Red
    }
}

# Main execution
switch ($Action.ToLower()) {
    "list" {
        List-PageRules
    }
    "get" {
        Get-PageRule
    }
    "create" {
        Create-RootDomainRedirect
    }
    "delete" {
        Delete-PageRule
    }
    default {
        Write-Host "Unknown action: $Action" -ForegroundColor Red
        Write-Host "Valid actions: list, get, create, delete" -ForegroundColor Yellow
        exit 1
    }
}

