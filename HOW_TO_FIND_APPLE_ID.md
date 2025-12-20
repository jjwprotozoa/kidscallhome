# How to Find Your App's Apple ID (Numeric ID)

## ⚠️ Important: Two Different IDs

There are **two different IDs** you need:

1. **Issuer ID** (UUID format like `597b3fa4-d3f8-43c0-9622-146e18528195`)

   - Used for App Store Connect API authentication
   - Found in: App Store Connect → Users and Access → Integrations → App Store Connect API
   - Already configured in Codemagic Team Settings ✅

2. **Apple ID** (Numeric, like `1234567890`)
   - Used for `APP_STORE_APPLE_ID` in codemagic.yaml
   - This is the **app record ID**, not the API Issuer ID
   - Found in: App Store Connect → My Apps → Your App → App Information

## 📱 How to Find Your App's Apple ID (Numeric)

### Step-by-Step:

1. **Go to App Store Connect**

   - Visit: https://appstoreconnect.apple.com
   - Log in with your Apple Developer account

2. **Navigate to Your App**

   - Click **My Apps** in the top menu
   - Click on **Kids Call Home** (your app)

3. **Open App Information**

   - In the left sidebar, click **App Information**
   - (This is different from "General Information")

4. **Find the Apple ID**

   - Look for a field labeled **Apple ID**
   - It will be a **numeric ID** like `1234567890` or `6789012345`
   - **NOT** a UUID format

5. **Copy the Numeric ID**
   - Copy this numeric Apple ID
   - It should be **only numbers**, no dashes or letters

### Visual Guide:

```
App Store Connect
└── My Apps
    └── Kids Call Home
        └── App Information (left sidebar)
            └── Apple ID: 1234567890  ← This is what you need!
```

## ✅ What You Have vs What You Need

| What You Have                                         | What You Need                        |
| ----------------------------------------------------- | ------------------------------------ |
| **Team ID**: `786BYGA3LW`                             | **Apple ID**: `1234567890` (numeric) |
| **Issuer ID**: `597b3fa4-d3f8-43c0-9622-146e18528195` | Used for `APP_STORE_APPLE_ID`        |
| **Bundle ID**: `com.kidscallhome.app`                 | Need to add to codemagic.yaml        |
| Used for API authentication                           | App record identifier                |
| Already in Codemagic ✅                               | ⏳ Will get after creating app       |

## 🔧 Update codemagic.yaml

Once you find your numeric Apple ID, update line 19 in `codemagic.yaml`:

```yaml
APP_STORE_APPLE_ID: "1234567890" # Replace with YOUR numeric Apple ID
```

**Example:**

- If your Apple ID is `6789012345`, use: `APP_STORE_APPLE_ID: "6789012345"`

## ❓ Can't Find It?

If you don't see an Apple ID in App Information, it might mean:

1. The app record hasn't been fully created yet
2. You need to complete the app creation process first
3. Check if you're looking at the right app

**Solution:** Make sure you've completed creating the app record in App Store Connect:

- App Store Connect → My Apps → + → New App
- Fill in all required fields
- Click Create
- Then find the Apple ID in App Information

## 🎯 Quick Check

Your Apple ID should:

- ✅ Be **numeric only** (just numbers)
- ✅ Be **8-10 digits** long typically
- ❌ **NOT** have dashes or letters
- ❌ **NOT** be a UUID format

If it looks like `597b3fa4-d3f8-43c0-9622-146e18528195`, that's the Issuer ID, not the Apple ID!
