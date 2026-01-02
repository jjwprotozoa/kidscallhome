# Sign AAB File from Codemagic
# This script signs an unsigned AAB file using your local keystore

param(
    [Parameter(Mandatory=$true)]
    [string]$AabPath,
    
    [Parameter(Mandatory=$false)]
    [string]$KeystorePath = "android\app\upload-keystore.jks",
    
    [Parameter(Mandatory=$false)]
    [string]$StorePassword = "KidsCallHome2025",
    
    [Parameter(Mandatory=$false)]
    [string]$KeyPassword = "KidsCallHome2025",
    
    [Parameter(Mandatory=$false)]
    [string]$KeyAlias = "upload"
)

# Get absolute paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = $ScriptDir
$FullKeystorePath = Join-Path $ProjectRoot $KeystorePath
$FullAabPath = Resolve-Path $AabPath -ErrorAction Stop

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Signing AAB File" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Verify keystore exists
if (-not (Test-Path $FullKeystorePath)) {
    Write-Host "❌ ERROR: Keystore not found at: $FullKeystorePath" -ForegroundColor Red
    exit 1
}

# Verify AAB exists
if (-not (Test-Path $FullAabPath)) {
    Write-Host "❌ ERROR: AAB file not found at: $FullAabPath" -ForegroundColor Red
    exit 1
}

Write-Host "Keystore: $FullKeystorePath" -ForegroundColor Green
Write-Host "AAB File: $FullAabPath" -ForegroundColor Green
Write-Host "Key Alias: $KeyAlias" -ForegroundColor Green
Write-Host ""

# Check if Java is available
$javaCmd = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaCmd) {
    Write-Host "❌ ERROR: Java not found in PATH" -ForegroundColor Red
    Write-Host "Please install Java JDK or add it to your PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host "Java version:" -ForegroundColor Cyan
java -version
Write-Host ""

# Create backup of original AAB
$BackupPath = "$FullAabPath.backup"
Write-Host "Creating backup: $BackupPath" -ForegroundColor Yellow
Copy-Item $FullAabPath $BackupPath -Force

# Sign the AAB
Write-Host "Signing AAB file..." -ForegroundColor Cyan
Write-Host ""

$signResult = & jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 `
    -keystore $FullKeystorePath `
    -storepass $StorePassword `
    -keypass $KeyPassword `
    $FullAabPath `
    $KeyAlias 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: Signing failed!" -ForegroundColor Red
    Write-Host $signResult
    Write-Host ""
    Write-Host "Restoring backup..." -ForegroundColor Yellow
    Copy-Item $BackupPath $FullAabPath -Force
    exit 1
}

Write-Host $signResult
Write-Host ""

# Verify the signature
Write-Host "Verifying signature..." -ForegroundColor Cyan
$verifyResult = & jarsigner -verify -verbose -certs $FullAabPath 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ WARNING: Signature verification failed!" -ForegroundColor Red
    Write-Host $verifyResult
    exit 1
}

Write-Host $verifyResult
Write-Host ""

# Check if verification shows "jar verified"
if ($verifyResult -match "jar verified") {
    Write-Host "✅ SUCCESS: AAB file is signed and verified!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Signed AAB location: $FullAabPath" -ForegroundColor Green
    Write-Host "Backup location: $BackupPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You can now upload this AAB to Google Play Console!" -ForegroundColor Cyan
} else {
    Write-Host "⚠️ WARNING: Verification output doesn't show 'jar verified'" -ForegroundColor Yellow
    Write-Host "The file may still be signed, but please verify manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan





