# scripts/generate-play-store-screenshots.ps1
# 
# Purpose: PowerShell script to help generate Play Store screenshots
# 
# This script provides instructions and can help organize screenshots
# if you're capturing them manually from a device or browser.
# 
# Usage:
#   .\scripts\generate-play-store-screenshots.ps1

Write-Host "📱 Google Play Store Screenshot Generator" -ForegroundColor Cyan
Write-Host ""

# Create output directories
$outputDir = Join-Path $PSScriptRoot ".." "play-store-assets"
$dirs = @(
    "phone-screenshots",
    "tablet-7inch-screenshots",
    "tablet-10inch-screenshots",
    "feature-graphic"
)

Write-Host "📁 Creating output directories..." -ForegroundColor Yellow
foreach ($dir in $dirs) {
    $fullPath = Join-Path $outputDir $dir
    if (-not (Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        Write-Host "   ✅ Created: $dir" -ForegroundColor Green
    } else {
        Write-Host "   ℹ️  Exists: $dir" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "📋 Required Screenshots:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Feature Graphic:" -ForegroundColor Yellow
Write-Host "   - Size: 1024 x 500 px"
Write-Host "   - Format: PNG or JPEG"
Write-Host "   - Max Size: 15 MB"
Write-Host "   - Location: $outputDir\feature-graphic\"
Write-Host ""
Write-Host "2. Phone Screenshots (2-8 required):" -ForegroundColor Yellow
Write-Host "   - Aspect Ratio: 16:9 or 9:16"
Write-Host "   - Recommended: 1080 x 1920 px (9:16 portrait)"
Write-Host "   - Min: 320 px, Max: 3840 px per side"
Write-Host "   - Location: $outputDir\phone-screenshots\"
Write-Host ""
Write-Host "3. 7-inch Tablet Screenshots (2-8 required):" -ForegroundColor Yellow
Write-Host "   - Aspect Ratio: 16:9 or 9:16"
Write-Host "   - Recommended: 1920 x 1080 px (16:9 landscape)"
Write-Host "   - Min: 320 px, Max: 3840 px per side"
Write-Host "   - Location: $outputDir\tablet-7inch-screenshots\"
Write-Host ""
Write-Host "4. 10-inch Tablet Screenshots (2-8 required):" -ForegroundColor Yellow
Write-Host "   - Aspect Ratio: 16:9 or 9:16"
Write-Host "   - Recommended: 2560 x 1440 px (16:9 landscape)"
Write-Host "   - Min: 1080 px, Max: 7680 px per side"
Write-Host "   - Location: $outputDir\tablet-10inch-screenshots\"
Write-Host ""

Write-Host "💡 How to Capture Screenshots:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 1: Using Chrome DevTools" -ForegroundColor Yellow
Write-Host "   1. Open your app in Chrome: http://localhost:5173"
Write-Host "   2. Press F12 to open DevTools"
Write-Host "   3. Press Ctrl+Shift+M to toggle device toolbar"
Write-Host "   4. Select device preset (Pixel 7, iPad, etc.)"
Write-Host "   5. Navigate to each screen"
Write-Host "   6. Use browser screenshot or DevTools screenshot"
Write-Host ""
Write-Host "Option 2: Using Android Device/Emulator" -ForegroundColor Yellow
Write-Host "   1. Open your app on device/emulator"
Write-Host "   2. Navigate to each screen"
Write-Host "   3. Take screenshot (Power + Volume Down)"
Write-Host "   4. Transfer to computer"
Write-Host ""
Write-Host "Option 3: Using Automated Script" -ForegroundColor Yellow
Write-Host "   1. Install Puppeteer: npm install puppeteer --save-dev"
Write-Host "   2. Run: node scripts/generate-play-store-screenshots.js"
Write-Host ""

Write-Host "📸 Recommended Screens to Capture:" -ForegroundColor Cyan
Write-Host ""
$screens = @(
    "1. Landing/Marketing Page (/)",
    "2. Parent Dashboard (/parent/children)",
    "3. Child Login Screen (/child/login)",
    "4. Child Dashboard (/child/family)",
    "5. Video Call Interface (during active call)",
    "6. Messages/Chat Interface",
    "7. Parent Settings/Safety (/parent/safety)",
    "8. Family Members List (/parent/family)"
)

foreach ($screen in $screens) {
    Write-Host "   $screen" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Directories created! Start capturing screenshots." -ForegroundColor Green
Write-Host ""
Write-Host "📖 For detailed requirements, see: docs/PLAY_STORE_ASSETS_GUIDE.md" -ForegroundColor Cyan
Write-Host ""


