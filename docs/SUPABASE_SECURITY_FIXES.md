# Supabase Security Fixes

This document explains how to fix the security issues identified by Supabase's database linter.

## Issues Fixed

### 1. Function Search Path Mutable (9 functions)

**Problem:** Functions without a fixed `search_path` are vulnerable to search path manipulation attacks (CWE-79). An attacker could potentially create malicious functions in schemas that get searched before `public`, leading to code injection.

**Solution:** A migration has been created to add `SET search_path = public` to all affected functions.

**Migration File:** `supabase/migrations/20251211000000_fix_function_search_path.sql`

**Functions Fixed:**

- `check_family_member_email`
- `update_profile_updated_at`
- `update_family_member_updated_at`
- `update_devices_updated_at`
- `ensure_call_ending_columns`
- `increment_call_version`
- `cleanup_call_artifacts`
- `mark_missed_calls`
- `update_conversation_timestamp`

**To Apply:**

1. The migration file has been created in your migrations folder
2. Run your migration command (e.g., `supabase db push` or apply via Supabase dashboard)
3. Verify the fixes by running the linter again

### 2. Leaked Password Protection Disabled

**Status:** ✅ **Already Implemented in Application**

**Problem:** Supabase's Security Advisor shows a warning about leaked password protection being disabled. However, **your application already implements this feature directly** using the HaveIBeenPwned API.

**Current Implementation:**

Your app has comprehensive password breach checking built-in:

1. **Real-time Breach Checking:**

   - `src/utils/passwordBreachCheck.ts` - Uses HaveIBeenPwned API with k-anonymity (SHA-1 hashing)
   - `src/hooks/usePasswordBreachCheck.ts` - Real-time debounced checking during password entry
   - `src/components/auth/PasswordInputWithBreachCheck.tsx` - UI component with visual feedback

2. **Signup Blocking:**

   - `src/pages/ParentAuth/ParentAuth.tsx` (lines 89-111) - Blocks signup if password is breached
   - Performs final validation before allowing signup
   - Shows clear error messages to users

3. **Features:**
   - ✅ Checks against 600+ million leaked passwords
   - ✅ Uses k-anonymity (only sends first 5 chars of SHA-1 hash) for privacy
   - ✅ Real-time visual feedback (green checkmark for safe, red warning for breached)
   - ✅ Blocks signup for breached passwords
   - ✅ Fails open (allows password if API unavailable) to prevent blocking legitimate users

**Why the Supabase Warning Appears:**

Supabase's built-in leaked password protection is a dashboard setting that requires a **Pro Plan** subscription. Since you've implemented this feature directly in your application code, you don't need to enable Supabase's version.

**Options:**

1. **Keep Current Implementation (Recommended):**

   - Navigate to: https://supabase.com/dashboard
   - Select your project (Project ID: `itmhojbjfacocrpmslmt`)

2. **Navigate to Authentication Settings:**

   - Click on **Authentication** in the left sidebar
   - Click on **Settings** (not Policies)

3. **Enable Leaked Password Protection:**

   - Scroll down to the **Password Security** section
   - Find the toggle for **"Prevent leaked passwords"** or **"Leaked Password Protection"**
   - Toggle it to **ON/Enabled**

4. **Verify:**
   - The setting should save automatically
   - Re-run the Supabase Security Advisor to confirm the warning is resolved

**Important Notes:**

- This feature requires a **Pro Plan or higher** subscription
- If you're on the Free plan, you'll need to upgrade to enable this feature
- The feature checks new passwords against HaveIBeenPwned.org's database of compromised passwords
- Users will see an error message if they try to use a compromised password

**Reference:**

- Documentation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Plan Requirements: https://supabase.com/pricing

## Verification

After applying the migration and enabling leaked password protection:

1. **Check Function Search Path:**

   ```sql
   SELECT
     proname as function_name,
     prosecdef as is_security_definer,
     proconfig as config_settings
   FROM pg_proc
   WHERE proname IN (
     'check_family_member_email',
     'update_profile_updated_at',
     'update_family_member_updated_at',
     'update_devices_updated_at',
     'ensure_call_ending_columns',
     'increment_call_version',
     'cleanup_call_artifacts',
     'mark_missed_calls',
     'update_conversation_timestamp'
   )
   AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
   ```

   You should see `{search_path=public}` in the `config_settings` column for all functions.

2. **Re-run Supabase Linter:**
   - The linter should no longer report these issues
   - All functions should pass the security check

## Security Impact

- **Before:** Functions were vulnerable to search path manipulation attacks
- **After:** All functions have a fixed search path, preventing injection attacks
- **Password Protection:** Users will be prevented from using known compromised passwords

## Notes

- The migration is idempotent - it's safe to run multiple times
- All function behavior remains the same, only security is improved
- No application code changes are required
