# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed - 2026-01-04

#### Homepage Modularization and Content Updates
- **Modularized homepage components**: Broke down large `Index.tsx` file (960+ lines) into smaller, maintainable components
  - Created `src/pages/HomePage/` directory with 13 focused components
  - Reduced main `Index.tsx` to ~365 lines (62% reduction)
  - Each section now has its own component file for better organization and reusability
  - Components: `HomePageNav`, `HeroSection`, `IfThisSoundsFamiliarSection`, `FounderStorySection`, `ComparisonTableSection`, `TrustSecuritySection`, `AppAvailabilitySection`, `TestimonialsSection`, `ProblemsWeSolveSection`, `ParentsSection`, `HowItWorksSection`, `DeviceCompatibilitySection`, `PricingSection`
- **Enhanced navigation bar**: Added fixed top navigation with improved login flow
  - "Log in" button opens modal with two cards: Child Login and Parent/Family Member Login
  - "Get started" button navigates directly to signup page
  - Modal uses app's gradient background for visual consistency
  - Buttons styled with outline variant for "Log in" and primary variant for "Get started"
- **Updated all CTA buttons**: All "Get started" buttons now navigate to signup page with `?mode=signup` parameter
  - Hero section "Get started free" button
  - Navigation "Get started" button
  - Parents section "Get started free" button
  - Ensures users see signup form by default instead of login form
- **Files**:
  - `src/pages/Index.tsx` - Refactored to use modular components
  - `src/pages/HomePage/` - New directory with 13 component files (NEW)
  - `src/pages/HomePage/index.ts` - Barrel export file for clean imports
  - `src/pages/ParentAuth/ParentAuth.tsx` - Added signup mode detection from URL parameter

#### Mobile Signup Page Optimization
- **Fixed mobile viewport issues**: Optimized signup page to fit all content on mobile screens without scrolling
  - Reduced container padding on mobile (`pt-4` instead of `pt-safe`, `pb-4` instead of `pb-8`)
  - Made card padding responsive (`p-4 sm:p-6 md:p-8`)
  - Reduced spacing between elements (`space-y-4 sm:space-y-6` on card, `space-y-1.5 sm:space-y-2` on form fields)
  - Smaller header elements on mobile (logo `h-10`, title `text-2xl`)
  - Reduced trust signal spacing and bottom link text size
  - Changed container alignment from `items-center` to `justify-start` for better top alignment
  - "Already have an account? Sign in" link now visible without scrolling
- **Files**:
  - `src/pages/ParentAuth/ParentAuth.tsx` - Optimized spacing and padding for mobile
  - `src/pages/ParentAuth/SignupForm.tsx` - Reduced form field spacing on mobile

### Changed - 2026-01-02

#### Parent Login Page Redesign and Copy Updates
- **Enhanced login page visual design**: Improved parent authentication page (`/parent/auth`) with better visual grounding and depth
  - Added soft vertical background gradient for structured, anchored feel
  - Introduced subtle vignette effect and depth cues to separate foreground from background
  - Adjusted vertical spacing to position card higher while respecting safe area insets (iOS/Android)
  - Enhanced card shadow and border for better visual separation
  - Card now feels intentionally placed rather than floating in empty space
- **Updated login page copy and messaging**:
  - Replaced generic welcome message with clear value proposition: "Sign in to your family-only calling and messaging account for kids"
  - Added supporting line about tablets/Wi‑Fi devices, no SIM card or social media needed
  - Added helper text under Email field: "Use the email you were invited with (parent or family member)"
  - Added helper text under Password field explaining Kids Call Home password and magic links for kids
  - Added helper text under "Stay signed in" checkbox: "Only on your own trusted device"
  - Added reassurance line below Sign In button: "Encrypted calls and messages. No ads. No public profiles or stranger contact"
  - Added role explanation: "Parents create the family account and approve all contacts. Grandparents and other family members sign in with the email they're invited with"
- **Added informational links to /info page**:
  - Two button-style links at bottom of login card linking to key /info sections
  - "How Kids Call Home keeps kids safer than typical messaging apps" → `/info#trust`
  - "Does it work on tablets and Wi‑Fi devices without a SIM card?" → `/info#description`
  - Links styled as subtle ghost buttons with borders and improved hover states for better contrast
- **Polish improvements**:
  - Improved line-height (`leading-relaxed`) for all helper text to enhance readability on smaller screens
  - Reduced info button size and spacing to keep focus on primary Sign In button
  - Used non-breaking space to prevent awkward line breaks in link text
- **Files**:
  - `src/pages/ParentAuth/ParentAuth.tsx` - Updated layout, background, heading copy, and info links
  - `src/pages/ParentAuth/LoginForm.tsx` - Added helper text, reassurance messaging, and improved typography

### Fixed - 2026-01-02

#### Nested Form Warning in AddChildDialog
- **Fixed React DOM nesting warning**: Resolved "validateDOMNesting(...): <form> cannot appear as a descendant of <form>" warning in AddChildDialog
  - Changed `ChildForm` component from using `<form>` tag to `<div>` tag since the parent `AddChildDialog` already wraps the form in a `<form>` element
  - Form submission is still handled correctly by the parent component's `onSubmit` handler
  - Eliminates console warning while maintaining all form functionality
- **Files**:
  - `src/components/AddChildDialog/ChildForm.tsx` - Changed form wrapper to div element

#### Referral Page Not Loading Data
- **Fixed referral code and referral history not displaying**: Resolved issue where `/parent/referrals` page was not showing referral code or referral list
  - Enhanced error handling in `loadReferralData` function with better logging and null checks
  - Added proper JSONB response handling (parses string if needed, uses object directly otherwise)
  - Improved error state UI with retry button when data fails to load
  - Added explicit null state handling to prevent UI from showing incorrect data
  - Enhanced loading states with better user feedback
- **Files**:
  - `src/features/referrals/components/ReferralsTab.tsx` - Improved error handling and data loading logic

### Changed - 2026-01-02

#### Enhanced Popup Blocked Notification
- **Browser-specific popup enable instructions**: When social sharing popups are blocked, users now see detailed instructions specific to their browser
  - Detects browser type (Chrome, Edge, Firefox, Safari) and device type (desktop/mobile)
  - Shows step-by-step instructions for enabling popups in the detected browser
  - Instructions formatted in a code-style box for clarity
  - Added "Copy Link" action button as fallback option
  - Extended toast duration to 10 seconds so users have time to read instructions
- **Improved error handling**: Better error messages and fallback options when popups are blocked
- **Files**:
  - `src/utils/browserUtils.ts` - New browser detection utility (NEW)
  - `src/components/ShareModal.tsx` - Enhanced popup blocked notification
  - `src/features/referrals/components/SocialShareButtons.tsx` - Enhanced popup blocked notification

#### Referral History Display Improvements
- **Enhanced referral history to show both signed up and subscribed dates**: Referral history now displays both milestones when applicable
  - Shows "Signed up" date for anyone who has moved past "pending" status
  - Shows "Subscribed" date when status is "subscribed" or "credited"
  - For "credited" status, uses `credited_at` timestamp for accurate subscribed date
  - For "subscribed" status (not yet credited), uses `created_at` as fallback
  - Makes referral progression clear: users can see when someone signed up AND when they subscribed
- **Files**:
  - `src/features/referrals/components/ReferralsTab.tsx` - Enhanced date display logic in referral history

### Changed - 2026-01-02

#### Referral Auth Page - Learn More Before Signup
- **Added "Learn More" section on referral signup page**: Parents visiting `/parent/auth?ref=CODE` now see an informational banner with a link to the home page
  - Appears only when a referral code is present and user is in signup mode
  - Includes clear messaging that the referral code will be saved if they navigate away
  - Provides "Visit Home Page" button to explore the app before committing to signup
  - Uses blue info banner design to distinguish from the green referral code indicator
  - Helps improve conversion by allowing parents to learn about the app before signing up
- **Files**:
  - `src/pages/ParentAuth/ParentAuth.tsx` - Added Learn More section with home page link

#### Referral System Improvements
- **Unified Referral Attribution**: Top navigation Share button and Referrals page now generate identical referral links with `source` parameter for analytics tracking
  - Top nav share uses `source=top_nav_share`
  - Referrals page share uses `source=referrals_page`
  - Both methods count toward the same referral tracking
- **Enhanced Referral Lifecycle Display**: Added clear lifecycle states and visual indicators
  - **Lifecycle States**: Signed up → Subscribed → Reward credited
  - **Referral History UI**: Shows masked email, "Signed up" date, "Subscribed" date (when available), and status badges
  - **Status Badges**: "Signed Up" (neutral), "Subscribed" (success), "Reward Credited" (success)
  - **Summary Counters**: Updated labels to clarify Total Referrals (all signups), Pending (not subscribed), Completed (subscribed), Weeks Earned (reward credited)
- **Updated Copy**: "How it works" section now clarifies that rewards happen when referred users subscribe to the Family Plan, not just when they sign up
- **Centralized Share Messages**: Created shared `shareMessages.ts` module for consistent messaging across all share methods
  - All share methods (Share Link, Copy Message, WhatsApp, Facebook, Twitter/X, Email) now include full referral URLs with `ref` and `source` parameters
  - Messages clarify that 1 week free is for subscribing to the Family Plan, not just creating an account
  - ShareModal and SocialShareButtons now use the same message templates
- **Files**:
  - `src/features/referrals/utils/referralHelpers.ts` - Centralized referral link generation
  - `src/features/referrals/utils/shareMessages.ts` - Shared share message module (NEW)
  - `src/features/referrals/components/ReferralsTab.tsx` - Updated history UI and counters
  - `src/components/ShareModal.tsx` - Uses referral links and shared messages
  - `src/components/Navigation.tsx` - Fetches and passes referral code to ShareModal
  - `src/features/referrals/components/SocialShareButtons.tsx` - Uses shared messages
  - `src/integrations/supabase/types.ts` - Added referral function types

### Fixed - 2026-01-02

#### Share Message Encoding and Facebook Sharing
- **Removed all emojis from share messages**: Eliminated encoding issues causing garbled characters () when sharing across platforms
  - WhatsApp messages: Removed all emojis (📱💚, ✨, 🎁, 👉, 👨‍👩‍👧‍👦💕) while preserving bold text formatting (`*text*`)
  - Facebook, Twitter, Email, Native Share, and General Share messages: Already cleaned of problematic emojis
  - All messages now use plain text with bullet points and formatting that renders consistently across all platforms
- **Fixed Facebook sharing message not appearing**: Facebook's sharer no longer supports pre-filled text via URL parameters
  - Now automatically copies the Facebook message to clipboard when user clicks Facebook share button
  - Opens Facebook share dialog with URL, and shows toast notification instructing user to paste the message
  - Provides same user experience as WhatsApp (message ready to paste) while working within Facebook's limitations
- **Verified Open Graph configuration**: Confirmed proper Open Graph meta tags for social sharing
  - `og:image` correctly points to `/og/kidscallhome-og.png` (1200x630px)
  - All required Open Graph properties configured (title, description, image, site_name, locale)
  - App icon properly referenced for PWA and social sharing
- **Files**:
  - `src/features/referrals/utils/shareMessages.ts` - Removed all emojis, added platform-specific comments
  - `src/components/ShareModal.tsx` - Updated Facebook share to copy message to clipboard
  - `src/features/referrals/components/SocialShareButtons.tsx` - Updated Facebook share to copy message to clipboard

#### Invalid Route Navigation Errors
- **Fixed `/parent/undefined` route error when typing in email/password fields**: Resolved issue where typing in authentication form fields triggered navigation to invalid routes
  - Added validation in `prefetchRoute()` to skip routes containing "undefined" values
  - Added validation in route prefetching event handlers to prevent prefetching invalid routes
  - Added validation in navigation handlers (`NativeNotificationHandler`, `WidgetIntentHandler`) to ensure variables are defined before constructing routes
  - Updated `NotFound` component to automatically redirect away from invalid routes with "undefined" instead of showing 404 errors
  - Prevents console errors and navigation attempts to malformed routes
- **Files**: `src/utils/routePrefetch.ts`, `src/App.tsx`, `src/pages/NotFound.tsx`

#### Browser Extension Autofill Errors
- **Suppressed browser extension autofill errors in console**: Added global error handlers to suppress harmless errors from password manager and autofill browser extensions
  - Added unhandled promise rejection handler to suppress `bootstrap-autofill-overlay.js` errors
  - Errors occur when browser extensions try to manipulate DOM while React is re-rendering
  - These errors are harmless and don't affect app functionality - they're just console noise
  - Legitimate app errors are still logged normally
  - Enhanced email input with `data-form-type` and `data-autofill-safe` attributes for better extension compatibility
- **Files**: `src/main.tsx`, `src/components/auth/EmailInputWithBreachCheck.tsx`

#### Navigation Component Router Context Error
- **Fixed `useNavigate()` error in NativeNotificationHandler**: Moved `NativeNotificationHandler` component inside `BrowserRouter` to fix "useNavigate() may be used only in the context of a <Router> component" error
  - Component was being rendered before Router was initialized
  - Now renders inside Router context, allowing proper navigation functionality
- **Made referral code fetch non-blocking**: Referral code loading no longer blocks navigation rendering
  - Uses setTimeout to ensure async fetch doesn't delay initial render
  - Improved error handling to prevent crashes
- **Files**: `src/App.tsx`, `src/components/Navigation.tsx`

### Changed - 2026-01-02

#### Native App Subscription Management (iOS/Android)
- **Updated Upgrade page for iOS/Android**: Native app users now see app store-specific subscription management instructions instead of Stripe checkout
  - iOS users see step-by-step instructions to manage subscriptions through App Store
  - Android users see step-by-step instructions to manage subscriptions through Google Play Store
  - Current plan information is still displayed (read-only)
  - Pricing plans and Stripe payment options are hidden for native apps
  - Web/PWA users continue to see full Stripe-based subscription management with pricing plans
- **Why**: iOS and Android require subscriptions to be managed through their respective app stores per platform policies. Web/PWA users can still use Stripe checkout directly.
- **Files**: `src/pages/Upgrade/Upgrade.tsx`

### Fixed - 2026-01-02

#### Child Addition Not Visible on iOS/Android
- **Fixed child not appearing after adding on mobile devices**: Resolved issue where children added on iOS/Android were not immediately visible on the `/parent/children` page
  - Made `onChildAdded` callback async and properly awaited in `AddChildDialog` to ensure refresh completes
  - Added real-time Supabase subscription to automatically update children list when changes occur (INSERT/UPDATE/DELETE)
  - Implemented mobile-specific retry mechanism with delay to handle database replication lag on iOS/Android
    - 300ms initial delay before first fetch
    - Automatic retry after 1 second as fallback
    - Works alongside real-time subscription for immediate updates
  - **Files**: `src/components/AddChildDialog/AddChildDialog.tsx`, `src/components/AddChildDialog/types.ts`, `src/pages/ParentChildrenList.tsx`

### Fixed - 2026-01-02

#### Stripe Webhook Integration Fix
- **Fixed Stripe webhook returning 401 "Missing authorization header"**: Supabase Edge Functions enforce JWT verification by default, but Stripe webhooks don't send JWTs
  - Deployed `stripe-webhook` function with `--no-verify-jwt` flag to disable JWT requirement
  - Webhook now relies solely on Stripe signature verification for security (which is the correct approach)
- **Fixed webhook signature verification**: Ensured `STRIPE_WEBHOOK_SECRET_TEST` matches the actual Stripe test mode webhook signing secret
- **Verified user_id extraction**: Webhook correctly extracts `user_id` from checkout session's `client_reference_id` and `metadata.user_id`
- **End-to-end subscription flow now working**:
  - User completes Stripe Checkout → Webhook receives event → `billing_subscriptions` table updated → Frontend displays subscription status
  - "Manage Subscription" button opens Stripe Customer Portal
  - Current plan badge shows on active subscription
- **Files**: `supabase/functions/stripe-webhook/index.ts`, `supabase/config.toml`

### Added - 2026-01-02

#### Comprehensive Analytics Tracking System
- **New Analytics Utility** (`src/utils/analytics.ts`): Created comprehensive GA4-compatible analytics module with 50+ trackable events organized by AARRR metrics:
  - **Acquisition**: `page_view`, `landing_page_view`, `seo_page_view`
  - **Activation**: `signup_started`, `signup_complete`, `email_verified`, `child_added`, `first_call_made`, `first_message_sent`, `family_setup_complete`
  - **Engagement**: `call_started`, `call_completed`, `call_duration`, `message_sent`, `family_member_invited`, `family_member_joined`, `child_login_success/failed`, `device_authorized`, `pwa_installed`
  - **Revenue**: `pricing_viewed`, `upgrade_started`, `subscription_started`, `subscription_renewed`, `subscription_cancelled`
  - **Referral**: `referral_link_copied/shared`, `referral_signup`, `referral_converted`
  - **Technical**: `call_failed`, `call_quality_poor`, `webrtc_error`, `network_error`, `permission_denied`, `error_occurred`
- **Key Features**:
  - Cookie consent aware (respects user's analytics preferences)
  - GA4 compatible with gtag format and dataLayer fallback
  - Full TypeScript types for all events and parameters
  - Non-blocking (analytics never breaks the app)
  - Dev logging in development mode for debugging
  - User properties and user ID support for segmentation

#### Analytics Integration Across App
- **Signup Flow** (`authHandlers.ts`): Added `trackSignupStarted`, `trackSignupComplete`, `trackReferralSignup`, `trackAppOpened`
- **Call Screens** (`ParentCallScreen.tsx`, `ChildCallScreen.tsx`): Added `trackCallStarted`, `trackCallCompleted`, `trackCallFailed` with duration tracking
- **Subscriptions** (`usePaymentHandlers.ts`): Added `trackUpgradeStarted`, `trackSubscriptionStarted`
- **Messaging** (`useMessageSending.ts`): Added `trackMessageSent` with sender type
- **Family Management** (`AddFamilyMemberDialog.tsx`): Added `trackFamilyMemberInvited`
- **Child Creation** (`AddChildDialog.tsx`): Added `trackChildAdded` with child count
- **Pricing Page** (`Pricing.tsx`): Added `trackPricingViewed`

### Changed - 2026-01-02

#### Privacy Statement Updates for Analytics Transparency
- **Updated privacy messaging across all pages** to accurately reflect analytics usage:
  - Analytics is used for app improvement, never for advertising or selling data
  - Added explicit mention of Google Analytics usage
  - Reframed "What We Don't Collect" to "What We Don't Do With Your Data" for accuracy
- **Files Updated**:
  - `src/components/info/TrustSignalsSection.tsx`: Updated data collection description, added analytics disclosure
  - `src/components/info/ExpandedFAQ.tsx`: Updated FAQ answers about data collection and privacy
  - `src/components/info/PrivacySection.tsx`: Added analytics to data collection list, explained analytics purpose
  - `src/pages/Privacy.tsx`: Added analytics disclosure, updated protection section
  - `src/pages/Index.tsx`: Updated privacy claim to mention analytics for improvement

### Fixed - 2026-01-01

#### Vercel Analytics & Speed Insights SPA Tracking Hardening
- **Moved Analytics inside BrowserRouter**: Relocated `<Analytics />` and `<SpeedInsights />` from outside to inside `<BrowserRouter>` to reliably track SPA route changes
  - Components now render before `<Routes>` in the router tree, ensuring all navigations are observed
  - Preserves existing debug flag behavior: `localStorage.setItem("debug_analytics", "1")`
- **Service Worker Analytics Bypass Hardened**:
  - Changed hostname matching from loose `.includes()` to strict `hostname === domain || hostname.endsWith('.' + domain)` to prevent spoofing
  - Analytics bypass now returns explicit Response via `event.respondWith(fetch(event.request))` instead of bare `return;` to avoid intermittent failures in some browsers
  - Removed unnecessary GA domains from bypass list (GA loads from index.html, not intercepted by SW)
- **Zero-Cost Debug Helper**: Added `AnalyticsDebugHelper` component that logs mount and route changes only when `debug_analytics=1`
  - Uses component splitting pattern to avoid `useLocation()` subscription when disabled
  - Truly zero overhead in production when debug flag is not set
- **Files**: `src/App.tsx`, `public/sw.js`

### Changed - 2026-01-01

#### Kid-Friendly Emoji Logout Game
- **Replaced Triple Confirmation Logout**: Replaced text-heavy triple confirmation dialog with fun emoji-based mini-game for child logout
  - **3-Step Emoji Hunt**: Kids find specific emojis (🚪 door → 👋 wave → 💜 purple heart) instead of reading text dialogs
  - **Visual Features**: Large 3x3 emoji grid, colorful gradients per step, progress dots, shuffled emojis each time
  - **Feedback System**: Shake animation on wrong tap, green highlight on correct tap
  - **Easy Cancellation**: Big "Stay Here! 🏠" button, X button, tap backdrop to close
- **Why**: Previous text-heavy dialogs were difficult for pre-readers and younger kids; new game-like interaction is accessible and fun while still preventing accidental logouts
- **Files**: New `src/components/ChildLogoutDialog.tsx`, updated `src/components/Navigation.tsx`

### Fixed - 2026-01-01

#### Family Member Messaging Fixes
- **Fixed 409 Error When Family Member Sends Message**: Resolved foreign key constraint violation when family members created via `adult_profiles` (new system) tried to send messages
  - The `family_member_id` column has a foreign key to `family_members.id`, but family members created via `adult_profiles` don't have entries in `family_members` table
  - Now checks if family member exists in `family_members` table before setting `family_member_id`; sets to `null` if not found
  - Added better error handling for PostgreSQL error codes (23503 foreign key, 23505 unique constraint)

- **Fixed Child Not Receiving Notifications from Family Members**: Children now receive toast notifications when family members send them messages
  - Updated `GlobalMessageNotifications.tsx` to include `family_member` in sender type checks
  - Updated realtime subscription filter to notify for both `parent` and `family_member` sender types
  - Updated polling fallback to fetch messages from both parents and family members

- **Fixed Family Member Not Receiving Notifications from Children**: Family members now receive toast notifications when children send them messages
  - Previous code only used `useChildren()` hook which returns children where `parent_id = user.id` (doesn't work for family members)
  - Now fetches user's `adult_profiles` and their `conversations` to find all children they can communicate with
  - Combined approach works for both parents and family members

### Changed - 2026-01-01

#### URL Route Update
- **Changed `/child/parents` to `/child/family`**: Updated the route to match the "Family" label in the navigation menu
  - Added backward compatibility redirect: `/child/parents` automatically redirects to `/child/family`
  - Updated all navigation links and `navigate()` calls throughout the codebase

#### Code Cleanup
- **Removed Debug Logging from MessageInput**: Removed `console.warn` that was logging word filter checks on every keystroke
  - Word filtering is done 100% locally (no server calls) - logging was unnecessary noise

### Added - 2026-01-01

#### Online Status Glow for Contact Cards
- **Subtle Green Glow Effect**: Added visual indicator for online contacts across all contact card views
  - Cards now display a soft green glow (`shadow-[0_0_12px_-3px_rgba(34,197,94,0.35)]`) and green border (`border-green-500/20-30`) when the contact is online
  - Effect is subtle enough to avoid "disco" effect with multiple online contacts
  - Complements existing green status dot for improved at-a-glance availability scanning
- **Updated Components**:
  - `ParentChildrenList.tsx` - ChildCard (parent's view of children)
  - `ChildParentsList.tsx` - Parent card and FamilyMemberCard (child's view of parents/family)
  - `FamilyMemberDashboard.tsx` - FamilyMemberChildCard (family member's view of children)
  - `ChildDashboard/DashboardWidgets.tsx` - Call and Message cards (child's dashboard)

#### Family Member Dashboard Layout Improvements
- **Single Column Layout**: Changed from 2-column grid to single column for better name visibility
- **Larger Card Design**: Increased avatar size (14x14 → 16x16), larger text, added status text below name
- **No Name Truncation**: Names now display fully without being cut off
- **Consistent Styling**: Matches `/child/family` page layout and interaction patterns

### Added - 2025-01-31

#### Onboarding Flow Enhancements
- **Comprehensive Parent Onboarding Tour**: Updated parent children list tour from 5 to 14 steps
  - Added individual menu item highlighting (Children, Family, Connections, Safety, Referrals, Subscription)
  - Added "More" dropdown explanation (Devices, Settings, App Information, Beta Testing)
  - Added Share button, Network Quality badge, and Logout button steps
  - Each step explains the purpose of the navigation item
- **Enhanced Family Member Onboarding**: Updated family member dashboard tour from 1 to 5 steps
  - Welcome message, child card explanation, call/message buttons, navigation menu
- **Enhanced Child Family Page Onboarding**: Updated child parents list tour from 1 to 5 steps
  - Kid-friendly language with emojis
  - Welcome message, parent card with online status, call/message buttons, family members section
- **Added `data-tour` Attributes**: Added targeting attributes to Navigation component for all menu items
  - Parent menu items: `data-tour="parent-menu-children"`, `data-tour="parent-menu-family"`, etc.
  - Family member menu: `data-tour="family-member-menu"`
  - Right-side elements: `data-tour="parent-menu-share"`, `data-tour="parent-menu-network"`, `data-tour="parent-menu-logout"`

### Added - 2025-01-23

#### Billing Integration
- **Stripe Billing System**: Implemented comprehensive Stripe billing integration with flat-rate subscriptions
  - Created `billing_subscriptions` table as source of truth for subscription state
  - Added RLS policies: users can read their own subscription, only service role can write
  - Implemented four Supabase Edge Functions:
    - `stripe-create-checkout-session`: Creates Stripe Checkout sessions for new subscriptions
    - `stripe-create-portal-session`: Creates Stripe Customer Portal sessions for subscription management
    - `stripe-change-subscription`: Modifies subscription prices with proration control (immediate or next cycle)
    - `stripe-webhook`: Handles Stripe webhook events (checkout completion, subscription updates, payment events)
  - Updated webhook handler to use `billing_subscriptions` table instead of `parents` table
  - Added billing service wrapper module (`_shared/billing-service.ts`) for centralized configuration
  - Updated Upgrade page (`/parent/upgrade`) to support:
    - Monthly and annual subscription signup via Stripe Checkout
    - Customer Portal access for subscription management
    - In-app subscription switching (Monthly ↔ Annual) with automatic proration policy
  - Price IDs:
    - Monthly: `price_1SUVdqIIyqCwTeH2zggZpPAK`
    - Annual: `price_1SkPL7IIyqCwTeH2tI9TxHRB`
    - Product: `prod_TROQs4IwtU17Fv`
  - Proration policy:
    - Monthly → Annual: immediate billing (upgrade)
    - Annual → Monthly: next cycle (downgrade via Subscription Schedule)
  - Security: Webhook signature verification uses raw body (not parsed JSON)
  - Documentation: Added `docs/BILLING.md` with complete billing integration guide

### Changed
- Updated `useSubscriptionData` hook to read from `billing_subscriptions` table
- Updated `usePaymentHandlers` hook to use new edge function names and price IDs
- Modified webhook handlers to upsert `billing_subscriptions` records

### Technical Details
- Migration: `supabase/migrations/20250123000000_create_billing_subscriptions.sql`
- Edge Functions: All functions use centralized billing service for price ID validation and Stripe key management
- Frontend: Upgrade page now supports both checkout flow and in-app subscription switching


