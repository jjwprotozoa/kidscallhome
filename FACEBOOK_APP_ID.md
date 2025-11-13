# Facebook App ID Setup (Optional)

## What is fb:app_id?

The `fb:app_id` meta tag is used to associate your website with a Facebook App. It's **optional** for basic link previews in WhatsApp and Facebook, but Facebook's debugger tool may show it as "missing" or "required."

## Do You Need It?

**You DON'T need it if:**
- You just want link previews to work in WhatsApp/Facebook
- You're not using Facebook Login, Analytics, or other Facebook features
- You can ignore the warning in Facebook's debugger

**You DO need it if:**
- You want to use Facebook Login
- You want Facebook Analytics/Insights
- You want to use Facebook's sharing API
- You want to remove the warning in Facebook's debugger

## How to Get a Facebook App ID (If Needed)

1. Go to: https://developers.facebook.com/apps/
2. Click **"Create App"**
3. Select **"Consumer"** or **"Business"** as the app type
4. Fill in your app details:
   - App Name: "Kids Call Home"
   - App Contact Email: (your email)
5. Complete the setup
6. Go to **Settings** → **Basic**
7. Copy your **App ID**

## How to Add It

Once you have your Facebook App ID:

1. Open `index.html`
2. Find the commented line:
   ```html
   <!-- <meta property="fb:app_id" content="YOUR_FACEBOOK_APP_ID" /> -->
   ```
3. Uncomment it and replace `YOUR_FACEBOOK_APP_ID` with your actual App ID:
   ```html
   <meta property="fb:app_id" content="1234567890123456" />
   ```
4. Commit and push the changes

## Current Status

The `fb:app_id` tag is currently commented out in `index.html`. This means:
- ✅ Link previews will still work in WhatsApp
- ✅ Link previews will still work in Facebook
- ⚠️ Facebook's debugger will show a warning (but this doesn't affect functionality)

You can safely ignore the warning unless you need Facebook App features.

