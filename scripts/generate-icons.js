// scripts/generate-icons.js
// Generates all required icon sizes from the source image

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');
const sourceImage = join(publicDir, 'kids-call-home.png');

// Icon sizes to generate
const iconSizes = [
  { name: 'icon-96x96.png', size: 96 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'og-image.png', width: 1200, height: 630 }, // Open Graph image
];

async function generateIcons() {
  // Check if source image exists
  if (!existsSync(sourceImage)) {
    console.error(`Error: Source image not found at ${sourceImage}`);
    process.exit(1);
  }

  console.log('Generating icons from:', sourceImage);
  console.log('');

  try {
    // Generate square icons
    for (const icon of iconSizes.slice(0, 3)) {
      const outputPath = join(publicDir, icon.name);
      await sharp(sourceImage)
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated ${icon.name} (${icon.size}x${icon.size})`);
    }

    // Generate Open Graph image (1200x630)
    const ogIcon = iconSizes[3];
    const ogOutputPath = join(publicDir, ogIcon.name);
    await sharp(sourceImage)
      .resize(ogIcon.width, ogIcon.height, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(ogOutputPath);
    console.log(`✓ Generated ${ogIcon.name} (${ogIcon.width}x${ogIcon.height})`);

    console.log('');
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();

