# Check RLS for Parent-to-Child Calls

## Quick Check

If parent-to-child calls aren't working (no video/audio), RLS policies might be blocking the parent from reading the child's answer.

**Symptom**: Child answers the call, but parent never receives the answer. Console shows:

- ✅ Child successfully creates and sends answer
- ❌ No `📡 [PARENT HANDLER] Received UPDATE event` logs
- ❌ No `✅ [PARENT HANDLER] Answer received from child` logs

### Step 1: Run Diagnostic

Run in Supabase SQL Editor:

**Option A: If verification function exists:**

```sql
SELECT * FROM public.verify_call_rls_policies();
```

**Option B: If verification function doesn't exist (most common):**

```sql
-- Run CHECK_RLS_POLICIES_NOW.sql
-- OR run DIAGNOSE_PARENT_TO_CHILD_RLS.sql
```

Look for:

- ✅ `EXISTS` or `OK` - All policies are correct
- ❌ `MISSING` or `INVALID` - Policies need fixing

### Step 2: Fix Policies

**Use the existing manual fix script (recommended):**

```sql
-- Run FIX_RLS_POLICIES_MANUAL.sql
-- This script creates all required policies without needing verification functions
```

**OR** if auto-fix function exists:

```sql
SELECT * FROM public.auto_fix_call_rls_policies();
```

### Step 3: Verify Again

Run the diagnostic again to confirm all policies are in place:

```sql
-- Run CHECK_RLS_POLICIES_NOW.sql
-- All policies should show ✅ EXISTS status
```

## Critical Policies for Parent-to-Child Calls

For parent-to-child calls to work, these policies MUST exist:

1. **Parents can view calls for their children** (SELECT)

   - Allows parent to read the child's `answer` field
   - Allows parent to read `child_ice_candidates` field

2. **Children can update their own calls** (UPDATE)

   - Allows child to write their `answer` to the database
   - Allows child to write `child_ice_candidates` to the database

3. **Parents can update calls** (UPDATE)
   - Allows parent to write their `offer` and `parent_ice_candidates`

## Test After Fixing

1. Parent initiates call to child
2. Child answers the call
3. Check browser console for:
   - `✅ [PARENT HANDLER] Answer received from child`
   - `✅ [PARENT HANDLER] Remote description set successfully`
   - If these don't appear, RLS might be blocking the read

## If Still Not Working

### Check Browser Console

1. **Parent side console** - Look for:

   - `📡 [PARENT HANDLER] Received UPDATE event` - Should appear when child answers
   - `✅ [PARENT HANDLER] Answer received from child` - Should appear after UPDATE
   - If these don't appear, RLS is blocking the realtime subscription

2. **Network tab** - Check for failed requests:
   - Look for failed requests to `/rest/v1/calls`
   - Error 403 = RLS blocking access
   - Error 406 = RLS policy issue

### Common RLS Issues

1. **Children table missing anon SELECT policy**

   - Parent SELECT policy uses `EXISTS` subquery on children table
   - If children table doesn't allow anon reads, the EXISTS fails silently
   - **Fix**: Run `FIX_PARENT_TO_CHILD_RLS_NOW.sql` Step 1

2. **Parent SELECT policy missing or incorrect**

   - Policy must check `calls.parent_id = auth.uid()`
   - Policy must allow reading ALL fields including `answer`
   - **Fix**: Run `FIX_PARENT_TO_CHILD_RLS_NOW.sql` Step 2

3. **Realtime subscription blocked**
   - Supabase realtime is subject to RLS
   - If parent can't SELECT the answer field, they won't receive it in realtime events
   - **Fix**: Ensure parent SELECT policy allows reading answer field

### Manual Test

To test if RLS is working, run this query as a parent user:

```sql
-- Replace CALL_ID with an actual call ID
SELECT id, answer, status, child_id, parent_id
FROM calls
WHERE parent_id = auth.uid()
AND id = 'CALL_ID';
```

If this query returns the row with the answer field populated, RLS is working. If it returns empty or errors, RLS is blocking access.
