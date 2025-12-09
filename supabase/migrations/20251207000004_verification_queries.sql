-- Migration: Verification Queries for 1-on-1 Conversation Isolation
-- Purpose: Test queries to verify strict 1-on-1 isolation is working correctly
-- Date: 2025-12-07
-- These queries can be run manually to verify the system is working as expected

-- =====================================================
-- VERIFICATION 1: Two different adults messaging same child see different conversations
-- =====================================================
-- This query should show that two different adults have separate conversations with the same child

-- Example: Replace with actual adult_profile_ids and child_profile_id
/*
SELECT 
  c.id as conversation_id,
  c.adult_id,
  ap.name as adult_name,
  ap.role as adult_role,
  c.child_id,
  cp.name as child_name,
  COUNT(m.id) as message_count
FROM public.conversations c
JOIN public.adult_profiles ap ON ap.id = c.adult_id
JOIN public.child_profiles cp ON cp.id = c.child_id
LEFT JOIN public.messages m ON m.conversation_id = c.id
WHERE c.child_id = 'CHILD_PROFILE_ID_HERE'  -- Replace with actual child_profile_id
GROUP BY c.id, c.adult_id, ap.name, ap.role, c.child_id, cp.name
ORDER BY c.adult_id;
*/

-- Expected result: Multiple rows, one per adult, each with different conversation_id

-- =====================================================
-- VERIFICATION 2: Same adult messaging two different children sees two separate conversations
-- =====================================================
-- This query should show that one adult has separate conversations with different children

-- Example: Replace with actual adult_profile_id
/*
SELECT 
  c.id as conversation_id,
  c.adult_id,
  ap.name as adult_name,
  c.child_id,
  cp.name as child_name,
  COUNT(m.id) as message_count
FROM public.conversations c
JOIN public.adult_profiles ap ON ap.id = c.adult_id
JOIN public.child_profiles cp ON cp.id = c.child_id
LEFT JOIN public.messages m ON m.conversation_id = c.id
WHERE c.adult_id = 'ADULT_PROFILE_ID_HERE'  -- Replace with actual adult_profile_id
GROUP BY c.id, c.adult_id, ap.name, c.child_id, cp.name
ORDER BY c.child_id;
*/

-- Expected result: Multiple rows, one per child, each with different conversation_id

-- =====================================================
-- VERIFICATION 3: Child sees one conversation per adult
-- =====================================================
-- This query should show all conversations a child has, one per adult

-- Example: Replace with actual child_profile_id
/*
SELECT 
  c.id as conversation_id,
  c.adult_id,
  ap.name as adult_name,
  ap.role as adult_role,
  c.child_id,
  cp.name as child_name,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at
FROM public.conversations c
JOIN public.adult_profiles ap ON ap.id = c.adult_id
JOIN public.child_profiles cp ON cp.id = c.child_id
LEFT JOIN public.messages m ON m.conversation_id = c.id
WHERE c.child_id = 'CHILD_PROFILE_ID_HERE'  -- Replace with actual child_profile_id
GROUP BY c.id, c.adult_id, ap.name, ap.role, c.child_id, cp.name
ORDER BY last_message_at DESC NULLS LAST;
*/

-- Expected result: One row per adult the child has conversations with

-- =====================================================
-- VERIFICATION 4: All messages have conversation_id (no NULL values)
-- =====================================================
-- This should return 0 rows if migration was successful

SELECT 
  COUNT(*) as messages_without_conversation_id,
  sender_type
FROM public.messages
WHERE conversation_id IS NULL
GROUP BY sender_type;

-- Expected result: 0 rows (all messages have conversation_id)

-- =====================================================
-- VERIFICATION 5: All conversations use profile IDs (not raw auth UIDs)
-- =====================================================
-- Verify that conversations reference adult_profiles.id and child_profiles.id

SELECT 
  COUNT(*) as total_conversations,
  COUNT(DISTINCT c.adult_id) as unique_adult_profiles,
  COUNT(DISTINCT c.child_id) as unique_child_profiles
FROM public.conversations c
WHERE c.adult_id IS NOT NULL 
  AND c.child_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.adult_profiles ap WHERE ap.id = c.adult_id)
  AND EXISTS (SELECT 1 FROM public.child_profiles cp WHERE cp.id = c.child_id);

-- Expected result: All conversations should have valid profile IDs

-- =====================================================
-- VERIFICATION 6: Profile ID resolution works correctly
-- =====================================================
-- Verify that adult_profiles correctly map to auth.users

SELECT 
  ap.id as adult_profile_id,
  ap.user_id,
  ap.role,
  ap.name,
  u.email,
  CASE 
    WHEN u.id IS NULL THEN 'MISSING USER'
    ELSE 'OK'
  END as status
FROM public.adult_profiles ap
LEFT JOIN auth.users u ON u.id = ap.user_id
WHERE ap.role IN ('parent', 'family_member')
ORDER BY ap.role, ap.created_at;

-- Expected result: All adult_profiles should have valid user_id references

-- =====================================================
-- VERIFICATION 7: No orphaned messages (all messages belong to valid conversations)
-- =====================================================

SELECT 
  COUNT(*) as orphaned_messages
FROM public.messages m
WHERE NOT EXISTS (
  SELECT 1 FROM public.conversations c WHERE c.id = m.conversation_id
);

-- Expected result: 0 (all messages belong to valid conversations)

-- =====================================================
-- VERIFICATION 8: Family members appear in child's family list
-- =====================================================
-- Verify that family members with same family_id as child appear correctly

-- Example: Replace with actual child_profile_id
/*
SELECT 
  ap.id as adult_profile_id,
  ap.name as adult_name,
  ap.role,
  ap.relationship_type,
  cp.id as child_profile_id,
  cp.name as child_name,
  CASE 
    WHEN ap.family_id = cp.family_id THEN 'SAME FAMILY'
    ELSE 'DIFFERENT FAMILY'
  END as family_match
FROM public.adult_profiles ap
CROSS JOIN public.child_profiles cp
WHERE cp.id = 'CHILD_PROFILE_ID_HERE'  -- Replace with actual child_profile_id
  AND ap.family_id = cp.family_id
  AND ap.role = 'family_member'
ORDER BY ap.relationship_type, ap.name;
*/

-- Expected result: All family members in the same family should appear

-- =====================================================
-- HELPER QUERIES: Find IDs for testing
-- =====================================================

-- Find a child that has conversations with multiple adults
SELECT 
  cp.id as child_profile_id,
  cp.name as child_name,
  COUNT(DISTINCT c.adult_id) as adult_count,
  COUNT(c.id) as conversation_count
FROM public.child_profiles cp
JOIN public.conversations c ON c.child_id = cp.id
GROUP BY cp.id, cp.name
HAVING COUNT(DISTINCT c.adult_id) > 1
ORDER BY adult_count DESC
LIMIT 1;

-- Find an adult that has conversations with multiple children
SELECT 
  ap.id as adult_profile_id,
  ap.name as adult_name,
  ap.role,
  COUNT(DISTINCT c.child_id) as child_count,
  COUNT(c.id) as conversation_count
FROM public.adult_profiles ap
JOIN public.conversations c ON c.adult_id = ap.id
GROUP BY ap.id, ap.name, ap.role
HAVING COUNT(DISTINCT c.child_id) > 1
ORDER BY child_count DESC
LIMIT 1;

-- =====================================================
-- AUTOMATED VERIFICATION QUERIES
-- =====================================================
-- These queries automatically find test cases and verify isolation

-- AUTO VERIFICATION 1: Two adults messaging same child
-- This finds a child with multiple conversations and shows they're isolated
SELECT 
  'VERIFICATION 1: Two adults messaging same child' as test_name,
  cp.id as child_profile_id,
  cp.name as child_name,
  COUNT(DISTINCT c.adult_id) as number_of_adults,
  COUNT(DISTINCT c.id) as number_of_conversations,
  CASE 
    WHEN COUNT(DISTINCT c.adult_id) = COUNT(DISTINCT c.id) THEN 'PASS: Each adult has separate conversation'
    ELSE 'FAIL: Conversation count mismatch'
  END as result
FROM public.child_profiles cp
JOIN public.conversations c ON c.child_id = cp.id
GROUP BY cp.id, cp.name
HAVING COUNT(DISTINCT c.adult_id) > 1;

-- AUTO VERIFICATION 2: Same adult messaging two children
-- This finds an adult with multiple conversations and shows they're separate
SELECT 
  'VERIFICATION 2: Same adult messaging two children' as test_name,
  ap.id as adult_profile_id,
  ap.name as adult_name,
  ap.role,
  COUNT(DISTINCT c.child_id) as number_of_children,
  COUNT(DISTINCT c.id) as number_of_conversations,
  CASE 
    WHEN COUNT(DISTINCT c.child_id) = COUNT(DISTINCT c.id) THEN 'PASS: Each child has separate conversation'
    ELSE 'FAIL: Conversation count mismatch'
  END as result
FROM public.adult_profiles ap
JOIN public.conversations c ON c.adult_id = ap.id
GROUP BY ap.id, ap.name, ap.role
HAVING COUNT(DISTINCT c.child_id) > 1;

-- AUTO VERIFICATION 3: Child sees one conversation per adult
-- This verifies each child has exactly one conversation per adult
SELECT 
  'VERIFICATION 3: Child sees one conversation per adult' as test_name,
  cp.id as child_profile_id,
  cp.name as child_name,
  COUNT(DISTINCT c.adult_id) as number_of_adults,
  COUNT(c.id) as total_conversations,
  CASE 
    WHEN COUNT(DISTINCT c.adult_id) = COUNT(c.id) THEN 'PASS: One conversation per adult'
    ELSE 'FAIL: Multiple conversations with same adult'
  END as result
FROM public.child_profiles cp
JOIN public.conversations c ON c.child_id = cp.id
GROUP BY cp.id, cp.name;

-- AUTO VERIFICATION 8: Family members in child's family
-- This shows all family members that should appear in each child's family list
SELECT 
  'VERIFICATION 8: Family members in child family' as test_name,
  cp.id as child_profile_id,
  cp.name as child_name,
  COUNT(DISTINCT CASE WHEN ap.role = 'parent' THEN ap.id END) as parent_count,
  COUNT(DISTINCT CASE WHEN ap.role = 'family_member' THEN ap.id END) as family_member_count,
  COUNT(DISTINCT ap.id) as total_adults_in_family
FROM public.child_profiles cp
JOIN public.adult_profiles ap ON ap.family_id = cp.family_id
GROUP BY cp.id, cp.name
ORDER BY cp.name;

-- =====================================================
-- Migration complete
-- =====================================================
-- Run these queries manually to verify the system is working correctly
-- The automated verification queries above will automatically find test cases

