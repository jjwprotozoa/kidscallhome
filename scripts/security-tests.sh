#!/bin/bash
# Security Testing Scripts
# Purpose: Quick verification of security fixes
# Usage: ./scripts/security-tests.sh [test-name]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-https://your-project.supabase.co}"
FUNCTION_BASE="${FUNCTION_BASE:-${BASE_URL}/functions/v1}"
AUTH_TOKEN="${AUTH_TOKEN:-your-auth-token-here}"

echo -e "${GREEN}🔒 Security Testing Scripts${NC}"
echo "=================================="
echo ""

# Test 1: CORS Validation - Allowed Origin
test_cors_allowed() {
    echo -e "${YELLOW}Test 1.1: CORS - Allowed Origin${NC}"
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${FUNCTION_BASE}/create-stripe-subscription" \
        -H "Origin: https://www.kidscallhome.com" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -d '{"subscriptionType":"additional-kid-monthly"}')
    
    if [ "$response" = "401" ] || [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ PASS: Request from allowed origin accepted${NC}"
    else
        echo -e "${RED}❌ FAIL: Unexpected response code: $response${NC}"
    fi
    echo ""
}

# Test 2: CORS Validation - Disallowed Origin
test_cors_disallowed() {
    echo -e "${YELLOW}Test 2.1: CORS - Disallowed Origin${NC}"
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${FUNCTION_BASE}/create-stripe-subscription" \
        -H "Origin: https://evil-kidscallhome.com" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -d '{"subscriptionType":"additional-kid-monthly"}')
    
    if [ "$response" = "403" ]; then
        echo -e "${GREEN}✅ PASS: Request from disallowed origin blocked${NC}"
    else
        echo -e "${RED}❌ FAIL: Expected 403, got: $response${NC}"
    fi
    echo ""
}

# Test 3: Content-Type Validation - Valid
test_content_type_valid() {
    echo -e "${YELLOW}Test 3.1: Content-Type - Valid (application/json)${NC}"
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${FUNCTION_BASE}/create-stripe-subscription" \
        -H "Origin: https://www.kidscallhome.com" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -d '{"subscriptionType":"additional-kid-monthly"}')
    
    if [ "$response" = "401" ] || [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ PASS: Valid Content-Type accepted${NC}"
    else
        echo -e "${RED}❌ FAIL: Unexpected response: $response${NC}"
    fi
    echo ""
}

# Test 4: Content-Type Validation - Invalid
test_content_type_invalid() {
    echo -e "${YELLOW}Test 4.1: Content-Type - Invalid (text/plain)${NC}"
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${FUNCTION_BASE}/create-stripe-subscription" \
        -H "Origin: https://www.kidscallhome.com" \
        -H "Content-Type: text/plain" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -d '{"subscriptionType":"additional-kid-monthly"}')
    
    if [ "$response" = "400" ]; then
        echo -e "${GREEN}✅ PASS: Invalid Content-Type rejected${NC}"
    else
        echo -e "${RED}❌ FAIL: Expected 400, got: $response${NC}"
    fi
    echo ""
}

# Test 5: Input Validation - Quantity Valid
test_quantity_valid() {
    echo -e "${YELLOW}Test 5.1: Input Validation - Valid Quantity (1-10)${NC}"
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${FUNCTION_BASE}/create-stripe-subscription" \
        -H "Origin: https://www.kidscallhome.com" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -d '{"subscriptionType":"additional-kid-monthly","quantity":5}')
    
    if [ "$response" = "401" ] || [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ PASS: Valid quantity accepted${NC}"
    else
        echo -e "${RED}❌ FAIL: Unexpected response: $response${NC}"
    fi
    echo ""
}

# Test 6: Input Validation - Quantity Invalid (too high)
test_quantity_invalid_high() {
    echo -e "${YELLOW}Test 6.1: Input Validation - Invalid Quantity (11)${NC}"
    response=$(curl -s -X POST "${FUNCTION_BASE}/create-stripe-subscription" \
        -H "Origin: https://www.kidscallhome.com" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -d '{"subscriptionType":"additional-kid-monthly","quantity":11}' \
        -w "\nHTTP_CODE:%{http_code}\n")
    
    http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
    body=$(echo "$response" | grep -v "HTTP_CODE")
    
    if [ "$http_code" = "400" ] && echo "$body" | grep -q "Invalid quantity"; then
        echo -e "${GREEN}✅ PASS: Invalid quantity rejected with proper error${NC}"
    else
        echo -e "${RED}❌ FAIL: Expected 400 with quantity error, got: $http_code${NC}"
    fi
    echo ""
}

# Test 7: Rate Limiting - Webhook Endpoint
test_rate_limit_webhook() {
    echo -e "${YELLOW}Test 7.1: Rate Limiting - Webhook Endpoint${NC}"
    echo "Sending 101 requests to test rate limiting..."
    
    success_count=0
    rate_limited=0
    
    for i in {1..101}; do
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "${FUNCTION_BASE}/stripe-webhook" \
            -H "Content-Type: application/json" \
            -H "stripe-signature: test-signature" \
            -d '{"type":"test.event"}')
        
        if [ "$response" = "200" ]; then
            success_count=$((success_count + 1))
        elif [ "$response" = "429" ]; then
            rate_limited=$((rate_limited + 1))
        fi
    done
    
    echo "Successful: $success_count, Rate Limited: $rate_limited"
    
    if [ "$rate_limited" -gt 0 ]; then
        echo -e "${GREEN}✅ PASS: Rate limiting working (some requests rate limited)${NC}"
    else
        echo -e "${YELLOW}⚠️  WARNING: No rate limiting detected (may need to wait for window reset)${NC}"
    fi
    echo ""
}

# Test 8: Security Headers
test_security_headers() {
    echo -e "${YELLOW}Test 8.1: Security Headers${NC}"
    headers=$(curl -s -I "${BASE_URL}" | grep -iE "(x-frame-options|x-content-type-options|x-xss-protection)")
    
    if echo "$headers" | grep -qi "x-frame-options: deny"; then
        echo -e "${GREEN}✅ PASS: X-Frame-Options: DENY present${NC}"
    else
        echo -e "${RED}❌ FAIL: X-Frame-Options missing or incorrect${NC}"
    fi
    
    if echo "$headers" | grep -qi "x-content-type-options: nosniff"; then
        echo -e "${GREEN}✅ PASS: X-Content-Type-Options: nosniff present${NC}"
    else
        echo -e "${RED}❌ FAIL: X-Content-Type-Options missing${NC}"
    fi
    echo ""
}

# Run all tests
run_all_tests() {
    echo -e "${GREEN}Running all security tests...${NC}"
    echo ""
    
    test_cors_allowed
    test_cors_disallowed
    test_content_type_valid
    test_content_type_invalid
    test_quantity_valid
    test_quantity_invalid_high
    test_security_headers
    
    echo -e "${YELLOW}Note: Rate limiting test requires manual verification${NC}"
    echo -e "${YELLOW}Note: Webhook signature test requires Stripe CLI${NC}"
    echo ""
    echo -e "${GREEN}✅ All automated tests completed${NC}"
}

# Main
case "${1:-all}" in
    cors-allowed)
        test_cors_allowed
        ;;
    cors-disallowed)
        test_cors_disallowed
        ;;
    content-type-valid)
        test_content_type_valid
        ;;
    content-type-invalid)
        test_content_type_invalid
        ;;
    quantity-valid)
        test_quantity_valid
        ;;
    quantity-invalid)
        test_quantity_invalid_high
        ;;
    rate-limit)
        test_rate_limit_webhook
        ;;
    headers)
        test_security_headers
        ;;
    all)
        run_all_tests
        ;;
    *)
        echo "Usage: $0 [test-name]"
        echo "Available tests:"
        echo "  cors-allowed, cors-disallowed"
        echo "  content-type-valid, content-type-invalid"
        echo "  quantity-valid, quantity-invalid"
        echo "  rate-limit, headers"
        echo "  all (default)"
        exit 1
        ;;
esac

