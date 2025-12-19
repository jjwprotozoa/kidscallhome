# Install Supabase CLI on Windows

## ⚠️ Important Note

Supabase CLI **no longer supports** global npm installation. Use one of these methods:

---

## 🚀 Recommended: Scoop (Easiest for Windows)

### Step 1: Install Scoop (if not already installed)

```powershell
# Run in PowerShell (as Administrator)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

### Step 2: Add Supabase Bucket

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
```

### Step 3: Install Supabase CLI

```powershell
scoop install supabase
```

### Step 4: Verify Installation

```powershell
supabase --version
```

---

## 🎯 Alternative: Chocolatey

### Step 1: Install Chocolatey (if not already installed)

Visit: https://chocolatey.org/install

### Step 2: Install Supabase CLI

```powershell
choco install supabase
```

---

## 📦 Alternative: Manual Installation

### Step 1: Download Binary

1. Visit: https://github.com/supabase/cli/releases
2. Download: `supabase_windows_amd64.zip` (or appropriate for your system)
3. Extract to a folder (e.g., `C:\tools\supabase\`)

### Step 2: Add to PATH

```powershell
# Add to PATH permanently
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\tools\supabase",
    "User"
)

# Or add temporarily for current session
$env:Path += ";C:\tools\supabase"
```

### Step 3: Verify

```powershell
supabase --version
```

---

## 🔧 After Installation

### 1. Login to Supabase

```powershell
supabase login
```

This will open your browser to authenticate.

### 2. Link Your Project

```powershell
cd C:\Users\DevBox\MiniApps\KidsCallHome\kidscallhome\kidscallhome
supabase link --project-ref itmhojbjfacocrpmslmt
```

### 3. Deploy Functions

```powershell
supabase functions deploy create-stripe-subscription
supabase functions deploy stripe-webhook
supabase functions deploy create-customer-portal-session
supabase functions deploy send-family-member-invitation
```

---

## 🎯 Quick Install Script

Run this in PowerShell (as Administrator):

```powershell
# Install Scoop if needed
if (!(Get-Command scoop -ErrorAction SilentlyContinue)) {
    Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
    irm get.scoop.sh | iex
}

# Add Supabase bucket and install
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Verify
supabase --version
```

---

## ✅ Verify Installation

After installation, verify it works:

```powershell
supabase --version
# Should show: supabase version X.X.X
```

---

## 🐛 Troubleshooting

### "scoop: command not found"
- Install Scoop first (see Step 1 above)
- Make sure PowerShell execution policy allows scripts

### "Permission denied"
- Run PowerShell as Administrator
- Or use user-level installation

### "Project link failed"
- Make sure you're logged in: `supabase login`
- Verify project ref is correct: `itmhojbjfacocrpmslmt`
- Check you have access to the project

---

## 📚 Resources

- [Supabase CLI GitHub](https://github.com/supabase/cli)
- [Scoop Package Manager](https://scoop.sh/)
- [Chocolatey Package Manager](https://chocolatey.org/)

---

**Recommended:** Use Scoop for easiest installation and updates on Windows.










