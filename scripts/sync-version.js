// scripts/sync-version.js
// Purpose: Automatically sync version from package.json to Android build.gradle and inject into Vite build
// Usage: node scripts/sync-version.js [version]
//   - If version provided: updates package.json and syncs everywhere
//   - If no version: reads from package.json and syncs to Android/Vite

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const packageJsonPath = path.join(rootDir, 'package.json');
const androidBuildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');

/**
 * Read version from package.json
 */
function getPackageVersion() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

/**
 * Update version in package.json
 */
function updatePackageVersion(version) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = version;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Updated package.json version to ${version}`);
}

/**
 * Update version in Android build.gradle
 */
function updateAndroidVersion(version) {
  if (!fs.existsSync(androidBuildGradlePath)) {
    console.log('⚠️  Android build.gradle not found, skipping Android version update');
    return;
  }

  let buildGradle = fs.readFileSync(androidBuildGradlePath, 'utf8');
  
  // Extract version code (increment if version changed)
  const versionCodeMatch = buildGradle.match(/versionCode\s+(\d+)/);
  const currentVersionCode = versionCodeMatch ? parseInt(versionCodeMatch[1]) : 1;
  
  // Update versionName
  buildGradle = buildGradle.replace(
    /versionName\s+"[^"]+"/,
    `versionName "${version}"`
  );
  
  // Increment versionCode (required for Play Store uploads)
  // Note: This is a simple increment - you may want more sophisticated logic
  const newVersionCode = currentVersionCode + 1;
  buildGradle = buildGradle.replace(
    /versionCode\s+\d+/,
    `versionCode ${newVersionCode}`
  );
  
  fs.writeFileSync(androidBuildGradlePath, buildGradle);
  console.log(`✅ Updated Android build.gradle:`);
  console.log(`   versionName: ${version}`);
  console.log(`   versionCode: ${newVersionCode} (incremented)`);
}

/**
 * Validate version format (semver: x.y.z)
 */
function validateVersion(version) {
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
  if (!semverRegex.test(version)) {
    throw new Error(`Invalid version format: ${version}. Expected format: x.y.z or x.y.z-prerelease`);
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  let version;

  if (args.length > 0) {
    // Version provided - update package.json first
    version = args[0];
    validateVersion(version);
    updatePackageVersion(version);
  } else {
    // No version provided - read from package.json
    version = getPackageVersion();
    if (version === '0.0.0') {
      console.error('❌ package.json version is 0.0.0. Please provide a version:');
      console.error('   node scripts/sync-version.js 1.0.0');
      process.exit(1);
    }
    console.log(`📦 Current version in package.json: ${version}`);
  }

  // Sync to Android
  updateAndroidVersion(version);

  // Note: Vite will read VITE_APP_VERSION from environment or package.json
  // To use package.json version in Vite, you can set it in vite.config.ts
  console.log(`\n💡 To use this version in Vite builds, set VITE_APP_VERSION=${version}`);
  console.log(`   Or update vite.config.ts to read from package.json automatically`);
  
  console.log(`\n✅ Version sync complete!`);
}

main();

