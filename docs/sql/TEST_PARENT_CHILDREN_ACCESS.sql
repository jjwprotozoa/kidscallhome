-- Test: Verify Parent Can Access Children
-- Purpose: Test RLS policies from application context (not SQL Editor)
-- 
-- IMPORTANT: This query must be run from the APPLICATION, not SQL Editor
-- The SQL Editor runs as service role and doesn't have auth.uid()
--
-- To test from the app:
-- 1. Log in as parent in the application
-- 2. Open browser DevTools Console
-- 3. Run the JavaScript equivalent of this query

-- =====================================================
-- JavaScript/TypeScript Test (Run in Browser Console)
-- =====================================================
/*
// Run this in browser console while logged in as parent
const { data, error } = await supabase
  .from('children')
  .select('*')
  .order('created_at', { ascending: false });

console.log('Children data:', data);
console.log('Error:', error);
console.log('Count:', data?.length || 0);

// Should return 4 children if working correctly
*/

-- =====================================================
-- Alternative: Test via Supabase Client in App
-- =====================================================
-- Add this to a test page or run in browser console:

/*
import { supabase } from '@/integrations/supabase/client';

async function testParentChildrenAccess() {
  // Check auth
  const { data: { session } } = await supabase.auth.getSession();
  console.log('Session:', session);
  console.log('User ID:', session?.user?.id);
  
  // Test children query
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .order('created_at', { ascending: false });
  
  console.log('Children:', data);
  console.log('Error:', error);
  
  // Test with explicit filter (what the app does)
  const { data: data2, error: error2 } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', session?.user?.id)
    .order('created_at', { ascending: false });
  
  console.log('Children (filtered):', data2);
  console.log('Error (filtered):', error2);
}

testParentChildrenAccess();
*/

-- =====================================================
-- SQL Test (Only works if you set role to authenticated user)
-- =====================================================
-- This requires service role access and setting the role
-- DO NOT run this in production - for testing only

-- Step 1: Verify parent exists
SELECT 
    'Parent Verification' as test,
    id,
    email,
    name
FROM public.parents
WHERE id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid;

-- Step 2: Verify children exist (bypassing RLS with service role)
SELECT 
    'Children Verification' as test,
    id,
    name,
    parent_id,
    created_at
FROM public.children
WHERE parent_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
ORDER BY created_at DESC;

-- Step 3: Check if adult_profiles entry exists for parent
SELECT 
    'Adult Profile Verification' as test,
    id,
    user_id,
    family_id,
    role,
    name
FROM public.adult_profiles
WHERE user_id = '70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid
  AND role = 'parent';

-- =====================================================
-- Expected Results
-- =====================================================
-- When run from APPLICATION (not SQL Editor):
-- 1. Session should have user.id = '70888a10-ad5e-4764-8dff-537ad2da34d1'
-- 2. Children query should return 4 rows
-- 3. No RLS errors (PGRST116 or similar)
--
-- If you get 0 rows or RLS errors:
-- 1. Check JWT token is being sent (Network tab → Request Headers → Authorization)
-- 2. Verify token's 'sub' claim matches parent_id
-- 3. Check browser console for Supabase errors

