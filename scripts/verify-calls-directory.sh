#!/bin/bash

# Verification script for src/features/calls/ directory
# This script helps verify changes before they are made

set -e

CALLS_DIR="src/features/calls"
PROTECTED_FILE="${CALLS_DIR}/PROTECTED.md"

echo "🔒 Calls Directory Protection Verification"
echo "=========================================="
echo ""

# Check if protected file exists
if [ ! -f "$PROTECTED_FILE" ]; then
    echo "❌ ERROR: PROTECTED.md not found in ${CALLS_DIR}"
    echo "   This directory should be protected!"
    exit 1
fi

echo "✅ Protection file found: ${PROTECTED_FILE}"
echo ""

# Check for uncommitted changes
if git diff --quiet "${CALLS_DIR}"; then
    echo "✅ No uncommitted changes in ${CALLS_DIR}"
else
    echo "⚠️  WARNING: Uncommitted changes detected in ${CALLS_DIR}"
    echo ""
    echo "Changed files:"
    git diff --name-only "${CALLS_DIR}"
    echo ""
    read -p "Do you want to see the diff? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git diff "${CALLS_DIR}"
    fi
fi

echo ""
echo "📋 Protection Checklist:"
echo "  [ ] Read PROTECTED.md"
echo "  [ ] Read README.md"
echo "  [ ] Understood why change is necessary"
echo "  [ ] Got user confirmation"
echo "  [ ] Reviewed diff preview"
echo "  [ ] Got explicit approval"
echo ""
echo "✅ Verification complete. Proceed with caution!"

