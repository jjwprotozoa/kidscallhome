/**
 * scripts/generate-play-store-screenshots.js
 * 
 * Purpose: Automated script to generate Google Play Store screenshots
 * 
 * This script uses Puppeteer to capture screenshots of your app at different
 * device sizes for Play Store listing requirements.
 * 
 * Prerequisites:
 * - npm install puppeteer --save-dev
 * - App must be running locally or accessible via URL
 * 
 * Usage:
 *   node scripts/generate-play-store-screenshots.js
 * 
 * Configuration:
 *   - Set BASE_URL to your app URL (default: http://localhost:5173)
 *   - Set OUTPUT_DIR to where screenshots should be saved
 *   - Modify SCREENS array to include screens you want to capture
 */

import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BASE_URL = process.env.APP_URL || 'http://localhost:5173';
const OUTPUT_DIR = join(__dirname, '..', 'play-store-assets');
const SCREENSHOT_QUALITY = 90; // JPEG quality (0-100)

// Device presets for different screenshot requirements
const DEVICES = {
  // Phone screenshots (9:16 portrait - recommended for mobile apps)
  phone: {
    width: 1080,
    height: 1920, // 9:16 aspect ratio
    name: 'phone',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  // 7-inch tablet (16:9 landscape)
  tablet7: {
    width: 1920,
    height: 1080, // 16:9 aspect ratio
    name: 'tablet-7inch',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-T970) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  // 10-inch tablet (16:9 landscape)
  tablet10: {
    width: 2560,
    height: 1440, // 16:9 aspect ratio
    name: 'tablet-10inch',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-X906) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

// Screens to capture (add your app routes here)
// Note: You may need to handle authentication/login for protected routes
const SCREENS = [
  {
    path: '/',
    name: '01-landing-page',
    description: 'Landing/Marketing page'
  },
  {
    path: '/parent/children',
    name: '02-parent-dashboard',
    description: 'Parent dashboard with children list',
    requiresAuth: true
  },
  {
    path: '/child/login',
    name: '03-child-login',
    description: 'Child login screen'
  },
  {
    path: '/child/family',
    name: '04-child-dashboard',
    description: 'Child dashboard with family members',
    requiresAuth: true
  },
  // Add more screens as needed
  // Note: Video call screens may need special handling (mock data or test mode)
];

/**
 * Wait for page to be fully loaded
 */
async function waitForPageLoad(page) {
  try {
    await page.waitForSelector('body', { timeout: 10000 });
    // Wait a bit more for any animations or lazy-loaded content
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.warn('   ⚠️  Page load timeout, proceeding anyway...');
  }
}

/**
 * Capture screenshot for a specific screen and device
 */
async function captureScreenshot(page, screen, device) {
  const url = `${BASE_URL}${screen.path}`;
  console.log(`📸 Capturing ${screen.name} for ${device.name}...`);
  
  try {
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for page to fully load
    await waitForPageLoad(page);
    
    // Handle authentication if needed
    if (screen.requiresAuth) {
      console.log(`   ⚠️  Note: ${screen.name} requires authentication. You may need to log in manually or use test credentials.`);
      // Add your authentication logic here if needed
      // For example: await page.click('button[data-testid="login"]');
    }
    
    // Set viewport to device size
    await page.setViewport({
      width: device.width,
      height: device.height,
      deviceScaleFactor: 1
    });
    
    // Create output directory
    const outputPath = join(OUTPUT_DIR, device.name);
    await mkdir(outputPath, { recursive: true });
    
    // Take screenshot
    const filename = `${screen.name}-${device.width}x${device.height}.png`;
    const filepath = join(outputPath, filename);
    
    await page.screenshot({
      path: filepath,
      fullPage: true,
      type: 'png'
    });
    
    console.log(`   ✅ Saved: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error(`   ❌ Error capturing ${screen.name} for ${device.name}:`, error.message);
    return null;
  }
}

/**
 * Generate feature graphic (1024x500)
 * This is a placeholder - you'll need to create this manually or use a design tool
 */
async function generateFeatureGraphic() {
  console.log('\n📐 Feature Graphic (1024x500)');
  console.log('   ⚠️  Feature graphic must be created manually using a design tool.');
  console.log('   See docs/PLAY_STORE_ASSETS_GUIDE.md for design guidelines.');
  console.log('   Recommended tools: Canva, Figma, Adobe Photoshop');
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Play Store screenshot generation...\n');
  console.log(`📱 App URL: ${BASE_URL}`);
  console.log(`📁 Output Directory: ${OUTPUT_DIR}\n`);
  
  // Create output directories
  await mkdir(OUTPUT_DIR, { recursive: true });
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set default viewport
  await page.setViewport({
    width: 1080,
    height: 1920,
    deviceScaleFactor: 1
  });
  
  // Capture screenshots for each device and screen combination
  for (const device of Object.values(DEVICES)) {
    console.log(`\n📱 Generating ${device.name} screenshots (${device.width}x${device.height})...`);
    
    await page.setUserAgent(device.userAgent);
    
    for (const screen of SCREENS) {
      await captureScreenshot(page, screen, device);
    }
  }
  
  // Generate feature graphic info
  await generateFeatureGraphic();
  
  // Close browser
  await browser.close();
  
  console.log('\n✅ Screenshot generation complete!');
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Review screenshots in: ${OUTPUT_DIR}`);
  console.log(`   2. Create feature graphic (1024x500) manually`);
  console.log(`   3. Optimize images if needed (use TinyPNG or similar)`);
  console.log(`   4. Upload to Google Play Console`);
  console.log(`\n📖 See docs/PLAY_STORE_ASSETS_GUIDE.md for detailed requirements.\n`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('generate-play-store-screenshots.js')) {
  main().catch(console.error);
}

export { main, captureScreenshot, DEVICES, SCREENS };

