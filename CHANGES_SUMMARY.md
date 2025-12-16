# KidsCallHome - Changes Summary

> **Note**: For detailed technical information, complete file lists, testing recommendations, and implementation specifics, see [CHANGES_DETAILED.md](./CHANGES_DETAILED.md).

## SEO & Marketing Copy Implementation

### Overview

Comprehensive SEO optimization and marketing copy developed for app store listings, website, and search engine discovery. Includes structured data, meta tags, social sharing optimization, and voice assistant compatibility.

### Key Components

#### 1. App Store Listings

- **Apple App Store** (`APP_STORE_LISTING.md`):
  - App name: "Kids Call Home" (15 chars)
  - Subtitle: "Safe family calls, no SIM" (28 chars)
  - Promotional text (169 chars): Highlights safety, no SIM requirement, family-only contacts, tablet compatibility
  - Full description: 4 sections covering family-only calls, tablet compatibility, co-parenting, and privacy-first design
  - Keywords (100 chars): Optimized for search discovery
- **Google Play Store** (`PLAY_STORE_LISTING_DESCRIPTIONS.md`):
  - Short description (80 chars): "Safe video calling app for kids. Family-only calls, no SIM card or phone needed."
  - Full description (2,487/4,000 chars): Comprehensive copy with "HOW WE KEEP KIDS SAFE" section addressing parent concerns about Messenger Kids/JusTalk Kids style apps
  - Explicitly addresses: no strangers, no social feeds, no ads, strong privacy, simple parent controls
  - Dedicated co-parenting section for shared custody use cases
  - Strategic competitive positioning without naming competitors directly

#### 2. Website SEO (`index.html`)

- **Meta Tags**:
  - Title: "Kids Call Home – Safe Video Calls for Kids Without a Phone or SIM Card"
  - Description: Comprehensive meta description emphasizing safety, family-only contacts, tablet compatibility, and privacy (no ads, no strangers, no data tracking)
  - Keywords: 10 targeted SEO phrases focused on safe kids calling, family-only communication, and tablet compatibility
  - Canonical URL: `https://www.kidscallhome.com`
  - Robots: `index, follow`
- **Structured Data (JSON-LD)**:
  - Single consolidated `SoftwareApplication` schema (removed redundant schemas)
  - App category, features, age range (5-17), pricing, audience type
  - Feature list emphasizes safety: "Family-only video calls", "Parent-controlled contacts", "No public profiles or stranger contact", "Encrypted communication", "No ads or data tracking"
  - FAQPage schema: 6 problem-focused FAQs covering tablet calling, safety comparison, privacy protection, co-parenting, device compatibility, and ads/in-app purchases
- **Social Sharing**:
  - Open Graph tags: Complete implementation for Facebook/LinkedIn sharing with updated messaging
  - Twitter Card: `summary_large_image` with @KidsCallHome handle
  - Image metadata: 1200x630px OG image support
- **SEO Content**: Semantic HTML content accessible to search engines before React hydration
  - Hidden div (`#seo-content`) with H1, H2, H3 headings and full benefit sections
  - Content matches structured data FAQs for consistency
  - Enhanced `<noscript>` fallback with complete content for non-JS environments
  - Addresses parent concerns: no strangers, no ads, privacy-first design, co-parenting support

#### 3. Landing Page Content (`src/pages/Index.tsx`)

- Hero messaging: "Stay connected with your family through simple video calls and messaging"
- Two CTAs: "Parents & Family" and "Kids" login paths
- Feature highlights: Video Calls, Messaging, Safe & Secure

#### 4. Voice Assistant Optimization (`docs/SEO_VOICE_ASSISTANT_OPTIMIZATION.md`)

- Structured data for AI assistants (ChatGPT, Claude, Google Assistant, Siri)
- Robots.txt allowances for voice assistant bots
- PWA manifest enhancements with app shortcuts
- Problem-solving focused keywords for voice queries

### Key Messaging Themes

- **Safety & Security**: No strangers, parent-approved contacts only, encrypted communication
- **Technical Differentiation**: Works without SIM card/phone number, tablet/iPad/Kindle Fire compatible
- **Target Audiences**: Co-parents, long-distance families, tablet-only users
- **Competitive Positioning**: Implicitly contrasts with apps allowing "friends of friends", emphasizes no social feeds/games

### Files

- `APP_STORE_LISTING.md` - Apple App Store copy and keywords
- `PLAY_STORE_LISTING_DESCRIPTIONS.md` - Google Play Store copy
- `index.html` - SEO meta tags, structured data, social sharing
- `src/pages/Index.tsx` - Landing page content
- `src/components/info/AppDescription.tsx` - App description component
- `docs/SEO_VOICE_ASSISTANT_OPTIMIZATION.md` - SEO implementation documentation

### Impact

- **Search Engine Discovery**: Comprehensive structured data and meta tags improve search visibility
- **App Store Optimization**: Optimized copy for both Apple and Google Play stores
- **Social Sharing**: Proper Open Graph and Twitter Card implementation for link previews
- **Voice Assistant Ready**: Structured data enables AI assistants to recommend and describe the app
- **Consistent Messaging**: Unified value proposition across all platforms and touchpoints

## Latest Changes (2025-12-16)

### 1. SEO & Marketing Copy Update - Landing Page Optimization for 2025

- **Purpose**: Strengthen SEO for 2025 around safe kids calling, "no phone / no SIM / tablet" use, and co-parenting. Modernize structured data and improve above-the-fold messaging to address parent concerns about safety, privacy, and data tracking.
- **Changes**:
  - **Title & Meta Tags** (`index.html`):
    - Updated `<title>` to: "Kids Call Home – Safe Video Calls for Kids Without a Phone or SIM Card"
    - Updated meta description to emphasize safety, family-only contacts, tablet compatibility, and privacy (no ads, no strangers, no data tracking)
    - Updated Open Graph and Twitter Card meta tags to match new messaging
    - Streamlined keywords meta tag to 10 targeted SEO phrases focused on safe kids calling, family-only communication, and tablet compatibility
  - **Structured Data (JSON-LD) Cleanup**:
    - Consolidated to single `SoftwareApplication` schema (removed redundant `WebApplication` schema)
    - Removed `aggregateRating` (no public ratings available)
    - Removed non-standard properties (`offersSolutionTo`, `alternateName`, `browserRequirements`, `permissions`)
    - Added `typicalAgeRange: "5-17"` and `audience` type for families
    - Updated `operatingSystem` to array format: `["Web", "Android", "iOS"]`
    - Updated feature list to focus on safety: "Family-only video calls", "Parent-controlled contacts", "No public profiles or stranger contact", "Encrypted communication", "No ads or data tracking"
  - **FAQPage Schema Update**:
    - Replaced 8 generic FAQs with 6 problem-focused questions addressing parent concerns:
      - "How can my child call me from a tablet without a SIM card?"
      - "Is this app safer than typical kids messaging apps?"
      - "How does Kids Call Home protect my child's privacy?"
      - "Can my child use this to call both parents in different homes?"
      - "Does Kids Call Home work on iPads and tablets?"
      - "Are there ads or in‑app purchases in Kids Call Home?"
    - Answers emphasize safety, privacy, no strangers, no ads, and co-parenting use cases
  - **SEO-Visible Content**:
    - Added semantic HTML content in hidden div (`#seo-content`) accessible to search engines before React hydration
    - Includes `<h1>`: "Safe video calls for kids — no phone or SIM required"
    - Added benefit sections with H2 headings:
      - "Family-only calls, no strangers"
      - "Works on tablets, iPads, and Wi‑Fi devices"
      - "Built for co‑parents and long‑distance family"
      - "Privacy-first design for kids"
    - Includes full FAQ content matching structured data
    - Enhanced `<noscript>` fallback with complete content for non-JS environments
- **Key Messaging Updates**:
  - **Safety Focus**: Explicitly addresses "no strangers", "no public profiles", "no random friend requests"
  - **Privacy Emphasis**: Highlights encrypted communication, minimal data collection, no tracking for ads, no data selling
  - **Parent Concerns**: Addresses modern parent worries about manipulative design patterns, ads, and data tracking
  - **Tablet/Device Compatibility**: Emphasizes Wi‑Fi-only devices, tablets, iPads, Kindle Fire, Chromebooks
  - **Co-Parenting**: Highlights use case for shared custody and long-distance families
- **Technical Implementation**:
  - SEO content uses `position: absolute; left: -9999px` to hide visually while remaining accessible to crawlers
  - Content structure matches FAQPage schema for consistency
  - All functional JavaScript and PWA manifest remain unchanged
- **Files Modified**:
  - `index.html` - Updated title, meta tags, structured data, added SEO-visible content
- **Impact**:
  - **Improved SEO**: Better targeting for 2025 search queries around safe kids calling and tablet compatibility
  - **Parent Reassurance**: Content directly addresses concerns about strangers, ads, and data privacy
  - **Structured Data Compliance**: Cleaned up to follow current SoftwareApplication/FAQPage schema guidance
  - **Search Engine Accessibility**: Semantic HTML content available before React hydration for better crawling
  - **Consistent Messaging**: Landing page content aligns with app store listings and marketing materials

### 2. Play Store Listing Rewrite - Competitive Positioning for 2025

- **Purpose**: Rewrite Google Play Store short and full descriptions with stronger, up-to-date positioning against Messenger Kids and JusTalk Kids. Address current parent concerns about cyberbullying, stranger exposure, addictive design, data collection, and complex setup requirements.
- **Changes**:
  - **Short Description** (`PLAY_STORE_LISTING_DESCRIPTIONS.md`):
    - Updated to: "Safe video calling app for kids. Family-only calls, no SIM card or phone needed." (80 characters)
    - Leads with "Safe video calling app for kids" (high-intent SEO phrase)
    - Includes "Family-only calls" (key differentiation)
    - Emphasizes "no SIM card or phone needed" (core technical benefit)
  - **Full Description Rewrite** (2,487/4,000 characters):
    - **Opening Lines**: Laser-focused on safe video calls, no SIM requirement, family-only contacts, and co-parenting use cases
    - **"HOW WE KEEP KIDS SAFE" Section**: Explicitly addresses parent concerns about Messenger Kids/JusTalk Kids style apps:
      - No strangers: Kids can only call approved family contacts—no open search, no friend requests, no random messages
      - No social feeds: No endless scrolling, games, or random content that feeds screen addiction
      - No ads or tricky purchases: Clean interface with no advertising and no dark-pattern in-app purchases
      - Strong privacy: End-to-end encryption, minimal data collection, no data selling or sharing with advertisers
      - Simple parent controls: Easy setup without needing extra monitoring apps
    - **Co-Parenting Section**: Dedicated mini-section explaining how kids can easily reach both homes safely in shared custody situations
    - **Privacy Emphasis**: Concrete details about encryption (end-to-end for calls/messages, WebRTC peer-to-peer), minimal data collection, and no data selling
    - **Device Compatibility**: Highlighted early—works on tablets (iPad, Android, Kindle Fire, Chromebook) and phones with Wi-Fi or data
    - **Competitive Positioning**: Subtle reference to "A calm, family-only alternative to busy kids messaging and social apps" without naming competitors directly
- **Key Messaging Themes**:
  - **Safety First**: Addresses cyberbullying risks, stranger exposure, and addictive design patterns
  - **Privacy & Data-Minimalism**: Emphasizes minimal data collection, no tracking, no data selling
  - **No Social Media**: Explicitly contrasts with apps that have feeds, games, and social discovery features
  - **Co-Parenting Support**: Highlights use case for shared custody and long-distance families
  - **Technical Differentiation**: "No SIM / no phone plan / works on tablets" prominently featured
- **Parent Concerns Addressed**:
  - Cyberbullying and unkind behavior between "approved" contacts
  - Exposure to strangers via IDs, friend requests, or social-style discovery
  - Addictive, notification-heavy social apps with games and feeds
  - Heavy data collection and tracking from big tech platforms
  - Complex setup requiring ongoing supervision and extra monitoring tools
  - General online safety: grooming, inappropriate content, privacy, screen-time balance
- **Files Modified**:
  - `PLAY_STORE_LISTING_DESCRIPTIONS.md` - Complete rewrite of short and full descriptions
- **Impact**:
  - **Improved ASO**: Optimized for 2025 search behavior with high-intent phrases like "safe video calling app for kids"
  - **Competitive Positioning**: Directly addresses weaknesses in Messenger Kids/JusTalk Kids without naming them
  - **Parent Reassurance**: Explicitly states how app avoids biggest problems parents see in kids messaging apps
  - **Clear Differentiation**: Emphasizes "no strangers, no feeds, no ads" positioning
  - **Co-Parenting Appeal**: Dedicated section addresses shared custody use case
  - **Privacy Credibility**: Concrete encryption and data protection details build trust
  - **Ready for Play Console**: Copy ready to paste directly into Google Play Console

### 3. Authentication & Session Management Fixes

- **Purpose**: Fix production issues with logout behavior and session persistence
- **Issues Fixed**:
  - **Parent Logout Affecting Child**: When parent logged out, it was logging out the child on the same device/browser
  - **Back Button Clearing Sessions**: Using browser back button was triggering auth checks that redirected users to login even when still logged in
  - **Child Logout Friction**: Children had logout option causing unnecessary friction for easy access
- **Changes**:
  - **Parent/Family Member Logout** (`src/components/Navigation.tsx`):
    - Changed `supabase.auth.signOut()` to use `scope: 'local'` instead of global signout
    - Only clears local Supabase session (keys starting with "sb-"), not child sessions
    - Child sessions stored separately in localStorage as "childSession" remain untouched
    - Each user type (parent, family member, child) has isolated session storage
  - **Back Button Navigation**:
    - **ChildHome.tsx**: Added `useRef` guard to prevent multiple session checks on navigation
      - Session check only runs once on component mount, not on every navigation
      - Prevents redirecting to login when using back button
    - **ParentHome.tsx**: Added `useRef` guard for auth session checks
      - Auth check only runs once on mount, preserving login state on back navigation
    - **ChildDashboard/useDashboardData.ts**: Added session check guard
      - Prevents unnecessary redirects when navigating back to dashboard
  - **Child Logout Removal** (`src/components/Navigation.tsx`):
    - Removed logout button from child navigation bar
    - Removed logout confirmation dialog for children
    - Removed child logout logic from `handleLogout` function
    - Children now stay logged in automatically for easy access
- **Technical Implementation**:
  - `scope: 'local'` ensures parent/family member logout only affects their Supabase auth session
  - Child sessions use separate localStorage key ("childSession") completely isolated from Supabase auth
  - `useRef` guards prevent `useEffect` hooks from running multiple times on navigation
  - Session checks only occur once per component mount, not on every route change
  - `onAuthStateChange` listener only clears Supabase keys, never touches child sessions
- **Files Modified**:
  - `src/components/Navigation.tsx` - Updated logout logic, removed child logout UI
  - `src/pages/ChildHome.tsx` - Added session check guard
  - `src/pages/ParentHome.tsx` - Added auth check guard
  - `src/pages/ChildDashboard/useDashboardData.ts` - Added session check guard
- **Impact**:
  - **Session Isolation**: Parent/family member logout no longer affects child sessions
  - **Independent Logout**: Each user type can logout independently without affecting others
  - **Back Button Support**: Users stay logged in when using browser back button
  - **Reduced Friction**: Children always available without login barriers
  - **Better UX**: Sessions persist across navigation, only cleared on explicit logout
  - **Production Stability**: Eliminates production issues with cross-user logout

### 3. Child Blocking & Navigation Fixes

- **Purpose**: Fix child blocking functionality and improve navigation UX
- **Issues Fixed**:
  - **Child Blocking Error**: Children unable to block contacts due to RLS policy violation (401 Unauthorized)
  - **Real-Time Updates**: Blocked contact status not updating immediately when parent unblocks
  - **Navigation Highlighting**: Home and Dashboard buttons always highlighted instead of only when selected
  - **Block Button Visibility**: Block button shown for parents (children cannot block their own parent)
- **Changes**:
  - **Block Contact Function** (`src/utils/family-communication.ts`):
    - Changed from direct INSERT to using `block_contact_for_child` RPC function
    - RPC function uses `SECURITY DEFINER` to bypass RLS for children (anonymous auth)
    - Removed manual parent notification call (handled by database trigger)
    - Removed unused `notifyParentOfBlock` function
  - **Real-Time Subscriptions**:
    - **BlockedContactsList.tsx**: Added Supabase real-time subscription for `blocked_contacts` table
      - Listens for UPDATE events (when `unblocked_at` is set) and INSERT events
      - Automatically refreshes list when changes occur
    - **ChildParentsList.tsx**: Added filtered real-time subscription for child's blocked contacts
      - Subscribes to updates filtered by `blocker_child_id`
      - Refreshes blocked contacts list when parent unblocks someone
      - Properly cleans up subscriptions on unmount or child ID change
  - **Navigation Active State** (`src/components/Navigation.tsx`):
    - Fixed `getNavLinkClassName` function to prevent root paths from matching sub-paths
    - Root paths (`/parent`, `/child`, `/family-member`) only match exactly or with trailing slash
    - Deeper paths (e.g., `/parent/dashboard`) match path and sub-paths correctly
    - Prevents Home button from being highlighted when on Dashboard or other sub-pages
  - **Block Button Visibility** (`src/pages/ChildParentsList.tsx`):
    - Removed `BlockAndReportButton` from parents section
    - Block button only shown for family members (children can block family members, not parents)
    - Added comment explaining safety feature: child cannot block their own parent
- **Technical Implementation**:
  - Uses existing `block_contact_for_child` database function (SECURITY DEFINER)
  - Real-time subscriptions use Supabase `postgres_changes` event listeners
  - Navigation uses precise path matching instead of `startsWith` for root paths
  - Proper cleanup of real-time channels to prevent memory leaks
- **Files Modified**:
  - `src/utils/family-communication.ts` - Updated `blockContact` to use RPC function
  - `src/features/safety/components/BlockedContactsList.tsx` - Added real-time subscription
  - `src/pages/ChildParentsList.tsx` - Added real-time subscription, removed block button for parents
  - `src/components/Navigation.tsx` - Fixed active state logic
- **Impact**:
  - **Child Blocking**: Children can now successfully block contacts without RLS errors
  - **Real-Time Updates**: UI updates immediately when parent unblocks a contact (no manual refresh needed)
  - **Navigation UX**: Only active page/tab is highlighted, improving visual clarity
  - **Safety Feature**: Block button hidden for parents, enforcing safety rule at UI level
  - **Database Consistency**: Uses existing database functions designed for this use case
  - **Performance**: Proper subscription cleanup prevents memory leaks

### 4. Production Loading Issues Fix - Workbox Precaching & Vercel Routing

- **Purpose**: Fix production loading errors preventing service worker installation and causing 403 errors on HTML files
- **Issues Fixed**:
  - **Workbox Precaching 403 Error**: Service worker failing to install due to 403 errors when precaching HTML files
  - **Vercel Routing Conflict**: HTML files being caught by rewrite rule and redirected to `/index.html` instead of being served directly
  - **X-Frame-Options Header Conflict**: `DENY` setting conflicting with CSP allowing Cloudflare challenge frames
- **Changes**:
  - **Workbox Configuration** (`vite.config.ts`):
    - Excluded HTML files from precaching by adding `**/*.html` to `globIgnores` array
    - Added runtime caching strategy for HTML files using NetworkFirst handler
      - 7-day cache expiration with 3-second network timeout
      - Falls back to cache on slow networks for offline support
      - Handles 403 errors gracefully without breaking service worker installation
  - **Vercel Routing** (`vercel.json`):
    - Updated rewrite rule to exclude HTML files: added `|.*\\.html` to negative lookahead pattern
    - HTML files now served directly from `/public` folder instead of being rewritten to `/index.html`
  - **Security Headers** (`vercel.json`):
    - Changed `X-Frame-Options` from `DENY` to `SAMEORIGIN` to align with CSP policy
    - Allows Cloudflare challenge iframes while maintaining security
- **Technical Implementation**:
  - HTML files excluded from precaching manifest to prevent 403 errors during service worker installation
  - Runtime caching ensures HTML files are still cached for offline support
  - Vercel rewrite pattern updated: `/((?!manifest\\.json|sw\\.js|icon-.*\\.png|og-image\\.png|robots\\.txt|favicon\\.ico|assets/|_next-live/|.*\\.html).*)`
  - NetworkFirst strategy with timeout ensures fresh content while providing offline fallback
- **Files Modified**:
  - `vite.config.ts` - Added HTML exclusion to `globIgnores`, added HTML runtime caching strategy
  - `vercel.json` - Updated rewrite rule to exclude HTML files, changed X-Frame-Options header
- **Impact**:
  - **Service Worker Installation**: No longer fails due to 403 errors on HTML files
  - **HTML File Access**: Static HTML files (e.g., `/low-data-family-calls.html`) now load correctly
  - **Offline Support**: HTML files still cached at runtime for offline access
  - **Cloudflare Compatibility**: Frame policy now consistent with CSP allowing challenge iframes
  - **Production Stability**: Eliminates Workbox precaching errors that were breaking PWA functionality
  - **Performance**: HTML files cached efficiently without blocking service worker installation

### 5. Apple App Store Listing Copy Creation

- **Purpose**: Create App Store-optimized copy for Apple App Store Connect submission, addressing 2025 parent concerns about kids messaging apps and emphasizing safety, privacy, and tablet compatibility
- **Changes**:
  - **App Name**: Created 3 variants, selected "Kids Call Home" (15 characters)
    - Clean brand name with safety message handled in subtitle
  - **Subtitle**: Created 3 variants, selected "Safe family calls, no SIM" (28 characters)
    - Combines safety, family-only positioning, and key technical differentiator
  - **Promotional Text**: Created 169-character promotional text
    - Emphasizes safety, no phone/SIM requirement, family-only contacts, tablet compatibility
    - Highlights "no ads, no strangers, no social feeds" positioning
  - **Full Description**: Created 4-section description (~1,200 characters)
    - Opening paragraph addressing core benefits and parent concerns
    - "Family-Only Calls, No Strangers" section: Parent control and safety features
    - "Perfect for Tablets and Wi‑Fi Devices" section: Device compatibility messaging
    - "Built for Co‑Parents and Long‑Distance Family" section: Use case emphasis
    - "Privacy-First, Designed for Kids" section: Privacy, encryption, no ads/tracking
  - **Keywords Field**: Created 100-character keyword string
    - Optimized for search discovery: "safe video calls kids", "kids call parents", "kids video calling", "kids tablet calling", "family calling app", "kids no sim calling", "co-parenting app", "tablet calling kids", "iPad video calling", "safe kids messaging"
- **Key Messaging Themes**:
  - **Safety & Security**: No strangers, parent-approved contacts only, encrypted communication
  - **Technical Differentiation**: Works without SIM card/phone number, tablet/iPad/Kindle Fire compatible
  - **Target Audiences**: Co-parents, long-distance families, tablet-only users
  - **Competitive Positioning**: Implicitly contrasts with apps allowing "friends of friends", emphasizes no social feeds/games
  - **Parent Concerns Addressed**: Online grooming, cyberbullying, manipulative design patterns, data tracking, complex setup
- **Tone & Structure**:
  - Reassuring, calm, parent-centric tone
  - Avoids technical jargon; explains privacy/safety in plain language
  - Clear section headings for scannability
  - Benefit-driven copy that builds trust
- **Files Created**:
  - `APP_STORE_LISTING.md` - Complete Apple App Store copy with variants, recommendations, and final selections
- **Impact**:
  - **App Store Ready**: Copy ready to paste directly into App Store Connect
  - **ASO Optimization**: Optimized for Apple's search algorithm with strategic keyword placement
  - **Parent Trust**: Addresses 2025 parent concerns about kids messaging apps
  - **Clear Positioning**: Differentiates from competitors without naming them directly
  - **Consistent Messaging**: Aligns with Google Play Store listing and website SEO copy
  - **Search Discovery**: Keyword field optimized for parent search queries

## Previous Changes (2025-12-16)

### 2. Beta Testing Program - Signup and Feedback System

- **Purpose**: Enable users to join beta testing program and submit feedback to help improve the app
- **Changes**:
  - **Database Schema**: Created `beta_signups` and `beta_feedback` tables with comprehensive RLS policies
    - `beta_signups` table tracks user participation with platform, device info, timezone, use case, and consent
    - `beta_feedback` table stores user feedback with category (bug/ux/feature/other), rating (1-5), message, and metadata
    - Status tracking: `invited`, `active`, `paused`, `exited` for beta signups
    - RLS policies ensure users can only INSERT/SELECT their own records
    - Users can UPDATE their own signup status (for exiting beta)
    - No DELETE policies - data retention for analytics
  - **Beta Page**: Created `/beta` route with two main sections
    - **Join Beta Form**: Platform selection, app version, device model, timezone, use case, consent checkbox
    - **Feedback Form**: Category selection, optional rating (1-5), message textarea
    - Auto-detects platform (iOS/Android/Web), device model, timezone, and app version
    - Shows success state after joining with feedback form revealed
    - Mobile-responsive card layout matching app design
    - Back button for navigation
  - **Service Layer**: Created `src/services/betaService.ts` with typed functions
    - `getBetaSignup()` - Get user's beta signup record
    - `isBetaUser()` - Check if user is in beta (computed check, safer than modifying profiles)
    - `joinBeta(payload)` - Join beta program with validation
    - `submitFeedback(payload)` - Submit feedback with metadata collection
  - **Email Confirmation**: Automatic confirmation email sent on signup
    - Created `send-beta-signup-confirmation` Supabase Edge Function
    - Beautiful HTML email template matching app theme (primary blue #3B82F6)
    - Includes welcome message, "What's Next?" section, feedback link, beta details
    - Supports Supabase SMTP and Resend API (fallback)
    - Non-blocking: signup succeeds even if email fails
  - **Navigation Integration**: Added beta access from multiple locations
    - Navigation menu: "More" → "Beta Testing"
    - Account Settings page: Beta Testing card section
    - Info page: Beta Testing section in navigation
  - **App Version Display**: Added version information to Info page
    - Created `src/utils/appVersion.ts` utility
    - Auto-detects version from Capacitor App plugin (native apps) or package.json (web)
    - Displays version in App Description section
    - Auto-fills version in beta signup form
  - **Version Automation**: Created version sync script
    - `scripts/sync-version.js` - Syncs version from package.json to Android build.gradle
    - Automatically increments versionCode for Play Store
    - Vite automatically injects version from package.json at build time
    - `npm run version 1.0.2` - Update version everywhere
  - **App Description Update**: Updated to include family members
    - Full description now mentions "parents, family members, and children"
    - Explains family member invitations and access
    - Key features updated to include family member support
- **Technical Implementation**:
  - **Migration**: Created `20251216112138_create_beta_feedback_tables.sql`
    - Creates both tables with proper indexes for performance
    - Comprehensive RLS policies for security
    - Trigger for `updated_at` timestamp on beta_signups
  - **Edge Function**: `supabase/functions/send-beta-signup-confirmation/index.ts`
    - Responsive HTML email with app theme colors
    - Plain text fallback for email clients
    - Error handling with graceful fallbacks
  - **Deep Link Support**: Captures referrer in feedback metadata for marketing email tracking
- **Files Modified**:
  - `supabase/migrations/20251216112138_create_beta_feedback_tables.sql` (new)
  - `src/services/betaService.ts` (new)
  - `src/pages/Beta.tsx` (new)
  - `src/components/info/BetaTestingSection.tsx` (new)
  - `src/components/info/AppDescription.tsx` (updated)
  - `src/components/Navigation.tsx` (updated)
  - `src/pages/AccountSettings.tsx` (updated)
  - `src/pages/Info.tsx` (updated)
  - `src/data/infoSections.ts` (updated)
  - `src/utils/appVersion.ts` (new)
  - `src/App.tsx` (updated - added route)
  - `supabase/functions/send-beta-signup-confirmation/index.ts` (new)
  - `scripts/sync-version.js` (new)
  - `vite.config.ts` (updated - version injection)
  - `package.json` (updated - version scripts)
- **Impact**:
  - **User Engagement**: Users can easily join beta and provide feedback
  - **Product Improvement**: Structured feedback collection with metadata for analysis
  - **Professional Communication**: Automated welcome emails improve user experience
  - **Version Tracking**: App version visible to users and auto-collected in feedback
  - **Marketing Ready**: Deep link support for email campaigns (`/beta?ref=email`)
  - **Security**: RLS ensures users can only access their own data
  - **Non-Breaking**: Isolated feature, no changes to existing functionality

### 3. Avatar Colors for Parents and Family Members

- **Purpose**: Make parents and family members visually distinct with different avatar colors, matching the color system used for children
- **Changes**:
  - **Database Schema**: Added `avatar_color` column to `adult_profiles` table
    - Default color: `#3B82F6` (blue)
    - Colors assigned deterministically based on adult profile ID hash using PostgreSQL `hashtext()` function
    - Uses exact same 5-color palette as children's `AVATAR_COLORS`:
      - `#3B82F6` (blue)
      - `#F97316` (orange)
      - `#10B981` (green)
      - `#A855F7` (purple)
      - `#EC4899` (pink)
  - **Auto-Assignment**: Created database trigger to automatically assign avatar colors for new adult profiles
    - Trigger function `assign_adult_avatar_color()` runs `BEFORE INSERT` on `adult_profiles`
    - Assigns colors based on ID hash modulo 5, ensuring even distribution across color palette
    - Ensures consistent color assignment - same parent always gets same color
  - **Data Population**: Migration populates existing `adult_profiles` records with colors
    - Uses `CASE` statement with `hashtext(id::text) % 5` for deterministic assignment
    - Updates all records where `avatar_color IS NULL OR avatar_color = '#3B82F6'`
  - **UI Updates**: Updated parent/family member avatars throughout the application
    - `ChildParentsList.tsx`: Parent and family member avatars display with their assigned colors using inline styles
    - `GlobalMessageNotifications.tsx`: Parent message notifications use parent's avatar color instead of hardcoded blue
    - Fallback to default blue (`#3B82F6`) if color not available or fetch fails
- **Technical Implementation**:
  - **Migration**: Created `20251216000000_add_avatar_color_to_adult_profiles.sql`
    - Adds `avatar_color TEXT DEFAULT '#3B82F6'` column
    - Populates existing records with deterministic colors
    - Creates `assign_adult_avatar_color()` trigger function
    - Creates `assign_adult_avatar_color_trigger` trigger
    - Adds column comment for documentation
  - **Data Layer**: Updated `getChildConversations()` in `src/utils/conversations.ts`
    - Added `avatar_color` to SELECT query from `adult_profiles` table
    - Updated `ConversationParticipant` interface to include optional `avatar_color` field
    - Provides default color (`#3B82F6`) in fallback cases
  - **Components**: Updated avatar rendering
    - `ChildParentsList.tsx`: Changed from `bg-primary` class to inline `style={{ backgroundColor: avatar_color }}`
    - `GlobalMessageNotifications.tsx`: Fetches `avatar_color` from `adult_profiles` instead of using hardcoded HSL color
- **Files Modified**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#1-avatar-colors-for-parents-and-family-members) for complete file list
- **Impact**:
  - **Visual Consistency**: Parents and family members now have visually distinct avatars matching children's color system
  - **Better UX**: Color-coded contacts make it easier for children to identify different family members
  - **Consistent Assignment**: Deterministic hash ensures same parent always has same color across sessions
  - **Scalability**: Auto-assignment trigger ensures new adult profiles get colors automatically
  - **Backward Compatible**: Existing records populated, new records auto-assigned, fallbacks ensure no breaking changes

### 4. Child Interface Improvements - Parents List Enhancement

- **Purpose**: Improve child user experience by making it easier to identify and contact parents vs family members
- **Changes**:
  - **Default Route Update**: Changed default `/child` route to redirect to `/child/parents` for immediate access to contact list
    - Removed intermediate home page step - children land directly on their contact list
  - **Visual Separation**: Separated parent cards from family member cards into distinct sections with clear headers
    - Parents section appears first with primary-colored styling (border-2 border-primary/20, ring-2 ring-primary/30 around avatar)
    - Family members section appears below with standard styling
    - Section headers: "Parents" and "Family Members" with descriptive subtitles
  - **Relationship Type Display**: Family member badges now show specific relationship types instead of generic "Family"
    - Displays: "Grandparent", "Aunt", "Uncle", "Cousin", "Other" (capitalized)
    - Falls back to "Family" if relationship_type is not set
    - Uses `relationship_type` field from `adult_profiles` table
  - **Presence Status**: Family members now show online/offline status matching parents
    - Added `StatusIndicator` component with pulse animation when online
    - Status text shows "{Name} is online" or "{Name} is offline" (same format as parents)
    - Each family member card tracks presence individually using `useParentPresence` hook
- **Technical Implementation**:
  - Updated `getChildConversations()` to include `relationship_type` from `adult_profiles` table
  - Created `FamilyMemberCard` component with individual presence tracking using `useParentPresence`
  - Updated `ChildParentsList.tsx` to use `useMemo` for filtering parents/family members (performance optimization)
  - Modified route configuration in `App.tsx` to redirect `/child` to `/child/parents` using `Navigate` component
  - Updated `ConversationParticipant` interface to include `relationship_type` field
- **Files Modified**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#2-child-interface-improvements---parents-list-enhancement) for complete file list
- **Impact**:
  - Improved UX for children - easier to identify who they're contacting
  - Better visual hierarchy with parents prominently displayed at top
  - Consistent presence tracking across all adult contacts (parents and family members)
  - More informative badges showing family relationships (Grandparent, Aunt, etc.)
  - Faster access to contacts - no intermediate home page step
  - Better performance with memoized filtering of conversations

### 5. Family Member Dashboard UI Consistency - Child Badge and Avatar Styling

- **Purpose**: Ensure family member dashboard matches parent's children list UI for consistent user experience across roles
- **Changes**:
  - **Unread Message Badge**: Added unread message count badge to family member's child cards
    - Badge displays on Message button matching parent's implementation exactly
    - Shows unread count with "99+" for counts over 99
    - Badge is invisible when count is 0 to prevent layout shift (CLS optimization)
    - Uses same styling: `bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px]`
    - Real-time updates via `useUnreadBadgeForChild` hook from badge store
  - **Avatar Styling Consistency**: Updated child avatar styling to match parent's children list
    - Replaced `Avatar` component with plain `div` matching parent's implementation
    - Changed from `h-16 w-16` to `aspect-square w-12` for consistent sizing
    - Updated text size from `text-xl` to `text-lg` to match parent
    - Added same classes: `aspect-square w-12 rounded-full flex items-center justify-center text-white font-bold text-lg leading-none select-none flex-shrink-0`
    - Simplified initial display to show only first letter: `child.name.charAt(0).toUpperCase()`
    - Added fallback color: `|| "#6366f1"` matching parent's implementation
- **Technical Implementation**:
  - Created `FamilyMemberChildCard` component to properly use React hooks (hooks cannot be called in loops)
  - Imported `useUnreadBadgeForChild` from `@/stores/badgeStore`
  - Removed `Avatar` and `AvatarFallback` imports (no longer needed)
  - Removed `getInitials` function and prop (simplified to single letter)
  - Updated Message button styling to match parent: `bg-chat-accent text-chat-accent-foreground hover:bg-chat-accent/90`
  - Updated Call button to use `variant="secondary"` matching parent's implementation
- **Files Modified**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#3-family-member-dashboard-ui-consistency---child-badge-and-avatar-styling) for complete file list
- **Impact**:
  - **Visual Consistency**: Family member dashboard now matches parent's children list UI exactly
  - **Better UX**: Family members can see unread message counts just like parents
  - **Real-time Updates**: Badge updates automatically as messages are received
  - **Layout Stability**: Invisible badge when count is 0 prevents layout shift (CLS optimization)
  - **Code Consistency**: Same avatar styling and badge implementation across both views
  - **Maintainability**: Shared styling makes future updates easier to keep in sync

## Previous Changes (2025-12-10)

### 1. Large File Refactoring - Phase 1 & 2 (Steps 1-7)

- **Purpose**: Improve code maintainability by breaking down large files into smaller, focused components using test-first approach
- **Strategy**: Test-first refactoring with comprehensive test coverage, maintaining backward compatibility
- **Refactored Files**:

#### Step 1: inputValidation.ts (512 lines → 5 focused modules)

- **Created**: `src/utils/inputValidation/` directory structure
  - `emailValidation.ts` - Email validation functions
  - `passwordValidation.ts` - Password validation functions
  - `textValidation.ts` - Text sanitization and validation
  - `codeValidation.ts` - Child login code validation
  - `schemas.ts` - Regex patterns and constants
  - `index.ts` - Barrel exports (maintains original import path)
- **Tests**: Created comprehensive snapshot tests in `src/utils/__tests__/inputValidation.test.ts`
- **Impact**: Zero import changes, all tests pass, improved organization

#### Step 2: AddChildDialog.tsx (Large component → 5 focused components)

- **Created**: `src/components/AddChildDialog/` directory structure
  - `AddChildDialog.tsx` - Main orchestrator (max 200 lines)
  - `ChildForm.tsx` - Form fields and validation UI
  - `ChildFormValidation.ts` - Validation logic
  - `types.ts` - TypeScript interfaces
  - `constants.ts` - Avatar colors, animals arrays
  - `index.ts` - Barrel export
- **Tests**: Created tests for dialog open/close, form validation, submit, error states
- **Impact**: UI unchanged, props API unchanged, improved maintainability

#### Step 3: GlobalIncomingCall.tsx (576 lines → 5 focused components)

- **Created**: `src/components/GlobalIncomingCall/` directory structure
  - `GlobalIncomingCall.tsx` - Main orchestrator (~95 lines)
  - `useIncomingCallState.ts` - State management hook (~350 lines)
  - `IncomingCallUI.tsx` - Notification UI component (~70 lines)
  - `types.ts` - TypeScript interfaces
  - `index.ts` - Barrel export
- **Tests**: Created tests for call scenarios, accept/reject, ringtone, unmount
- **Critical**: WebRTC functionality preserved (subscriptions, polling, ringtone management)
- **Impact**: No WebRTC regressions, component API unchanged

#### Step 4: ParentAuth.tsx (691 lines → 10 focused files)

- **Created**: `src/pages/ParentAuth/` directory structure
  - `ParentAuth.tsx` - Main orchestrator (~213 lines)
  - `LoginForm.tsx` - Login UI component
  - `SignupForm.tsx` - Signup UI component
  - `PasswordResetForm.tsx` - Password reset UI (placeholder)
  - `useAuthState.ts` - Shared auth state management
  - `authValidation.ts` - Form validation logic
  - `authSecurityChecks.ts` - Security validation checks
  - `authHandlers.ts` - Authentication handler functions
  - `types.ts` - TypeScript interfaces
  - `index.ts` - Barrel export
- **Tests**: Created tests for login, signup, validation, redirects
- **Impact**: All auth flows functional, session management unchanged

#### Step 5: ChildDashboard.tsx (562 lines → 7 focused files)

- **Created**: `src/pages/ChildDashboard/` directory structure
  - `ChildDashboard.tsx` - Main orchestrator (~128 lines)
  - `useDashboardData.ts` - Data fetching hook (~250 lines)
  - `DashboardHeader.tsx` - Header component
  - `DashboardWidgets.tsx` - Widget container
  - `IncomingCallDialog.tsx` - Incoming call dialog
  - `types.ts` - TypeScript interfaces
  - `index.ts` - Barrel export
- **Tests**: Created tests for data loading, widgets, navigation, real-time updates
- **Impact**: Dashboard fully functional, real-time features preserved

#### Step 6: sidebar.tsx (584 lines → 9 focused files)

- **Created**: `src/components/ui/sidebar/` directory structure
  - `Sidebar.tsx` - Main component (~131 lines)
  - `SidebarProvider.tsx` - Context provider
  - `SidebarTrigger.tsx` - Toggle button
  - `SidebarContent.tsx` - Content area
  - `SidebarNavigation.tsx` - Navigation components (all menu items)
  - `useSidebar.ts` - Sidebar state hook
  - `types.ts` - TypeScript types and constants
  - `index.ts` - Barrel export
  - `sidebar.tsx` - Re-export file (maintains shadcn/ui pattern)
- **Tests**: Created tests for open/close, navigation, active states, responsive, keyboard
- **Impact**: Maintains shadcn/ui export pattern, animations smooth, accessibility preserved

#### Step 7: ParentDashboard.tsx (842 lines → 10 focused files)

- **Created**: `src/pages/ParentDashboard/` directory structure
  - `ParentDashboard.tsx` - Main orchestrator (~257 lines)
  - `useDashboardData.ts` - Data fetching hooks (~200 lines)
  - `useFamilyMemberHandlers.ts` - Family member action handlers (~150 lines)
  - `useChildHandlers.ts` - Child action handlers (~50 lines)
  - `useCodeHandlers.ts` - Code management handlers (~80 lines)
  - `useIncomingCallHandlers.ts` - Incoming call handlers (~60 lines)
  - `DashboardHeader.tsx` - Header section (~50 lines)
  - `DashboardTabs.tsx` - Tabs container (~100 lines)
  - `types.ts` - TypeScript interfaces
  - `index.ts` - Barrel export
- **Tests**: Created comprehensive test suite for all dashboard features
- **Impact**: All dashboard features functional, tab navigation preserved, composition pattern used

- **Testing Infrastructure**:

  - Added Vitest testing framework (`vitest`, `@vitest/ui`)
  - Created `src/test-setup.ts` for jsdom environment
  - Updated `vite.config.ts` with test configuration
  - Created test directories: `src/utils/__tests__/`, `src/components/__tests__/`, `src/pages/__tests__/`, `src/components/ui/__tests__/`

- **Key Principles**:

  - **Test-First**: Comprehensive tests created before refactoring
  - **Backward Compatibility**: All imports unchanged via barrel exports
  - **Composition Pattern**: Hooks + components for better organization
  - **Max 250 Lines**: Main orchestrator components kept under 250 lines (most under 200)
  - **Zero Regressions**: All functionality preserved, no breaking changes

- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#1-large-file-refactoring---phase-1--2-steps-1-7) for complete file list by step

- **Impact**:
  - **Code Organization**: Large files split into focused, maintainable modules
  - **Test Coverage**: Comprehensive test suites for all refactored components
  - **Maintainability**: Smaller files easier to understand and modify
  - **Reusability**: Extracted hooks and components can be reused
  - **Zero Breaking Changes**: All imports work identically, no consumer changes needed
  - **Performance**: No bundle size increase, all optimizations preserved

## Previous Changes (2025-12-09)

### 1. Conversations and Feature Flags Infrastructure

- **Purpose**: Future-proof schema for child-to-child messaging/calls, gated by feature flags
- **Implementation**:
  - **Conversations Table**: Created to support 1:1 and group conversations (future-proof for group chats)
  - **Conversation Participants Table**: Links users/children to conversations, supports both adults (auth.users.id) and children (child_profiles.id)
  - **Family Feature Flags Table**: Per-family feature flags to enable/disable child-to-child communication without migrations
  - **Schema Updates**:
    - Added `conversation_id` and `receiver_type` to `messages` table (nullable for backward compatibility)
    - Added `conversation_id` and `callee_id` to `calls` table (nullable for backward compatibility)
  - **Helper Functions**:
    - `is_feature_enabled_for_children()` - Checks if feature is enabled for either child's family
    - Updated `can_users_communicate()` - Now checks `'child_to_child_messaging'` feature flag
    - New `can_users_call()` - Same logic but checks `'child_to_child_calls'` feature flag
    - `get_or_create_conversation()` - Creates or retrieves conversation between participants
    - `can_children_communicate()` - Checks if child-to-child communication is allowed (feature flag + approvals)
    - `get_family_feature_flag()` - Retrieves feature flag value for a family
- **RLS Policy Updates**:
  - Updated child message INSERT policy to use conversation context when available, falls back to parent (legacy)
  - Updated child call INSERT policy to support conversation_id, callee_id, or legacy parent_id
  - New RLS policies for conversations, participants, and feature flags tables
- **Features**:
  - Child-to-child communication can be enabled/disabled per family via feature flags
  - Parent approval still required for child-to-child connections (via `child_connections` table)
  - Feature flags allow gradual rollout and A/B testing without migrations
  - Schema supports future group chat functionality
  - Backward compatible - existing messages/calls work unchanged
- **Impact**:
  - Foundation laid for child-to-child messaging/calls
  - Parents maintain control via feature flags (can toggle on/off per family)
  - Flexible architecture for future enhancements
  - Database-level enforcement of all rules (even with feature flags enabled)
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#1-conversations-and-feature-flags-infrastructure) for complete file list

### 2. Database-Level Permissions Matrix Enforcement

- **Issue**: Permissions matrix rules were only enforced at application level, leaving potential security gaps
- **Solution**: Added comprehensive database-level enforcement via RLS policies and security functions
- **Key Features**:
  - **`can_users_communicate()` Function**: Central permission check function that enforces all communication rules at database level
    - Prevents adult-to-adult communication (critical rule)
    - Checks blocking status (with parent exception for safety)
    - Verifies child-to-child connection approvals
    - Enforces family boundaries
    - Now checks `'child_to_child_messaging'` feature flag
  - **Enhanced `is_contact_blocked()` Function**:
    - Returns `false` if checking child's own parent (safety feature)
    - Prevents child from blocking their own parent at database level
  - **RLS Policy Updates**: All message and call INSERT policies now use `can_users_communicate()` before allowing inserts
- **Safety Features**:
  - **Child Cannot Block Own Parent**: Database-level prevention ensures parents maintain oversight access even if child wants privacy
  - **No Adult-to-Adult Communication**: Database enforces that adults cannot communicate with each other
  - **Blocking Override**: If either side has blocked the other, no communication allowed (except parent exception)
- **Impact**:
  - Security hardened at database level - rules cannot be bypassed by application bugs
  - Parent oversight maintained even if child attempts to block
  - Clear separation of concerns: database enforces rules, application provides UX
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#2-database-level-permissions-matrix-enforcement) for complete file list

### 3. Production Console Errors Fix - Security Headers & Vercel Live

- **Issue**: Multiple production console errors:
  - **403 Forbidden error** on main page (critical)
  - Vercel Live feedback script loading in production (should be disabled)
  - Missing Content Security Policy (CSP) headers causing warnings
  - Cross-Origin-Resource-Policy errors
  - Cloudflare challenge warnings (informational)
- **Fixes**:
  - **403 Error Fix**: Removed `Cross-Origin-Resource-Policy: same-origin` header that was blocking the main page load
  - **Security Headers**: Added comprehensive security headers to `vercel.json`:
    - `Content-Security-Policy`: Restricts resource loading to trusted sources, blocks vercel.live scripts (now applies to all requests, not just HTML)
    - `Cross-Origin-Embedder-Policy: credentialless` - Changed from `unsafe-none` to `credentialless` to resolve COEP/CORP conflict with Vercel Live scripts
    - Additional security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, etc.)
  - **Vercel Live Blocking** (multiple layers):
    - Added rewrite rule: `/_next-live/*` → `/404`
    - Added redirect rule: `/_next-live/*` → `/404`
    - CSP blocks `vercel.live` domain scripts
  - **CSP Configuration**: Properly configured to allow:
    - Self-hosted scripts and styles
    - Google Fonts
    - Supabase connections (including WebSocket)
    - Cloudflare challenges (`https://*.cloudflare.com` added to all relevant directives)
    - Media and blob resources for video calls
  - **Cloudflare Verification Fix**:
    - **X-Frame-Options**: Changed from `DENY` to `SAMEORIGIN` to allow Cloudflare challenge iframes
    - **Frame-Ancestors**: Changed from `'none'` to `'self'` to allow Cloudflare challenge frames
- **Documentation**: Created/updated troubleshooting guides for production errors and Cloudflare verification issues
- **Impact**:
  - **403 error on main page resolved**
  - Vercel Live errors blocked via rewrites/redirects and CSP
  - CSP warnings resolved (may still see from Cloudflare challenge scripts - normal)
  - COEP/CORP errors resolved
  - Cloudflare challenges can now complete successfully
  - Improved security posture with proper headers
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#3-production-console-errors-fix---security-headers--vercel-live) for complete file list

### 4. Build Fix - Missing conversations.ts File

- **Issue**: Build failing on Vercel with error: `Could not load /vercel/path0/src/utils/conversations (imported by src/pages/Chat.tsx)`
- **Root Cause**: The file `src/utils/conversations.ts` was untracked in git, so it wasn't available during the Vercel build process
- **Fix**:
  - Added `src/utils/conversations.ts` to git (was previously untracked)
  - Removed incorrect `.js` file extensions from imports (Vite resolves TypeScript files automatically)
  - Added explicit `extensions` array to Vite `resolve` configuration to ensure proper TypeScript file resolution: `[".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"]`
  - Updated `src/features/messaging/hooks/useChatInitialization.ts`
  - Updated `src/features/messaging/hooks/useMessageSending.ts`
  - Updated `src/pages/ChildParentsList.tsx`
  - Updated `vite.config.ts`
- **Impact**: Build now succeeds on Vercel. The conversations utility file is now tracked in git and available during build
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#4-build-fix---missing-conversationsts-file) for complete file list

### 5. Critical Fix - Symmetric Call Termination

- **Issue**: Asymmetric call termination where parent ending calls terminated for both parties, but child ending only affected the child
- **Root Cause**: Termination listener channel was failing with CHANNEL_ERROR due to channel name conflicts and subscription timing issues
- **Fixes**:
  - **Symmetric Termination**: Removed conditional logic based on `ended_by` field - both parties now always cleanup when call ends, regardless of who initiated termination
  - **Idempotency Guards**: Added cleanup guards in both `useVideoCall.ts` and `useWebRTC.ts` to prevent double cleanup from multiple listeners
  - **Channel Name Conflict Fix**:
    - Changed termination listener channel name from `call-termination:${callId}` to `call-termination:${callId}:${Date.now()}` for uniqueness
    - Added cleanup of existing termination channels before creating new ones
  - **Enhanced Error Handling**: Added detailed error logging for CHANNEL_ERROR with special handling for transient binding mismatch errors
  - **Connection State Monitoring**: Added `oniceconnectionstatechange` handler to monitor ICE connection failures and auto-end stale connections after 5-second timeout
  - **ICE Candidate Buffering**: Already implemented in call handlers - candidates are queued when remote description isn't set yet
- **Impact**: Both parent and child now disconnect immediately when either party ends the call (symmetric termination)
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#5-critical-fix---symmetric-call-termination) for complete file list

## Previous Changes (2025-02-03)

### 1. Security Enhancements - Audit Logging System

- **New Feature**: Comprehensive audit logging system for security events
- **Implementation**:
  - Created `audit_logs` table with RLS policies (service role only for reads)
  - Added `log_audit_event()` RPC function for client-side logging
  - Added `get_audit_logs()` and `cleanup_old_audit_logs()` admin functions
  - Client-side audit logging utility with server sync (`src/utils/auditLog.ts`)
- **Features**:
  - Tracks login attempts, failures, lockouts, suspicious activity
  - Stores IP, user agent, email, metadata with severity levels
  - Automatic server sync via Supabase RPC (graceful fallback if function missing)
  - Local storage backup (last 100 entries)
  - Suspicious activity detection
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#1-security-enhancements---audit-logging-system) for complete file list

### 2. Security Enhancements - Account Lockout & Breach Checking

- **Account Lockout Hook**: New `useAccountLockout` hook for managing lockout status and CAPTCHA display
- **Email Breach Checking**:
  - New `useEmailBreachCheck` hook for real-time email breach detection
  - Checks against HaveIBeenPwned API (non-blocking, fails open)
  - Shows breach details and security tips
- **Password Breach Checking**:
  - Enhanced `usePasswordBreachCheck` hook
  - Expanded weak password list from 55 to 250+ passwords
  - Real-time HaveIBeenPwned API checking (600+ million passwords)
- **New Components**:
  - `EmailInputWithBreachCheck.tsx` - Email input with breach checking
  - `PasswordInputWithBreachCheck.tsx` - Password input with breach checking
  - `LockoutWarning.tsx` - Visual lockout warnings
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#2-security-enhancements---account-lockout--breach-checking) for complete file list

### 3. Component Refactoring - Large File Split

- **Issue**: Large page components (600-900 lines) were difficult to maintain
- **Solution**: Split large pages into smaller, focused components
- **Refactored Pages**:
  - **ChildLogin.tsx**: Split into 4 components
    - `ColorAnimalSelector.tsx` - Color/animal selection screen
    - `FamilyCodeKeypad.tsx` - Family code entry keypad
    - `NumberEntryScreen.tsx` - Number entry interface
    - `SuccessScreen.tsx` - Success confirmation screen
  - **DeviceManagement.tsx**: Split into 5 components
    - `DeviceCard.tsx` - Individual device card display
    - `DeviceFilters.tsx` - Filter controls
    - `DeviceHistoryPagination.tsx` - History pagination
    - `DeviceRemovalDialog.tsx` - Device removal confirmation
    - `DeviceRenameDialog.tsx` - Device renaming dialog
  - **Info.tsx**: Split into 9 components
    - `AppDescription.tsx` - App description section
    - `CancellationSection.tsx` - Cancellation policy
    - `ContactSection.tsx` - Contact information
    - `DataRemovalSection.tsx` - Data removal instructions
    - `DemoSection.tsx` - Demo information
    - `InfoNavigation.tsx` - Navigation component
    - `PricingSection.tsx` - Pricing information
    - `PrivacySection.tsx` - Privacy policy
    - `SecuritySection.tsx` - Security information
    - `TermsSection.tsx` - Terms of service
  - **ParentAuth.tsx**: Refactored to use new auth components
- **Data Layer**: Created `src/data/` directory for constants
  - `childLoginConstants.ts` - Child login constants
  - `infoSections.ts` - Info page section definitions
- **Impact**:
  - Reduced code by ~1,900 lines (net reduction)
  - Improved maintainability and testability
  - Better code organization and reusability
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#3-component-refactoring---large-file-split) for complete file list

### 4. Database Migrations - Subscription Fixes

- **Cancelled Subscription Access Fix**:
  - **Issue**: Cancelled subscriptions were treated as expired immediately
  - **Fix**: Updated `can_add_child()` function to allow cancelled subscriptions until expiration date
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#4-database-migrations---subscription-fixes) for complete file list

### 5. RLS Optimization Analysis

- **New Documentation**: Comprehensive analysis of RLS policy performance
- **Identified Issues**:
  - Redundant EXISTS checks in parent call policies
  - Duplicate logic in UPDATE policies
  - Optimization opportunities for child message policies
- **File**: `docs/RLS_OPTIMIZATION_ANALYSIS.md`

### 6. Utility Enhancements

- **Audit Logging**: Enhanced `src/utils/auditLog.ts` with server sync
- **Device Tracking**: Enhanced `src/utils/deviceTrackingLog.ts` with better error handling
- **IP Geolocation**: Enhanced `src/utils/ipGeolocation.ts` with improved error handling
- **Security Utils**: Enhanced `src/utils/security.ts` with sanitization helpers
- **Cookies**: New `src/utils/cookies.ts` utility for cookie management
- **Supabase Client**: Enhanced with better error handling

### 7. Configuration Updates

- **Vite Config**: Updated `vite.config.ts` with additional optimizations
- **Main Entry**: Enhanced `src/main.tsx` with improved initialization
- **Audio Notifications**: Enhanced `src/features/calls/hooks/useAudioNotifications.ts`

### 8. TypeScript & Lint Error Fixes - Chat Component

- **Issue**: Multiple TypeScript and ESLint errors in Chat.tsx preventing compilation
- **Fixes**:
  - **PromiseLike.catch() errors**: Wrapped Supabase query chains in `Promise.resolve()` to convert PromiseLike to Promise (lines 176, 378)
  - **child_profiles table type errors**: Replaced `child_profiles` table references with `children` table since types aren't generated yet (lines 348, 793)
  - **parent_id property access**: Fixed query to use `parent_id` from `children` table instead of non-existent `child_profiles` (line 364)
  - **ChildSession type mismatch**: Updated `fetchChildData` to properly map `children` table data to `ChildSession` interface (line 797)
  - **Type instantiation depth errors**: Added `@ts-expect-error` with type assertions to handle Supabase's complex type system (lines 824-827, 839)
  - **sender_id required error**: Made `sender_id` required in payload type and ensured it's always set before insert (line 1057)
  - **error.details type error**: Added type checking to handle `error.details` as either string or Record before sanitization (line 1066)
  - **any type usage**: Changed `error: any` to `error: unknown` with proper type guards (line 1127)
  - **Missing useEffect dependencies**: Added missing dependencies (`conversationId`, `familyMemberId`, `isFamilyMember`) to dependency arrays (lines 583, 712)
- **Impact**: All TypeScript and ESLint errors resolved, code compiles successfully
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#8-typescript--lint-error-fixes---chat-component) for complete file list with line-by-line references

## Previous Changes (2025-01-22)

### 1. Device Management Real-Time Updates

- **Issue**: Device management page wasn't updating when children logged in
- **Fix**: Added real-time Supabase subscriptions to automatically refresh device list on INSERT/UPDATE events
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#previous-changes-2025-01-22) for complete file list

### 2. Device Tracking RPC Function Fix

- **Issue**: `update_device_login` RPC call failing with type mismatch error (TEXT vs INET)
- **Fix**: Updated migration to properly cast IP addresses to INET type when inserting/updating
- **Files**: `supabase/migrations/20250122000012_add_country_code.sql`, `src/pages/ChildLogin.tsx`
- **Enhancement**: Added fallback logic to handle cases where migration hasn't been applied yet

### 3. Device Removal Functionality

- **Issue**: Device removal wasn't working - missing permissions and silent failures
- **Fix**:
  - Created migration to grant execute permissions for `revoke_device` function
  - Added comprehensive error handling and logging
  - Improved user feedback with warning and success notifications
- **Files**: `supabase/migrations/20250122000013_grant_revoke_device_permissions.sql`, `src/pages/DeviceManagement.tsx`

### 4. Enhanced User Experience - Toast Notifications

- **Warning Toast**: Added red/orange warning notification when password prompt appears for device removal
  - Includes device name and child name (if available)
  - Clearly indicates destructive action
- **Success Toast**: Added green success variant for device removal confirmation
  - More prominent and visually distinct
- **Files**: `src/components/ui/toast.tsx`, `src/pages/DeviceManagement.tsx`

### 5. Swipe-to-Dismiss for Toast Notifications

- **Enhancement**: Enabled swipe-to-dismiss functionality for all toast notifications
- **Benefit**: Better mobile/touchscreen UX - users can swipe right to dismiss notifications
- **Files**: `src/components/ui/toast.tsx`, `src/components/ui/toaster.tsx`

### 6. Country Code Support

- **Enhancement**: Added country code column to devices table for IP geolocation
- **Benefit**: Display country flags to show where devices are logging in from
- **Files**: `supabase/migrations/20250122000012_add_country_code.sql`

### 7. Improved Error Handling & Logging

- Added comprehensive console logging throughout device management flow
- Better error messages for debugging
- Graceful fallback handling for missing migrations

## Previous Changes (2025-01-08)

### 1. Privacy Policy Consent Improvements

- **Issue**: Privacy policy consent banner could show repeatedly, and localStorage consent wasn't syncing to database on sign-in
- **Fixes**:
  - **Consent Sync on Login**: Added logic to sync localStorage consent to database when user signs in, ensuring consent persists across devices and sessions
  - **Auth State Change Listener**: Added listener to re-check consent when authentication state changes (sign-in, token refresh) with 500ms delay to allow sync to complete
  - **localStorage Fallback**: Enhanced logic to check localStorage as fallback for authenticated users, preventing banner from showing if user already accepted (even if database sync is in progress)
  - **Race Condition Prevention**: Added delay to auth state change check to prevent race conditions between consent sync and banner display
- **Impact**:
  - Consent now properly persists across devices and sessions
  - Banner won't show unnecessarily if user already accepted
  - Privacy policy link works both before and after sign-in
  - Better user experience with proper consent tracking
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#previous-changes-2025-01-08) for complete file list

### 2. Onboarding Tour Fix - Prevent Repeated Display

- **Issue**: Onboarding tour could show every time the app loads, even after completion
- **Fix**: Updated logic to prioritize completion check - if tour is completed, it never auto-starts again, regardless of device fingerprint changes
  - Primary check: If tour is completed, never auto-start (prevents repeated display)
  - Device check only applies for first-time experience (if tour not completed)
  - Completion status stored in localStorage persists across sessions
- **Impact**:
  - Tour only shows once per device (first-time experience)
  - Once completed, tour never shows again (even if device fingerprint changes)
  - Users can still manually restart tour via HelpBubble button
  - Better user experience - no interruptions for returning users
- **Files**: See [CHANGES_DETAILED.md](./CHANGES_DETAILED.md#previous-changes-2025-01-08) for complete file list

---

## Overall Impact Summary

### Code Quality Improvements

- **Net Code Reduction**: ~1,900 lines removed through refactoring
- **Component Organization**: Large pages split into 18+ focused, reusable components
- **Maintainability**: Improved code organization with dedicated component directories
- **Testability**: Smaller components are easier to unit test

### Security Enhancements

- **Audit Logging**: Comprehensive security event tracking system
- **Breach Protection**: Email and password breach checking via HaveIBeenPwned API
- **Account Security**: Enhanced lockout mechanisms with visual warnings
- **Data Protection**: Improved sanitization and security utilities
- **Database-Level Enforcement**: RLS policies enforce permissions matrix at database level

### Database & Backend

- **Subscription Fixes**: Cancelled subscriptions now work until expiration
- **RLS Analysis**: Comprehensive performance analysis documentation
- **Audit System**: Full audit logging infrastructure with RPC functions
- **Feature Flags**: Per-family feature flags for gradual rollout of child-to-child communication
- **Conversations Infrastructure**: Future-proof schema for group chats and child-to-child messaging

### Developer Experience

- **Better Organization**: Clear separation of concerns with component directories
- **Reusable Components**: Auth, child login, device, and info components
- **Data Layer**: Centralized constants and configuration
- **Enhanced Utilities**: Improved error handling and logging throughout
- **Testing Infrastructure**: Vitest framework with comprehensive test coverage
