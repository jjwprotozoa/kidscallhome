-- =====================================================
-- TEST MESSAGE PAYLOAD AGAINST RLS POLICIES
-- Replace the placeholder values with actual values from your console log
-- =====================================================

-- =====================================================
-- STEP 1: Test Parent Message Insert
-- Replace these values with actual values from browser console:
-- =====================================================
DO $$
DECLARE
    -- REPLACE THESE WITH VALUES FROM YOUR CONSOLE LOG
    test_sender_id TEXT := '{REPLACE_WITH_SENDER_ID_FROM_CONSOLE}';
    test_sender_type TEXT := '{REPLACE_WITH_SENDER_TYPE_FROM_CONSOLE}';
    test_child_id TEXT := '{REPLACE_WITH_CHILD_ID_FROM_CONSOLE}';
    test_auth_uid TEXT := '{REPLACE_WITH_AUTH_UID_FROM_CONSOLE}';
    
    -- Test results
    sender_type_check BOOLEAN;
    sender_id_check BOOLEAN;
    child_belongs_check BOOLEAN;
    all_checks_pass BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TESTING PARENT MESSAGE INSERT';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'sender_id: %', test_sender_id;
    RAISE NOTICE 'sender_type: %', test_sender_type;
    RAISE NOTICE 'child_id: %', test_child_id;
    RAISE NOTICE 'auth.uid() (expected): %', test_auth_uid;
    RAISE NOTICE '';
    
    -- Check 1: sender_type must be 'parent'
    sender_type_check := (test_sender_type = 'parent');
    RAISE NOTICE 'Check 1 - sender_type = ''parent'': %', 
        CASE WHEN sender_type_check THEN '✅ PASS' ELSE '❌ FAIL' END;
    IF NOT sender_type_check THEN
        RAISE NOTICE '  Expected: ''parent'', Got: ''%''', test_sender_type;
    END IF;
    
    -- Check 2: sender_id must equal auth.uid()
    sender_id_check := (test_sender_id = test_auth_uid);
    RAISE NOTICE 'Check 2 - sender_id = auth.uid(): %', 
        CASE WHEN sender_id_check THEN '✅ PASS' ELSE '❌ FAIL' END;
    IF NOT sender_id_check THEN
        RAISE NOTICE '  sender_id: %', test_sender_id;
        RAISE NOTICE '  auth.uid(): %', test_auth_uid;
        RAISE NOTICE '  These do NOT match!';
    END IF;
    
    -- Check 3: child_id must belong to parent
    SELECT EXISTS (
        SELECT 1 FROM public.children
        WHERE id = test_child_id::uuid
        AND parent_id = test_auth_uid::uuid
    ) INTO child_belongs_check;
    
    RAISE NOTICE 'Check 3 - child belongs to parent: %', 
        CASE WHEN child_belongs_check THEN '✅ PASS' ELSE '❌ FAIL' END;
    IF NOT child_belongs_check THEN
        RAISE NOTICE '  Checking if child exists...';
        IF EXISTS (SELECT 1 FROM public.children WHERE id = test_child_id::uuid) THEN
            RAISE NOTICE '  Child exists but parent_id does not match auth.uid()';
            RAISE NOTICE '  Child parent_id: %', (SELECT parent_id FROM public.children WHERE id = test_child_id::uuid);
        ELSE
            RAISE NOTICE '  Child does not exist in database!';
        END IF;
    END IF;
    
    -- Final result
    all_checks_pass := sender_type_check AND sender_id_check AND child_belongs_check;
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    IF all_checks_pass THEN
        RAISE NOTICE '✅ ALL CHECKS PASS - RLS should allow insert';
    ELSE
        RAISE NOTICE '❌ CHECKS FAILED - RLS will block insert (403)';
    END IF;
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- STEP 2: Test Child Message Insert
-- Replace these values with actual values from browser console:
-- =====================================================
DO $$
DECLARE
    -- REPLACE THESE WITH VALUES FROM YOUR CONSOLE LOG
    test_sender_id TEXT := '{REPLACE_WITH_SENDER_ID_FROM_CONSOLE}';
    test_sender_type TEXT := '{REPLACE_WITH_SENDER_TYPE_FROM_CONSOLE}';
    test_child_id TEXT := '{REPLACE_WITH_CHILD_ID_FROM_CONSOLE}';
    
    -- Test results
    sender_type_check BOOLEAN;
    sender_id_matches_child_id BOOLEAN;
    child_exists_check BOOLEAN;
    all_checks_pass BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TESTING CHILD MESSAGE INSERT';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'sender_id: %', test_sender_id;
    RAISE NOTICE 'sender_type: %', test_sender_type;
    RAISE NOTICE 'child_id: %', test_child_id;
    RAISE NOTICE '';
    
    -- Check 1: sender_type must be 'child'
    sender_type_check := (test_sender_type = 'child');
    RAISE NOTICE 'Check 1 - sender_type = ''child'': %', 
        CASE WHEN sender_type_check THEN '✅ PASS' ELSE '❌ FAIL' END;
    IF NOT sender_type_check THEN
        RAISE NOTICE '  Expected: ''child'', Got: ''%''', test_sender_type;
    END IF;
    
    -- Check 2: sender_id must equal child_id
    sender_id_matches_child_id := (test_sender_id = test_child_id);
    RAISE NOTICE 'Check 2 - sender_id = child_id: %', 
        CASE WHEN sender_id_matches_child_id THEN '✅ PASS' ELSE '❌ FAIL' END;
    IF NOT sender_id_matches_child_id THEN
        RAISE NOTICE '  sender_id: %', test_sender_id;
        RAISE NOTICE '  child_id: %', test_child_id;
        RAISE NOTICE '  These do NOT match!';
    END IF;
    
    -- Check 3: child must exist and sender_id must match child.id
    SELECT EXISTS (
        SELECT 1 FROM public.children
        WHERE id = test_child_id::uuid
        AND id = test_sender_id::uuid
    ) INTO child_exists_check;
    
    RAISE NOTICE 'Check 3 - child exists and sender_id matches: %', 
        CASE WHEN child_exists_check THEN '✅ PASS' ELSE '❌ FAIL' END;
    IF NOT child_exists_check THEN
        IF EXISTS (SELECT 1 FROM public.children WHERE id = test_child_id::uuid) THEN
            RAISE NOTICE '  Child exists but sender_id does not match child.id';
        ELSE
            RAISE NOTICE '  Child does not exist in database!';
        END IF;
    END IF;
    
    -- Final result
    all_checks_pass := sender_type_check AND sender_id_matches_child_id AND child_exists_check;
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    IF all_checks_pass THEN
        RAISE NOTICE '✅ ALL CHECKS PASS - RLS should allow insert';
    ELSE
        RAISE NOTICE '❌ CHECKS FAILED - RLS will block insert (403)';
    END IF;
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- STEP 3: Quick verification queries
-- =====================================================

-- Verify parent-child relationship exists
-- Replace {parent_uuid} and {child_uuid} with actual values
/*
SELECT 
    c.id as child_id,
    c.name as child_name,
    c.parent_id as child_parent_id,
    p.id as parent_auth_id,
    CASE 
        WHEN c.parent_id = p.id THEN '✅ Match'
        ELSE '❌ Mismatch'
    END as relationship_status
FROM public.children c
LEFT JOIN auth.users p ON p.id = c.parent_id
WHERE c.id = '{child_uuid}'::uuid;
*/

-- Check if sender_id exists in auth.users (for parents)
-- Replace {sender_id} with actual value from console
/*
SELECT 
    id,
    email,
    CASE 
        WHEN id = '{sender_id}'::uuid THEN '✅ This is auth.uid()'
        ELSE '❌ Not matching'
    END as auth_check
FROM auth.users
WHERE id = '{sender_id}'::uuid;
*/

