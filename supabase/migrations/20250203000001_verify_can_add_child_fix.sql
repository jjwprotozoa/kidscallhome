-- Verification query to check if can_add_child function handles cancelled subscriptions
-- Run this to verify the fix was applied correctly

-- Check the function definition
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'can_add_child'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Test the function with a cancelled subscription (replace with your parent_id)
-- This should return TRUE if you have 4 children and allowed_children = 5
-- SELECT public.can_add_child('70888a10-ad5e-4764-8dff-537ad2da34d1'::uuid);

