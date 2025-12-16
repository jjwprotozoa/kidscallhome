# Parent Children RLS Fix

## Issue Summary
Parents cannot see their children on `/parent/children` route despite:
- Children existing in `public.children` with correct `parent_id`
- Parent user ID: `70888a10-ad5e-4764-8dff-537ad2da34d1`
- Four children owned by that parent (Jolene, Bev, Alex, Stella)

## Root Cause Analysis

### Code Issue (Fixed)
The `ParentChildrenList.tsx` component was missing explicit `parent_id` filtering in the query. This has been fixed to match the pattern used throughout the codebase.

### RLS Policy Issue (Needs Migration)
The RLS policy on `public.children` should allow parents to see their children via `parent_id = auth.uid()`, but there may be:
1. Conflicting policies
2. Policy evaluation issues
3. JWT/auth context problems

## Solution

### 1. Code Fix (Already Applied)
Updated `src/pages/ParentChildrenList.tsx` to explicitly filter by `parent_id`:

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  throw new Error("Not authenticated");
}

const { data, error } = await supabase
  .from("children")
  .select("*")
  .eq("parent_id", user.id) // Explicit filter
  .order("created_at", { ascending: false });
```

### 2. RLS Policy Fix (Migration Required)
Run the migration: `supabase/migrations/20251210000000_fix_parent_view_children_rls.sql`

This migration:
- Drops all existing SELECT policies on `children` table
- Creates a clean "Parents can view own children" policy: `parent_id = auth.uid()`
- Preserves anonymous access for login code verification
- Verifies policies were created correctly

## Verification Steps

### Step 1: Run Diagnostic SQL
Run `docs/sql/DIAGNOSE_CHILDREN_RLS.sql` to:
- Check RLS status
- List all policies
- Verify parent/children relationship
- Test policy evaluation

### Step 2: Run Migration
```bash
# Apply the migration
supabase migration up
```

### Step 3: Test as Parent
1. Log in as parent (`70888a10-ad5e-4764-8dff-537ad2da34d1`)
2. Navigate to `/parent/children`
3. Should see all 4 children

### Step 4: Verify JWT/Auth Context
If still not working, check:
```sql
-- In Supabase SQL Editor (as the parent user)
SELECT auth.uid() as current_user_id;
-- Should return: 70888a10-ad5e-4764-8dff-537ad2da34d1

-- Test the policy directly
SELECT * FROM children;
-- Should return 4 rows
```

## Common Issues

### Issue: `auth.uid()` returns NULL
**Cause**: User not properly authenticated or JWT not being sent
**Fix**: 
- Verify Authorization header is being sent
- Check JWT token is valid
- Ensure user is logged in

### Issue: Policy exists but still blocked
**Cause**: Multiple policies with conflicting logic
**Fix**: Run migration to drop and recreate policies cleanly

### Issue: Works in SQL Editor but not in app
**Cause**: App not sending JWT token or using wrong Supabase client
**Fix**: 
- Verify `supabase.auth.getSession()` returns valid session
- Check network tab for Authorization header
- Ensure Supabase client is properly initialized

## Files Changed

1. `src/pages/ParentChildrenList.tsx` - Added explicit `parent_id` filter
2. `supabase/migrations/20251210000000_fix_parent_view_children_rls.sql` - RLS policy fix
3. `docs/sql/DIAGNOSE_CHILDREN_RLS.sql` - Diagnostic queries

## Next Steps

1. ✅ Code fix applied
2. ⏳ Run migration to fix RLS policies
3. ⏳ Test as parent user
4. ⏳ Verify all 4 children appear

If issues persist after migration, check JWT token and auth context using the diagnostic SQL.

