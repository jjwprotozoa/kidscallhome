#!/bin/bash
# Stripe Webhook Testing Script
# Purpose: Test webhook signature verification using Stripe CLI
# Prerequisites: Stripe CLI installed and authenticated

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🔒 Stripe Webhook Security Testing${NC}"
echo "======================================"
echo ""

# Configuration
WEBHOOK_URL="${WEBHOOK_URL:-https://your-project.supabase.co/functions/v1/stripe-webhook}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-whsec_your_webhook_secret}"

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo -e "${RED}❌ Stripe CLI not found${NC}"
    echo "Install from: https://stripe.com/docs/stripe-cli"
    exit 1
fi

echo -e "${YELLOW}Test 1: Valid Webhook Signature${NC}"
echo "Sending test webhook with valid signature..."
echo ""

# Test 1: Valid signature
stripe listen --forward-to "${WEBHOOK_URL}" \
    --events checkout.session.completed \
    --print-secret

echo ""
echo -e "${GREEN}✅ If webhook was received and processed, signature verification is working${NC}"
echo ""

# Test 2: Invalid signature (manual test)
echo -e "${YELLOW}Test 2: Invalid Webhook Signature${NC}"
echo "To test invalid signature rejection:"
echo ""
echo "1. Send a webhook with a tampered signature:"
echo "   curl -X POST ${WEBHOOK_URL} \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'stripe-signature: t=1234567890,v1=invalid_signature' \\"
echo "     -d '{\"type\":\"test.event\"}'"
echo ""
echo "2. Expected response: 400 Bad Request"
echo "3. Expected error: 'Webhook signature verification failed'"
echo ""

# Test 3: Missing signature
echo -e "${YELLOW}Test 3: Missing Webhook Signature${NC}"
echo "Testing webhook without signature header..."
echo ""

response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${WEBHOOK_URL}" \
    -H "Content-Type: application/json" \
    -d '{"type":"test.event"}')

if [ "$response" = "400" ]; then
    echo -e "${GREEN}✅ PASS: Missing signature rejected (400)${NC}"
else
    echo -e "${RED}❌ FAIL: Expected 400, got: $response${NC}"
fi
echo ""

# Test 4: Rate limiting
echo -e "${YELLOW}Test 4: Webhook Rate Limiting${NC}"
echo "Sending 101 requests to test rate limiting..."
echo ""

success=0
rate_limited=0

for i in {1..101}; do
    # Create a test signature (this will fail verification but tests rate limiting)
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${WEBHOOK_URL}" \
        -H "Content-Type: application/json" \
        -H "stripe-signature: t=$(date +%s),v1=test_signature" \
        -d '{"type":"test.event"}')
    
    if [ "$response" = "429" ]; then
        rate_limited=$((rate_limited + 1))
    elif [ "$response" = "400" ]; then
        success=$((success + 1))
    fi
done

echo "Requests processed: $success"
echo "Rate limited: $rate_limited"

if [ "$rate_limited" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS: Rate limiting is working${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Rate limiting may not be triggered (window may have reset)${NC}"
fi
echo ""

echo -e "${GREEN}✅ Webhook security tests completed${NC}"
echo ""
echo "For more comprehensive testing, use Stripe CLI:"
echo "  stripe listen --forward-to ${WEBHOOK_URL}"
echo "  stripe trigger checkout.session.completed"

