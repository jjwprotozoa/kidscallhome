# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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


