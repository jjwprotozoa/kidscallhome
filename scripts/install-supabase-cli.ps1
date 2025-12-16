# Install Supabase CLI for Windows
# This script helps install the Supabase CLI using the easiest available method

Write-Host "🔧 Supabase CLI Installation Helper" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Check if Node.js/npm is available
$npmAvailable = $false
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $npmAvailable = $true
        Write-Host "✅ npm found: $npmVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  npm not found" -ForegroundColor Yellow
}

# Check if Scoop is available
$scoopAvailable = $false
try {
    $scoopVersion = scoop --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $scoopAvailable = $true
        Write-Host "✅ Scoop found" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Scoop not found" -ForegroundColor Yellow
}

# Check if Chocolatey is available
$chocoAvailable = $false
try {
    $chocoVersion = choco --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $chocoAvailable = $true
        Write-Host "✅ Chocolatey found: $chocoVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Chocolatey not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installation Options:" -ForegroundColor Cyan
Write-Host ""

if ($npmAvailable) {
    Write-Host "1. Install via npm (Recommended if you have Node.js)" -ForegroundColor Green
    Write-Host "   Run: npm install -g supabase" -ForegroundColor Cyan
    Write-Host ""
}

if ($scoopAvailable) {
    Write-Host "2. Install via Scoop" -ForegroundColor Green
    Write-Host "   Run: scoop install supabase" -ForegroundColor Cyan
    Write-Host ""
}

if ($chocoAvailable) {
    Write-Host "3. Install via Chocolatey" -ForegroundColor Green
    Write-Host "   Run: choco install supabase" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "4. Manual Installation" -ForegroundColor Green
Write-Host "   Download from: https://github.com/supabase/cli/releases" -ForegroundColor Cyan
Write-Host "   Extract and add to PATH" -ForegroundColor Cyan
Write-Host ""

# Ask user which method to use
if ($npmAvailable) {
    $choice = Read-Host "Choose installation method (1=npm, 2=scoop, 3=choco, 4=manual) [1]"
    if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }
    
    switch ($choice) {
        "1" {
            if ($npmAvailable) {
                Write-Host "Installing via npm..." -ForegroundColor Yellow
                npm install -g supabase
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ Supabase CLI installed successfully!" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "Next steps:" -ForegroundColor Cyan
                    Write-Host "  1. Run: supabase login" -ForegroundColor Yellow
                    Write-Host "  2. Run: supabase link --project-ref itmhojbjfacocrpmslmt" -ForegroundColor Yellow
                    Write-Host "  3. Deploy functions: supabase functions deploy [function-name]" -ForegroundColor Yellow
                }
            }
        }
        "2" {
            if ($scoopAvailable) {
                Write-Host "Installing via Scoop..." -ForegroundColor Yellow
                scoop install supabase
            }
        }
        "3" {
            if ($chocoAvailable) {
                Write-Host "Installing via Chocolatey..." -ForegroundColor Yellow
                choco install supabase
            }
        }
        "4" {
            Write-Host "Manual installation:" -ForegroundColor Yellow
            Write-Host "1. Visit: https://github.com/supabase/cli/releases" -ForegroundColor Cyan
            Write-Host "2. Download the Windows binary" -ForegroundColor Cyan
            Write-Host "3. Extract and add to your PATH" -ForegroundColor Cyan
        }
        default {
            Write-Host "Invalid choice. Please run the script again." -ForegroundColor Red
        }
    }
} else {
    Write-Host "⚠️  No package manager found. Please install manually:" -ForegroundColor Yellow
    Write-Host "   https://github.com/supabase/cli/releases" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or install Node.js first, then run:" -ForegroundColor Yellow
    Write-Host "   npm install -g supabase" -ForegroundColor Cyan
}

Write-Host ""





