# App Store & Play Store Submission Checklist

**Last Updated:** January 2025  
**App Version:** 1.0  
**Status:** Ready for Review

---

## ✅ 1. Legal & Compliance Pages

### Info/Legal Page (`/info`)
- [x] **App Description** - Complete with features and use cases
- [x] **Pricing/Subscription Terms** - Clear pricing tiers and free tier information
- [x] **Terms and Conditions** - Comprehensive terms covering account responsibility, acceptable use, service availability, age requirements, and liability
- [x] **Privacy Policy** - Detailed privacy policy covering:
  - [x] Data collection (account info, child profiles, device info, call/message data)
  - [x] Data usage (service provision, no third-party sales)
  - [x] Data storage (Supabase with encryption at rest)
  - [x] Children's privacy (COPPA compliance)
  - [x] Data access/correction/deletion procedures
- [x] **Cancellation Policy** - Clear instructions on how to cancel subscriptions
- [x] **Personal Data Removal** - Detailed procedure for account deletion and data removal
- [x] **Contact & Support** - Support email and common support topics
- [x] **Demo/Test Account Info** - Information for app store reviewers

### Accessibility
- [x] Info page accessible without login (`/info` route is public)
- [x] Link to Info page from landing page (`/`)
- [x] Navigation menu includes access to Info page

---

## ✅ 2. Privacy & Consent

### GDPR/Privacy Consent
- [x] Cookie consent banner implemented (`CookieConsent.tsx`)
- [x] Consent stored in localStorage with version tracking
- [x] Users can accept, decline, or learn more
- [x] Links to Privacy Policy section on Info page
- [x] Non-intrusive banner (appears after 1 second delay)

### Data Protection
- [x] COPPA compliance mentioned in Privacy Policy
- [x] Clear data deletion procedures documented
- [x] Support contact for data requests provided

---

## ✅ 3. Permissions & User Experience

### App Permissions
- [x] **Camera** - Required for video calls
  - Permission requested via `getUserMedia` API
  - Error messages explain why permission is needed
  - iOS-specific guidance provided in error messages
- [x] **Microphone** - Required for video calls
  - Permission requested via `getUserMedia` API
  - Error messages explain why permission is needed
- [x] **Notifications** - Required for incoming calls and messages
  - Declared in `manifest.json`
  - Permission requested when needed

### Permission Explanations
- [x] Error messages explain why permissions are needed
- [x] Browser-specific guidance (iOS Safari HTTPS requirement)
- [x] Clear instructions for users who deny permissions

**Note:** Permissions are requested contextually when users initiate calls, which is standard practice for WebRTC apps.

---

## ✅ 4. Core Features Verification

### Call Engine (Protected - No Changes Made)
- [x] Video calls working
- [x] Audio calls working
- [x] Ringing/notification system working
- [x] Call controls functional
- [x] WebRTC connection handling intact

### Messaging
- [x] Real-time messaging functional
- [x] Message notifications working

### Authentication
- [x] Parent authentication working
- [x] Child login codes working
- [x] Session management functional

---

## ✅ 5. Store Listing Assets

### App Icons
- [x] `icon-96x96.png` - 96x96px icon
- [x] `icon-192x192.png` - 192x192px icon
- [x] `icon-512x512.png` - 512x512px icon
- [x] All icons are maskable (suitable for adaptive icons)

### Screenshots
- [ ] **TODO:** Prepare screenshots for store listings:
  - [ ] iPhone screenshots (various sizes)
  - [ ] iPad screenshots
  - [ ] Android phone screenshots
  - [ ] Android tablet screenshots
  - [ ] Feature screenshots (video call, messaging, parent dashboard)

### App Description (for stores)
- [x] Short description: "Stay connected with your family through simple video calls and messaging."
- [x] Full description available in Info page
- [x] Key features listed:
  - Video calls between parents and children
  - Secure messaging
  - Simple login codes for kids
  - Parent account management
  - Real-time notifications
  - Mobile-friendly interface
  - Progressive Web App (PWA)
  - Works without SIM card or phone number
  - Low-bandwidth optimization

### Keywords
- [x] SEO keywords defined in `index.html`
- [x] Relevant keywords for app store optimization

---

## ✅ 6. Technical Requirements

### PWA Manifest
- [x] `manifest.json` configured
- [x] App name, short name, description set
- [x] Icons defined
- [x] Start URL configured
- [x] Display mode set to "standalone"
- [x] Theme color defined
- [x] Permissions declared

### Meta Tags
- [x] Viewport configured with safe-area support
- [x] Theme color meta tags
- [x] Apple mobile web app meta tags
- [x] Open Graph tags
- [x] Twitter Card tags
- [x] Structured data (JSON-LD)

### Responsive Design
- [x] Mobile-first design
- [x] Tablet support
- [x] Desktop support
- [x] Safe-area insets respected
- [x] Touch-friendly UI elements

---

## ✅ 7. Content & Localization

### Language
- [x] English (US) - Primary language
- [ ] **TODO:** Consider adding additional languages if targeting international markets

### Content Accuracy
- [x] All descriptions accurate
- [x] Pricing information matches actual subscription plans
- [x] Feature list matches actual functionality
- [x] Support contact information correct

---

## ✅ 8. Testing Checklist

### Cross-Device Testing
- [ ] **TODO:** Test on iPhone (various iOS versions)
- [ ] **TODO:** Test on iPad
- [ ] **TODO:** Test on Android phones (various versions)
- [ ] **TODO:** Test on Android tablets
- [ ] **TODO:** Test on Chromebooks
- [ ] **TODO:** Test on Kindle Fire devices

### Browser Testing
- [ ] **TODO:** Test on Safari (iOS)
- [ ] **TODO:** Test on Chrome (Android)
- [ ] **TODO:** Test on Chrome (Desktop)
- [ ] **TODO:** Test on Firefox
- [ ] **TODO:** Test on Edge

### Feature Testing
- [x] Info page loads without login
- [x] All sections scrollable and accessible
- [x] Navigation links work
- [x] Cookie consent banner appears and functions
- [x] Links to Info page from landing page work
- [ ] **TODO:** Test video calls on multiple devices
- [ ] **TODO:** Test messaging on multiple devices
- [ ] **TODO:** Test notifications on multiple devices

### Responsive Layout Testing
- [ ] **TODO:** Test Info page on small screens (< 375px)
- [ ] **TODO:** Test Info page on medium screens (768px)
- [ ] **TODO:** Test Info page on large screens (> 1024px)
- [ ] **TODO:** Verify no horizontal scrolling issues
- [ ] **TODO:** Verify text readability on all sizes

---

## ✅ 9. App Store Specific Requirements

### Apple App Store
- [x] Privacy Policy URL: `/info#privacy`
- [x] Terms of Service URL: `/info#terms`
- [x] Support URL: `/info#contact`
- [x] App description prepared
- [x] Pricing information clear
- [x] Age rating considerations (family-friendly app)
- [ ] **TODO:** Prepare App Store screenshots
- [ ] **TODO:** Prepare App Store preview video (optional)
- [ ] **TODO:** Set up App Store Connect account
- [ ] **TODO:** Configure in-app purchase products (if using native subscriptions)

### Google Play Store
- [x] Privacy Policy URL: `/info#privacy`
- [x] Terms of Service URL: `/info#terms`
- [x] Support URL: `/info#contact`
- [x] App description prepared
- [x] Pricing information clear
- [x] Content rating considerations (family-friendly app)
- [ ] **TODO:** Prepare Play Store screenshots
- [ ] **TODO:** Prepare Play Store feature graphic
- [ ] **TODO:** Set up Google Play Console account
- [ ] **TODO:** Configure in-app purchase products (if using native subscriptions)

---

## ✅ 10. Security & Privacy Compliance

### Data Security
- [x] HTTPS required (enforced by WebRTC)
- [x] Data encrypted at rest (Supabase)
- [x] Secure authentication (Supabase Auth)
- [x] No sensitive data in client-side code

### Privacy Compliance
- [x] GDPR considerations (cookie consent)
- [x] COPPA compliance (children's privacy)
- [x] Clear data collection disclosure
- [x] Data deletion procedures documented
- [x] No third-party tracking (as stated in Privacy Policy)

---

## 📋 Pre-Submission Final Checks

### Before Submitting to Stores:

1. [ ] **Screenshots Prepared**
   - Create screenshots for all required device sizes
   - Ensure screenshots show key features
   - Verify screenshots are high quality

2. [ ] **Test Accounts Ready**
   - Prepare test account credentials for reviewers
   - Document test account information in Info page

3. [ ] [ ] **Cross-Device Testing Complete**
   - Test on minimum 3 different devices
   - Verify all features work on each device
   - Check for layout issues

4. [ ] **Content Review**
   - Proofread all text on Info page
   - Verify all links work
   - Ensure pricing is accurate

5. [ ] **Legal Review** (if applicable)
   - Have legal team review Terms & Conditions
   - Have legal team review Privacy Policy
   - Ensure compliance with local regulations

6. [ ] **Support Readiness**
   - Support email monitored
   - Support documentation ready
   - Response time expectations set

---

## 🚀 Submission Notes

### App Store Submission
- **Category:** Communication / Social Networking
- **Age Rating:** 4+ (Family-friendly)
- **Content Rating:** Safe for children
- **In-App Purchases:** Yes (subscriptions)
- **Free Tier:** Yes (1 parent + 1 child free)

### Play Store Submission
- **Category:** Communication
- **Content Rating:** Everyone
- **In-App Purchases:** Yes (subscriptions)
- **Free Tier:** Yes (1 parent + 1 child free)

---

## 📝 Post-Submission

After submission, monitor:
- [ ] App Store review status
- [ ] Play Store review status
- [ ] User feedback and reviews
- [ ] Support requests
- [ ] Crash reports (if any)
- [ ] Performance metrics

---

## ✅ Summary

**Status:** ✅ Ready for submission pending:
1. Screenshot preparation
2. Cross-device testing
3. Final content review

**Key Strengths:**
- Comprehensive legal pages
- GDPR/privacy consent implemented
- Clear pricing and subscription terms
- Detailed privacy policy
- Accessible without login

**Remaining Tasks:**
- Prepare store listing screenshots
- Complete cross-device testing
- Final content review

---

**Last Review Date:** January 2025  
**Next Review Date:** After store submission

