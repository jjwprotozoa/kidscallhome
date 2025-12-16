# KidsCallHome - Changes Summary

> **Note**: For detailed technical information, complete file lists, testing recommendations, and implementation specifics, see [CHANGES_DETAILED.md](./CHANGES_DETAILED.md).

## Latest Changes (2025-12-16)

### 1. Avatar Colors for Parents and Family Members

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

### 2. Child Interface Improvements - Parents List Enhancement

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

### 3. Family Member Dashboard UI Consistency - Child Badge and Avatar Styling

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
