# Beta Testing Program - Signup and Feedback System

## Overview

This PR adds a complete beta testing program feature that allows users to join beta testing and submit feedback. The feature includes database tables, UI components, email confirmations, and version management automation.

## Features Added

### 1. Database Schema

- ✅ Created `beta_signups` table with platform, device info, timezone, use case, and consent tracking
- ✅ Created `beta_feedback` table with category, rating, message, and metadata fields
- ✅ Comprehensive RLS policies ensuring users can only access their own data
- ✅ Indexes for performance optimization
- ✅ Status tracking: `invited`, `active`, `paused`, `exited`

### 2. Beta Page (`/beta`)

- ✅ Join Beta form with auto-detected platform, device model, timezone, and app version
- ✅ Feedback form for beta users with category selection and optional rating
- ✅ Mobile-responsive card layout matching app design
- ✅ Back button for navigation
- ✅ Loading states and error handling
- ✅ Success toasts and user feedback

### 3. Service Layer

- ✅ `betaService.ts` with typed functions:
  - `getBetaSignup()` - Get user's beta signup
  - `isBetaUser()` - Check beta status (computed, safer than modifying profiles)
  - `joinBeta(payload)` - Join beta program
  - `submitFeedback(payload)` - Submit feedback with metadata

### 4. Email Confirmation

- ✅ Supabase Edge Function: `send-beta-signup-confirmation`
- ✅ Beautiful HTML email template matching app theme (primary blue #3B82F6)
- ✅ Responsive design for mobile and desktop
- ✅ Supports Supabase SMTP and Resend API (fallback)
- ✅ Non-blocking: signup succeeds even if email fails

### 5. Navigation Integration

- ✅ Added to Navigation menu: "More" → "Beta Testing"
- ✅ Added to Account Settings page: Beta Testing card section
- ✅ Added to Info page: Beta Testing section in navigation

### 6. App Version Management

- ✅ Created `appVersion.ts` utility for version detection
- ✅ Auto-detects from Capacitor App plugin (native) or package.json (web)
- ✅ Version displayed in Info page App Description section
- ✅ Auto-fills version in beta signup form
- ✅ Version sync script: `scripts/sync-version.js`
- ✅ Vite automatically injects version from package.json at build time

### 7. App Description Updates

- ✅ Updated to include family members (grandparents, aunts, uncles, etc.)
- ✅ Key features updated to reflect full family structure support

## Technical Details

### Database Migration

- **File**: `supabase/migrations/20251216112138_create_beta_feedback_tables.sql`
- Creates both tables with proper indexes
- RLS policies for security
- Trigger for `updated_at` timestamp

### New Files

- `src/pages/Beta.tsx` - Beta page component
- `src/services/betaService.ts` - Beta service layer
- `src/components/info/BetaTestingSection.tsx` - Info page section
- `src/utils/appVersion.ts` - Version utility
- `supabase/functions/send-beta-signup-confirmation/index.ts` - Email function
- `scripts/sync-version.js` - Version sync script
- `supabase/migrations/20251216112138_create_beta_feedback_tables.sql` - Migration

### Modified Files

- `src/App.tsx` - Added `/beta` route
- `src/components/Navigation.tsx` - Added Beta Testing menu item
- `src/pages/AccountSettings.tsx` - Added Beta Testing section
- `src/pages/Info.tsx` - Added Beta Testing section
- `src/components/info/AppDescription.tsx` - Added version display, updated description
- `src/data/infoSections.ts` - Added beta-testing section
- `vite.config.ts` - Version injection
- `package.json` - Version sync scripts

## Security

- ✅ RLS policies ensure users can only INSERT/SELECT their own records
- ✅ Users can UPDATE their own signup status (for exiting beta)
- ✅ No DELETE policies - data retention for analytics
- ✅ Email function requires authentication
- ✅ Input validation and sanitization

## Testing Checklist

- [ ] User can join beta program with all fields filled
- [ ] User can join beta program with minimal fields (platform + consent)
- [ ] After joining, feedback form appears
- [ ] User can submit feedback with all fields
- [ ] User can submit feedback with minimal fields (category + message)
- [ ] Success toasts appear after successful actions
- [ ] RLS: User can only see their own beta signup
- [ ] RLS: User can only see their own feedback
- [ ] RLS: User cannot modify other users' records
- [ ] Email confirmation sent on signup
- [ ] Email template renders correctly
- [ ] Platform auto-detects correctly (ios/android/web)
- [ ] Device model auto-fills from user agent
- [ ] Timezone auto-detects from browser
- [ ] App version auto-detects and displays
- [ ] Deep link `/beta?ref=email` works
- [ ] Navigation menu links work
- [ ] Account Settings link works
- [ ] Info page section accessible

## Breaking Changes

None - All changes are isolated to the beta feature.

## Migration Required

Yes - Run migration `20251216112138_create_beta_feedback_tables.sql` in Supabase dashboard.

## Deployment Notes

1. Run the migration in Supabase dashboard
2. Deploy the Edge Function: `send-beta-signup-confirmation`
3. Ensure `RESEND_API_KEY` is set in Supabase Edge Function secrets (or configure SMTP)
4. Test email delivery

## Related Issues

Closes #[issue-number] (if applicable)

## Screenshots

(Add screenshots of the beta page, email template, etc.)

