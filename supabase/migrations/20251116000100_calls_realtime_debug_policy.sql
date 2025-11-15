-- supabase/migrations/20251116000100_calls_realtime_debug_policy.sql
-- DEBUG-ONLY POLICY TEMPLATE FOR REALTIME ON public.calls
-- This file documents how to temporarily relax RLS for realtime debugging.
-- Do NOT enable this in production without understanding the implications.

-- IMPORTANT: This migration is intentionally commented out by default.
-- It serves as documentation for developers who need to debug realtime subscription issues.
-- Uncomment and run ONLY during development debugging sessions.

-- Supabase Realtime v2 requires SELECT permissions on tables being monitored.
-- If you're experiencing issues with realtime events not being received, you may need
-- to temporarily relax RLS policies to allow SELECT operations for debugging purposes.

-- Example policy (commented out by default):
-- This policy would allow all SELECT operations on the calls table, which is NOT secure for production.
-- 
-- CREATE POLICY "calls_realtime_debug_select"
-- ON public.calls
-- FOR SELECT
-- USING (true);

-- To use this for debugging:
-- 1. Uncomment the policy above
-- 2. Run the migration: supabase migration up
-- 3. Test your realtime subscriptions
-- 4. Once debugging is complete, remove or comment out the policy again
-- 5. Run: supabase migration down (or manually drop the policy)

-- ALTERNATIVE: If you need more granular debugging, you can create a policy that
-- only allows SELECT for specific users or roles:
--
-- CREATE POLICY "calls_realtime_debug_select_authenticated"
-- ON public.calls
-- FOR SELECT
-- TO authenticated
-- USING (true);

-- Remember: Always remove debug policies before deploying to production!

