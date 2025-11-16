# Quick Fix for Parent-to-Child Call RLS Issues

## The Problem

Parent can't receive child's answer because RLS policies are blocking access.

**Symptom**: No `📡 [PARENT HANDLER] Received UPDATE event` logs in parent console.

## The Solution (2 Steps)

### Step 1: Check Current Policies

Run in Supabase SQL Editor:

```sql
-- Run CHECK_RLS_POLICIES_NOW.sql
```

Look for any policies showing `❌ MISSING`.

### Step 2: Fix All Policies

Run in Supabase SQL Editor:

```sql
-- Run FIX_RLS_POLICIES_MANUAL.sql
-- This creates all required policies without needing any functions
```

This script will:
- ✅ Create children table anon SELECT policy (required for parent policies)
- ✅ Create all child policies (SELECT, INSERT, UPDATE)
- ✅ Create all parent policies (SELECT, INSERT, UPDATE)
- ✅ Verify policies were created correctly

### Step 3: Verify Fix

Run `CHECK_RLS_POLICIES_NOW.sql` again - all policies should show `✅ EXISTS`.

## What Gets Fixed

1. **Children table**: Anon SELECT policy (required for parent SELECT policy's EXISTS subquery)
2. **Parent SELECT policy**: Allows parents to read ALL fields including `answer`
3. **Parent UPDATE policy**: Allows parents to update calls
4. **Child UPDATE policy**: Allows children to write their answer

## Test After Fixing

1. Parent initiates call to child
2. Child answers the call
3. Check parent console for:
   - `📡 [PARENT HANDLER] Received UPDATE event` ✅
   - `✅ [PARENT HANDLER] Answer received from child` ✅

If these logs appear, RLS is fixed!

