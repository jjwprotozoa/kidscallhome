# Test create-customer-portal-session Edge Function
# Run this from PowerShell: .\test-function.ps1

Write-Host "🧪 Testing create-customer-portal-session function..." -ForegroundColor Cyan

# You need to provide these values:
$SUPABASE_ANON_KEY = Read-Host "Enter your Supabase Anon Key (VITE_SUPABASE_PUBLISHABLE_KEY)"
$ACCESS_TOKEN = Read-Host "Enter your access token (get from browser console or Supabase dashboard)"

if ([string]::IsNullOrWhiteSpace($SUPABASE_ANON_KEY) -or [string]::IsNullOrWhiteSpace($ACCESS_TOKEN)) {
    Write-Host "❌ Both values are required!" -ForegroundColor Red
    exit 1
}

$url = "https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/create-customer-portal-session"
$body = @{
    returnUrl = "https://www.kidscallhome.com/parent/upgrade"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $ACCESS_TOKEN"
    "Content-Type" = "application/json"
    "apikey" = $SUPABASE_ANON_KEY
}

Write-Host "`n📡 Sending request to: $url" -ForegroundColor Yellow
Write-Host "📤 Body: $body`n" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host "📄 Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ ERROR!" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    Write-Host "Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Yellow
    
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    Write-Host "Response Body: $responseBody" -ForegroundColor Red
}



