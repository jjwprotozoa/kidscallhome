#!/usr/bin/env bash

echo "=== Setting up Android Keystore for Signing ==="
echo ""

# Check if keystore environment variables are set
if [ -z "$CM_KEYSTORE_PATH" ]; then
  echo "❌ ERROR: CM_KEYSTORE_PATH is not set!"
  echo "Please configure the keystore in Codemagic Team Settings → Code Signing → android_keystore group"
  exit 1
fi

if [ -z "$CM_KEYSTORE_PASSWORD" ]; then
  echo "❌ ERROR: CM_KEYSTORE_PASSWORD is not set!"
  exit 1
fi

if [ -z "$CM_KEY_ALIAS" ]; then
  echo "❌ ERROR: CM_KEY_ALIAS is not set!"
  exit 1
fi

if [ -z "$CM_KEY_PASSWORD" ]; then
  echo "❌ ERROR: CM_KEY_PASSWORD is not set!"
  exit 1
fi

echo "✅ All keystore environment variables are set"
echo "  Keystore path: $CM_KEYSTORE_PATH"
echo "  Key alias: $CM_KEY_ALIAS"
echo ""

# Verify keystore file exists
if [ ! -f "$CM_KEYSTORE_PATH" ]; then
  echo "❌ ERROR: Keystore file not found at: $CM_KEYSTORE_PATH"
  exit 1
fi

echo "✅ Keystore file found"

# Copy keystore to android directory
KEYSTORE_DEST="android/upload-keystore.jks"
echo "Copying keystore to: $KEYSTORE_DEST"
cp "$CM_KEYSTORE_PATH" "$KEYSTORE_DEST"

if [ ! -f "$KEYSTORE_DEST" ]; then
  echo "❌ ERROR: Failed to copy keystore file!"
  exit 1
fi

echo "✅ Keystore copied successfully"

# Create keystore.properties file in android directory
KEYSTORE_PROPERTIES="android/keystore.properties"
echo "Creating keystore.properties file..."

printf "storeFile=upload-keystore.jks\nstorePassword=%s\nkeyAlias=%s\nkeyPassword=%s\n" \
  "$CM_KEYSTORE_PASSWORD" \
  "$CM_KEY_ALIAS" \
  "$CM_KEY_PASSWORD" > "$KEYSTORE_PROPERTIES"

if [ ! -f "$KEYSTORE_PROPERTIES" ]; then
  echo "❌ ERROR: Failed to create keystore.properties file!"
  exit 1
fi

echo "✅ keystore.properties created"
echo ""
echo "Verifying keystore.properties contents (without passwords):"
sed 's/Password=.*/Password=***/' "$KEYSTORE_PROPERTIES" | sed 's/storePassword=.*/storePassword=***/'
echo ""
echo "✅ Keystore setup complete - AAB will be signed during build"

