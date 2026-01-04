#!/bin/bash
# scripts/sign-android-build.sh
# Local Android APK/AAB signing script
# Use this to sign unsigned builds downloaded from Codemagic

set -e

INPUT_FILE="$1"
KEYSTORE_PATH="${2:-android/upload-keystore.jks}"
KEYSTORE_PASSWORD="${3:-KidsCallHome2024!}"
KEY_ALIAS="${4:-upload}"
KEY_PASSWORD="${5:-KidsCallHome2024!}"

if [ -z "$INPUT_FILE" ]; then
    echo "Usage: $0 <input-file> [keystore-path] [keystore-password] [key-alias] [key-password]"
    echo ""
    echo "Example:"
    echo "  $0 app-release-unsigned.apk"
    echo "  $0 app-release-unsigned.aab"
    exit 1
fi

echo "=== Android Build Signing Script ==="
echo ""

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ ERROR: Input file not found: $INPUT_FILE"
    exit 1
fi

# Check if keystore exists
if [ ! -f "$KEYSTORE_PATH" ]; then
    echo "❌ ERROR: Keystore file not found: $KEYSTORE_PATH"
    echo ""
    echo "To generate a keystore, run:"
    echo "  keytool -genkey -v -keystore android/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload"
    exit 1
fi

FILE_EXT="${INPUT_FILE##*.}"
OUTPUT_FILE="${INPUT_FILE%.*}-signed.${FILE_EXT}"

echo "Input file: $INPUT_FILE"
echo "Output file: $OUTPUT_FILE"
echo "Keystore: $KEYSTORE_PATH"
echo "Key alias: $KEY_ALIAS"
echo ""

if [ "$FILE_EXT" = "apk" ]; then
    echo "Signing APK..."

    # Try apksigner first (Android SDK tool)
    if command -v apksigner &> /dev/null; then
        echo "Using apksigner..."
        apksigner sign \
            --ks "$KEYSTORE_PATH" \
            --ks-pass "pass:$KEYSTORE_PASSWORD" \
            --ks-key-alias "$KEY_ALIAS" \
            --key-pass "pass:$KEY_PASSWORD" \
            --out "$OUTPUT_FILE" \
            "$INPUT_FILE"

        if [ $? -eq 0 ]; then
            echo "✅ APK signed successfully!"
            echo "   Output: $OUTPUT_FILE"

            # Verify signature
            echo ""
            echo "Verifying signature..."
            apksigner verify --verbose "$OUTPUT_FILE"
        else
            echo "❌ Failed to sign APK"
            exit 1
        fi
    else
        echo "⚠️ apksigner not found. Using jarsigner..."

        # Fallback to jarsigner
        jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
            -keystore "$KEYSTORE_PATH" \
            -storepass "$KEYSTORE_PASSWORD" \
            -keypass "$KEY_PASSWORD" \
            "$INPUT_FILE" \
            "$KEY_ALIAS"

        if [ $? -eq 0 ]; then
            # Rename to signed version
            mv "$INPUT_FILE" "$OUTPUT_FILE"
            echo "✅ APK signed successfully with jarsigner!"
            echo "   Output: $OUTPUT_FILE"

            # Verify
            jarsigner -verify -verbose -certs "$OUTPUT_FILE"
        else
            echo "❌ Failed to sign APK with jarsigner"
            exit 1
        fi
    fi
elif [ "$FILE_EXT" = "aab" ]; then
    echo "Signing AAB (Android App Bundle)..."

    # Sign AAB using jarsigner
    jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
        -keystore "$KEYSTORE_PATH" \
        -storepass "$KEYSTORE_PASSWORD" \
        -keypass "$KEY_PASSWORD" \
        "$INPUT_FILE" \
        "$KEY_ALIAS"

    if [ $? -eq 0 ]; then
        # Rename to signed version
        mv "$INPUT_FILE" "$OUTPUT_FILE"
        echo "✅ AAB signed successfully!"
        echo "   Output: $OUTPUT_FILE"

        # Verify
        echo ""
        echo "Verifying signature..."
        jarsigner -verify -verbose -certs "$OUTPUT_FILE"
    else
        echo "❌ Failed to sign AAB"
        exit 1
    fi
else
    echo "❌ ERROR: Unsupported file type. Expected .apk or .aab"
    exit 1
fi

echo ""
echo "=== Signing Complete ==="
echo "Signed file: $OUTPUT_FILE"

