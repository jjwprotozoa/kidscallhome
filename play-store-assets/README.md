# Play Store Assets

This directory contains all assets for your Google Play Store listing.

## Directory Structure

```text
play-store-assets/
├── feature-graphic/
│   └── feature-graphic-1024x500.png (or .jpg)
├── phone-screenshots/
│   ├── 01-landing-page.png
│   ├── 02-parent-dashboard.png
│   ├── 03-child-login.png
│   ├── 04-video-call.png
│   ├── 05-messages.png
│   └── 06-child-dashboard.png
├── tablet-7inch-screenshots/
│   └── (same screens as phone)
└── tablet-10inch-screenshots/
    └── (same screens as phone)
```

## Quick Reference

### Feature Graphic

- **Size**: 1024 × 500 px
- **Format**: PNG or JPEG
- **Max Size**: 15 MB
- **Status**: ⚠️ Must be created manually (see guide)

### Phone Screenshots

- **Quantity**: 2-8 (minimum 4 for promotion)
- **Aspect Ratio**: 9:16 (portrait) or 16:9 (landscape)
- **Recommended Size**: 1080 × 1920 px (9:16)
- **Max Size**: 8 MB each

### Tablet Screenshots

- **7-inch**: 1920 × 1080 px (16:9) recommended
- **10-inch**: 2560 × 1440 px (16:9) recommended
- **Max Size**: 8 MB each

## Getting Started

1. **Read the guide**: See `docs/PLAY_STORE_ASSETS_GUIDE.md`
2. **Set up directories**: Run `.\scripts\generate-play-store-screenshots.ps1`
3. **Capture screenshots**: Use Chrome DevTools, device, or automated script
4. **Create feature graphic**: Use Canva, Figma, or design tool
5. **Optimize images**: Use TinyPNG or similar tool
6. **Upload to Play Console**: Follow Google's upload process

## Automated Screenshot Generation

If you want to automate screenshot capture:

```bash
# Install Puppeteer (if not already installed)
npm install puppeteer --save-dev

# Run the script (make sure your app is running)
node scripts/generate-play-store-screenshots.js
```

Note: You may need to handle authentication for protected routes.

## Manual Screenshot Capture

### Using Chrome DevTools

1. Open your app: `http://localhost:5173`
2. Press `F12` to open DevTools
3. Press `Ctrl+Shift+M` to toggle device toolbar
4. Select device preset (Pixel 7, iPad Pro, etc.)
5. Navigate to each screen
6. Take screenshot using DevTools or browser

### Using Android Device

1. Open app on device/emulator
2. Navigate to each screen
3. Take screenshot (Power + Volume Down)
4. Transfer files to this directory

## Feature Graphic Design Tips

Your feature graphic should include:

- App name: "Kids Call Home"
- Key features:
  - Safe video calling for kids
  - Family-only contacts
  - Works without SIM card
  - No ads, privacy-focused
- Visual elements: Phone/tablet with call interface
- Brand colors: White background (from manifest)

Tools: Canva, Figma, Adobe Photoshop, or online banner makers.

## Image Optimization

Before uploading, optimize all images:

- Use TinyPNG: <https://tinypng.com>
- Or Squoosh: <https://squoosh.app>
- Verify file sizes are under limits
- Check image quality after compression

## Checklist

Before uploading to Play Console:

- [ ] Feature graphic is 1024×500px
- [ ] At least 2 phone screenshots (4+ for promotion)
- [ ] At least 2 7-inch tablet screenshots
- [ ] At least 2 10-inch tablet screenshots
- [ ] All images are optimized and under size limits
- [ ] Screenshots show real app content
- [ ] Feature graphic includes app branding
