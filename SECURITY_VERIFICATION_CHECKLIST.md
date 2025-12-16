# Security Verification Checklist
**Purpose:** Pre-Production Security Testing  
**Date:** 2025-01-XX  
**Status:** ⏳ Pending Verification

---

## 🎯 Overview

This checklist ensures all security fixes are properly tested before production deployment. Complete each section and verify all tests pass.

---

## 1. Webhook Rate Limiting ✅

### Test: Rate Limit Enforcement
- [ ] **Test 1.1:** Send 100 webhook requests within 1 minute
  - **Expected:** All requests succeed (200 OK)
  - **Command:** Use webhook testing tool or script
  - **Verify:** Check response status codes

- [ ] **Test 1.2:** Send 101st webhook request within same minute
  - **Expected:** 429 Too Many Requests
  - **Verify:** Response includes `Retry-After` header
  - **Verify:** Error message: "Rate limit exceeded"

- [ ] **Test 1.3:** Wait 1 minute, send request again
  - **Expected:** Request succeeds (rate limit reset)
  - **Verify:** 200 OK response

### Test: Rate Limit Headers
- [ ] **Test 1.4:** Verify rate limit response headers
  - **Expected:** `Retry-After: <seconds>`
  - **Expected:** `Content-Type: application/json`
  - **Verify:** Headers present and correct

**Status:** ⏳ Not Tested  
**Notes:** _________________________________

---

## 2. CORS Validation ✅

### Test: Allowed Origins
- [ ] **Test 2.1:** Request from `https://www.kidscallhome.com`
  - **Expected:** Request succeeds
  - **Verify:** `Access-Control-Allow-Origin` header matches origin
  - **Verify:** `Access-Control-Allow-Credentials: true`

- [ ] **Test 2.2:** Request from `https://kidscallhome.com`
  - **Expected:** Request succeeds
  - **Verify:** CORS headers present

- [ ] **Test 2.3:** Request from `http://localhost:8080` (dev)
  - **Expected:** Request succeeds (development only)
  - **Verify:** CORS headers present

### Test: Disallowed Origins
- [ ] **Test 2.4:** Request from `https://evil-kidscallhome.com`
  - **Expected:** 403 Forbidden
  - **Verify:** Error message: "Invalid origin"
  - **Verify:** No CORS headers in response

- [ ] **Test 2.5:** Request from `https://attacker.com`
  - **Expected:** 403 Forbidden
  - **Verify:** Request blocked

- [ ] **Test 2.6:** Request with no Origin header
  - **Expected:** Request succeeds (same-origin)
  - **Verify:** No CORS headers (not needed)

**Status:** ⏳ Not Tested  
**Notes:** _________________________________

---

## 3. Content-Type Validation ✅

### Test: Valid Content-Type
- [ ] **Test 3.1:** POST with `Content-Type: application/json`
  - **Expected:** Request succeeds
  - **Test on:** All Edge Functions
    - [ ] `create-stripe-subscription`
    - [ ] `create-customer-portal-session`
    - [ ] `send-family-member-invitation`
  - **Verify:** Request processed normally

### Test: Invalid Content-Type
- [ ] **Test 3.2:** POST with `Content-Type: text/plain`
  - **Expected:** 400 Bad Request
  - **Verify:** Error message: "Invalid Content-Type. Expected application/json"
  - **Test on:** All Edge Functions

- [ ] **Test 3.3:** POST with `Content-Type: application/xml`
  - **Expected:** 400 Bad Request
  - **Verify:** Request rejected

- [ ] **Test 3.4:** POST with no Content-Type header
  - **Expected:** 400 Bad Request
  - **Verify:** Request rejected

- [ ] **Test 3.5:** POST with `Content-Type: application/json; charset=utf-8`
  - **Expected:** Request succeeds (valid variant)
  - **Verify:** Request processed

**Status:** ⏳ Not Tested  
**Notes:** _________________________________

---

## 4. Input Validation ✅

### Test: Quantity Parameter Validation
- [ ] **Test 4.1:** Quantity = 1
  - **Expected:** Request succeeds
  - **Endpoint:** `create-stripe-subscription`
  - **Verify:** Subscription created

- [ ] **Test 4.2:** Quantity = 10 (max)
  - **Expected:** Request succeeds
  - **Verify:** Subscription created with quantity 10

- [ ] **Test 4.3:** Quantity = 0
  - **Expected:** 400 Bad Request
  - **Verify:** Error message mentions quantity validation

- [ ] **Test 4.4:** Quantity = 11 (exceeds max)
  - **Expected:** 400 Bad Request
  - **Verify:** Error: "Invalid quantity. Must be between 1 and 10."

- [ ] **Test 4.5:** Quantity = -1
  - **Expected:** 400 Bad Request
  - **Verify:** Request rejected

- [ ] **Test 4.6:** Quantity = "abc" (non-numeric)
  - **Expected:** 400 Bad Request
  - **Verify:** Request rejected

**Status:** ⏳ Not Tested  
**Notes:** _________________________________

---

## 5. Redirect URL Validation ✅

### Test: Valid Redirect URLs
- [ ] **Test 5.1:** Redirect to `https://www.kidscallhome.com/parent/upgrade`
  - **Expected:** Redirect URL accepted
  - **Endpoint:** `create-stripe-subscription`
  - **Verify:** Stripe checkout uses correct redirect URL

- [ ] **Test 5.2:** Redirect to `https://kidscallhome.com/parent/settings`
  - **Expected:** Redirect URL accepted
  - **Endpoint:** `create-customer-portal-session`
  - **Verify:** Portal session uses correct redirect

### Test: Invalid Redirect URLs
- [ ] **Test 5.3:** Redirect to `https://evil.com/phishing`
  - **Expected:** Redirect URL sanitized to default
  - **Verify:** Uses allowed origin instead
  - **Verify:** No open redirect vulnerability

- [ ] **Test 5.4:** Redirect to `http://attacker.com/steal`
  - **Expected:** Redirect URL sanitized
  - **Verify:** Uses default origin

- [ ] **Test 5.5:** Redirect with no origin header
  - **Expected:** Uses default (localhost for dev)
  - **Verify:** Fallback works correctly

**Status:** ⏳ Not Tested  
**Notes:** _________________________________

---

## 6. Error Message Sanitization ✅

### Test: Generic Error Messages
- [ ] **Test 6.1:** Trigger Stripe API error
  - **Expected:** Generic error to client: "Payment processing failed. Please try again."
  - **Verify:** No internal details exposed
  - **Verify:** Detailed error logged server-side only

- [ ] **Test 6.2:** Trigger database error
  - **Expected:** Generic error: "Internal server error"
  - **Verify:** No stack traces in client response
  - **Verify:** No database connection strings exposed

- [ ] **Test 6.3:** Trigger webhook signature error
  - **Expected:** Generic error: "Webhook signature verification failed"
  - **Verify:** No signature details exposed
  - **Verify:** Detailed error logged server-side

- [ ] **Test 6.4:** Check server logs
  - **Expected:** Detailed errors present in logs
  - **Verify:** Full stack traces available for debugging
  - **Verify:** Sensitive data not logged

**Status:** ⏳ Not Tested  
**Notes:** _________________________________

---

## 7. Security Headers ✅

### Test: X-Frame-Options
- [ ] **Test 7.1:** Check response headers
  - **Expected:** `X-Frame-Options: DENY`
  - **Verify:** Present in all responses
  - **Verify:** Consistent across vercel.json and middleware.ts

- [ ] **Test 7.2:** Attempt to embed page in iframe
  - **Expected:** Browser blocks embedding
  - **Verify:** Clickjacking protection works

### Test: Other Security Headers
- [ ] **Test 7.3:** Verify all security headers present
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-XSS-Protection: 1; mode=block`
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
  - [ ] `Permissions-Policy: camera=(self), microphone=(self)...`
  - **Verify:** All headers present and correct

**Status:** ⏳ Not Tested  
**Notes:** _________________________________

---

## 8. Webhook Signature Verification ✅

### Test: Valid Signatures
- [ ] **Test 8.1:** Send webhook with valid Stripe signature
  - **Expected:** Webhook processed successfully
  - **Verify:** Event handled correctly
  - **Verify:** Database updated appropriately

### Test: Invalid Signatures
- [ ] **Test 8.2:** Send webhook with invalid signature
  - **Expected:** 400 Bad Request
  - **Verify:** Error: "Webhook signature verification failed"
  - **Verify:** Event not processed

- [ ] **Test 8.3:** Send webhook with no signature
  - **Expected:** 400 Bad Request
  - **Verify:** Error: "Missing signature"
  - **Verify:** Request rejected

- [ ] **Test 8.4:** Send webhook with tampered payload
  - **Expected:** 400 Bad Request (signature mismatch)
  - **Verify:** Request rejected

**Status:** ⏳ Not Tested  
**Notes:** _________________________________

---

## 9. Origin Validation (Subdomain Attack) ✅

### Test: Exact Match Validation
- [ ] **Test 9.1:** Request from `https://evil-kidscallhome.com`
  - **Expected:** 403 Forbidden
  - **Verify:** Not accepted (exact match prevents this)
  - **Verify:** Error: "Invalid origin"

- [ ] **Test 9.2:** Request from `https://www.evil-kidscallhome.com`
  - **Expected:** 403 Forbidden
  - **Verify:** Not accepted

- [ ] **Test 9.3:** Request from `https://kidscallhome.com.evil.com`
  - **Expected:** 403 Forbidden
  - **Verify:** Not accepted

**Status:** ⏳ Not Tested  
**Notes:** _________________________________

---

## 10. Integration Tests ✅

### Test: End-to-End Security
- [ ] **Test 10.1:** Complete subscription flow
  - **Steps:**
    1. Authenticate user
    2. Create subscription with valid data
    3. Verify CORS headers present
    4. Verify Content-Type validated
    5. Verify redirect URL validated
  - **Expected:** All security checks pass, subscription created

- [ ] **Test 10.2:** Attempt malicious subscription creation
  - **Steps:**
    1. Try invalid origin
    2. Try invalid Content-Type
    3. Try invalid quantity
    4. Try invalid redirect URL
  - **Expected:** All attempts blocked with appropriate errors

- [ ] **Test 10.3:** Webhook processing flow
  - **Steps:**
    1. Receive valid webhook
    2. Verify signature
    3. Verify rate limiting
    4. Process event
  - **Expected:** Webhook processed securely

**Status:** ⏳ Not Tested  
**Notes:** _________________________________

---

## 📊 Test Results Summary

### Overall Status
- **Total Tests:** 40+
- **Passed:** ___
- **Failed:** ___
- **Skipped:** ___

### Critical Tests
- [ ] Webhook rate limiting: ⏳
- [ ] CORS validation: ⏳
- [ ] Content-Type validation: ⏳
- [ ] Input validation: ⏳
- [ ] Error sanitization: ⏳

### Test Environment
- **Environment:** [ ] Staging [ ] Production
- **Date Tested:** ___________
- **Tested By:** ___________
- **Reviewer:** ___________

---

## ✅ Sign-Off

### Pre-Production Approval
- [ ] All critical tests passed
- [ ] All high-priority tests passed
- [ ] Security review completed
- [ ] Code review completed
- [ ] Documentation reviewed

**Approved By:** _________________  
**Date:** _________________  
**Signature:** _________________

---

## 📝 Notes

**Issues Found:**
_________________________________
_________________________________
_________________________________

**Remediation:**
_________________________________
_________________________________
_________________________________

---

## 🔗 Related Documents

- **Security Audit:** `SECURITY_REVIEW_REPORT.md`
- **Release Notes:** `SECURITY_RELEASE_NOTES.md`
- **Fixes Applied:** `SECURITY_FIXES_APPLIED.md`
- **Remaining Fixes:** `SECURITY_FIXES_REMAINING_ISSUES.md`

---

**Next Steps After Verification:**
1. ✅ Complete all test cases
2. ✅ Document any issues found
3. ✅ Remediate any failures
4. ✅ Re-test failed cases
5. ✅ Obtain sign-off
6. ✅ Deploy to production
7. ✅ Monitor for security events

---

*This checklist ensures comprehensive security testing before production deployment. Complete all sections and verify all tests pass before proceeding.*

