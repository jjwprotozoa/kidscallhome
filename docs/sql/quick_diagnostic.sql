-- Quick Diagnostic: Check Child and Parent/Family Member Configuration
-- Run this in Supabase SQL Editor to see the current state

-- Most recent call with validation
SELECT 
    c.id as call_id,
    c.caller_type,
    c.status,
    c.answer IS NOT NULL as has_answer,
    c.child_id,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.children WHERE children.id = c.child_id) 
        THEN '✅ Found in children'
        WHEN EXISTS (SELECT 1 FROM public.child_profiles WHERE child_profiles.id = c.child_id)
        THEN '✅ Found in child_profiles'
        ELSE '❌ NOT FOUND in either table!'
    END as child_id_validation,
    c.parent_id,
    c.family_member_id,
    c.recipient_type,
    COALESCE(
        (SELECT name FROM public.children WHERE children.id = c.child_id),
        (SELECT name FROM public.child_profiles WHERE child_profiles.id = c.child_id),
        'Unknown'
    ) as child_name,
    COALESCE(
        (SELECT name FROM public.adult_profiles WHERE adult_profiles.user_id = c.parent_id AND adult_profiles.role = 'parent'),
        (SELECT name FROM public.adult_profiles WHERE adult_profiles.user_id = c.family_member_id AND adult_profiles.role = 'family_member'),
        'Unknown'
    ) as recipient_name,
    c.created_at
FROM public.calls c
ORDER BY c.created_at DESC
LIMIT 5;

