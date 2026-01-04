# scripts/sign-android-build.ps1
# Local Android APK/AAB signing script
# Use this to sign unsigned builds downloaded from Codemagic

param(
    [Parameter(Mandatory=$true)]
    [string]$InputFile,

    [Parameter(Mandatory=$false)]
    [string]$KeystorePath = "android/upload-keystore.jks",

    [Parameter(Mandatory=$false)]
    [string]$KeystorePassword = "KidsCallHome2024!",

    [Parameter(Mandatory=$false)]
    [string]$KeyAlias = "upload",

    [Parameter(Mandatory=$false)]
    [string]$KeyPassword = "KidsCallHome2024!"
)

Write-Host "=== Android Build Signing Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if input file exists
if (-not (Test-Path $InputFile)) {
    Write-Host "❌ ERROR: Input file not found: $InputFile" -ForegroundColor Red
    exit 1
}

# Check if keystore exists
if (-not (Test-Path $KeystorePath)) {
    Write-Host "❌ ERROR: Keystore file not found: $KeystorePath" -ForegroundColor Red
    Write-Host ""
    Write-Host "To generate a keystore, run:" -ForegroundColor Yellow
    Write-Host "  keytool -genkey -v -keystore android/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload" -ForegroundColor Yellow
    exit 1
}

$FileExtension = [System.IO.Path]::GetExtension($InputFile).ToLower()
$OutputFile = $InputFile -replace '\.(apk|aab)$', '-signed.$1'

Write-Host "Input file: $InputFile" -ForegroundColor Green
Write-Host "Output file: $OutputFile" -ForegroundColor Green
Write-Host "Keystore: $KeystorePath" -ForegroundColor Green
Write-Host "Key alias: $KeyAlias" -ForegroundColor Green
Write-Host ""

if ($FileExtension -eq ".apk") {
    Write-Host "Signing APK..." -ForegroundColor Cyan

    # Sign APK using apksigner (Android SDK tool)
    $apksignerPath = "$env:ANDROID_HOME\build-tools\*\apksigner.bat"
    $apksigner = Get-ChildItem -Path $apksignerPath -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($apksigner) {
        Write-Host "Using apksigner: $($apksigner.FullName)" -ForegroundColor Gray

        # Sign the APK
        & $apksigner.FullName sign `
            --ks $KeystorePath `
            --ks-pass "pass:$KeystorePassword" `
            --ks-key-alias $KeyAlias `
            --key-pass "pass:$KeyPassword" `
            --out $OutputFile `
            $InputFile

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ APK signed successfully!" -ForegroundColor Green
            Write-Host "   Output: $OutputFile" -ForegroundColor Green

            # Verify signature
            Write-Host ""
            Write-Host "Verifying signature..." -ForegroundColor Cyan
            & $apksigner.FullName verify --verbose $OutputFile
        } else {
            Write-Host "❌ Failed to sign APK" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠️ apksigner not found. Trying jarsigner..." -ForegroundColor Yellow

        # Fallback to jarsigner
        jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 `
            -keystore $KeystorePath `
            -storepass $KeystorePassword `
            -keypass $KeyPassword `
            $InputFile `
            $KeyAlias

        if ($LASTEXITCODE -eq 0) {
            # Rename to signed version
            Move-Item -Path $InputFile -Destination $OutputFile -Force
            Write-Host "✅ APK signed successfully with jarsigner!" -ForegroundColor Green
            Write-Host "   Output: $OutputFile" -ForegroundColor Green

            # Verify
            jarsigner -verify -verbose -certs $OutputFile
        } else {
            Write-Host "❌ Failed to sign APK with jarsigner" -ForegroundColor Red
            exit 1
        }
    }
}
elseif ($FileExtension -eq ".aab") {
    Write-Host "Signing AAB (Android App Bundle)..." -ForegroundColor Cyan

    # Sign AAB using jarsigner
    jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 `
        -keystore $KeystorePath `
        -storepass $KeystorePassword `
        -keypass $KeyPassword `
        $InputFile `
        $KeyAlias

    if ($LASTEXITCODE -eq 0) {
        # Rename to signed version
        Move-Item -Path $InputFile -Destination $OutputFile -Force
        Write-Host "✅ AAB signed successfully!" -ForegroundColor Green
        Write-Host "   Output: $OutputFile" -ForegroundColor Green

        # Verify
        Write-Host ""
        Write-Host "Verifying signature..." -ForegroundColor Cyan
        jarsigner -verify -verbose -certs $OutputFile
    } else {
        Write-Host "❌ Failed to sign AAB" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "❌ ERROR: Unsupported file type. Expected .apk or .aab" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Signing Complete ===" -ForegroundColor Green
Write-Host "Signed file: $OutputFile" -ForegroundColor Green

