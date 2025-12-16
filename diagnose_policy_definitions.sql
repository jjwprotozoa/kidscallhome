-- Diagnostic: Check actual policy definitions
-- This will show us what the policies actually contain

SELECT 
    tablename,
    policyname,
    cmd,
    LEFT(COALESCE(qual::text, ''), 200) as using_clause,
    LEFT(COALESCE(with_check::text, ''), 200) as with_check_clause,
    CASE 
        WHEN COALESCE(qual::text, '') LIKE '%auth.uid()%' 
             AND COALESCE(qual::text, '') NOT LIKE '%(select auth.uid())%' 
             AND COALESCE(qual::text, '') NOT LIKE '%select auth.uid()%' THEN '❌ Unoptimized in USING'
        WHEN COALESCE(with_check::text, '') LIKE '%auth.uid()%' 
             AND COALESCE(with_check::text, '') NOT LIKE '%(select auth.uid())%' 
             AND COALESCE(with_check::text, '') NOT LIKE '%select auth.uid()%' THEN '❌ Unoptimized in WITH CHECK'
        WHEN COALESCE(qual::text, '') LIKE '%(select auth.uid())%' 
             OR COALESCE(with_check::text, '') LIKE '%(select auth.uid())%' THEN '✅ Optimized'
        ELSE 'ℹ️ No auth.uid()'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'adult_profiles', 'blocked_contacts', 'calls', 'child_connections',
    'child_family_memberships', 'child_profiles', 'children',
    'conversation_participants', 'conversations', 'devices', 'families',
    'family_feature_flags', 'family_members', 'messages', 'parents',
    'profiles', 'reports', 'stripe_checkout_sessions'
  )
  AND (
    (COALESCE(qual::text, '') LIKE '%auth.uid()%' 
     AND COALESCE(qual::text, '') NOT LIKE '%(select auth.uid())%' 
     AND COALESCE(qual::text, '') NOT LIKE '%select auth.uid()%')
    OR
    (COALESCE(with_check::text, '') LIKE '%auth.uid()%' 
     AND COALESCE(with_check::text, '') NOT LIKE '%(select auth.uid())%' 
     AND COALESCE(with_check::text, '') NOT LIKE '%select auth.uid()%')
  )
ORDER BY tablename, policyname;

