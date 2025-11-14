# RLS Policy Maintenance Guide

## Overview

This project uses a guard system to ensure Row-Level Security (RLS) policies for the `calls` table never break. The system includes:

1. **Verification Function**: Checks if all required policies exist and are correct
2. **Auto-Fix Function**: Automatically repairs any missing or broken policies
3. **Migration Guard**: Ensures policies are correct when migrations run

## Quick Verification

To check if policies are correct, run:

```sql
SELECT * FROM public.verify_call_rls_policies();
```

This will show:

- ✅ `OK` - Policy exists and is correct
- ❌ `MISSING` - Policy doesn't exist
- ❌ `INVALID` - Policy exists but is missing required clauses (e.g., WITH CHECK)

## Auto-Fix

If issues are found, automatically fix them:

```sql
SELECT * FROM public.auto_fix_call_rls_policies();
```

This will:

- Create missing policies
- Fix policies missing WITH CHECK clauses
- Ensure all policies have correct configurations

## Required Policies

### Children Table

- ✅ `Anyone can verify login codes` (SELECT, anon) - **CRITICAL**: Required for call policies to work

### Calls Table - Child Policies (anon role)

- ✅ `Children can insert calls they initiate` (INSERT) - **MUST have WITH CHECK**
- ✅ `Children can view their own calls` (SELECT)
- ✅ `Children can update their own calls` (UPDATE)

### Calls Table - Parent Policies (authenticated role)

- ✅ `Parents can insert calls` (INSERT) - **MUST have WITH CHECK**
- ✅ `Parents can view calls for their children` (SELECT)
- ✅ `Parents can update calls` (UPDATE)

## Common Issues and Fixes

### Issue: "new row violates row-level security policy"

**Cause**: INSERT policy missing WITH CHECK clause

**Fix**: Run auto-fix function:

```sql
SELECT * FROM public.auto_fix_call_rls_policies();
```

### Issue: Child can't create calls

**Cause**: Children table doesn't allow anonymous reads

**Fix**: The auto-fix function will create the policy, or manually:

```sql
CREATE POLICY "Anyone can verify login codes"
ON public.children
FOR SELECT
TO anon
USING (true);
```

### Issue: Policies exist but still failing

**Cause**: WITH CHECK clause might be using EXISTS instead of IN subquery or function

**Fix**: The auto-fix function will recreate policies with correct syntax

## Maintenance Schedule

### Before Deploying

1. Run verification: `SELECT * FROM public.verify_call_rls_policies();`
2. Fix any issues: `SELECT * FROM public.auto_fix_call_rls_policies();`
3. Verify again to confirm: `SELECT * FROM public.verify_call_rls_policies();`

### After Database Changes

If you modify the `calls` or `children` tables:

1. Run auto-fix to ensure policies are still correct
2. Test both child-to-parent and parent-to-child calls

### Monthly Check

Run verification function to ensure nothing has broken:

```sql
SELECT * FROM public.verify_call_rls_policies();
```

## Migration Integration

The guard migration (`20250120000002_ensure_call_rls_policies_guard.sql`) automatically:

- Creates verification and auto-fix functions
- Runs auto-fix when migration executes
- Shows verification results

This means policies are automatically fixed whenever migrations run.

## Testing

After fixing policies, test:

1. **Child-to-Parent Call**: Child should be able to initiate calls
2. **Parent-to-Child Call**: Parent should be able to initiate calls
3. **Call Updates**: Both should be able to update call status, offer, answer, etc.

## Emergency Fix

If everything breaks, run the comprehensive fix:

```sql
-- Run the comprehensive diagnostic and fix
\i DIAGNOSE_AND_FIX_CALLS_NOW.sql

-- Or use the auto-fix function
SELECT * FROM public.auto_fix_call_rls_policies();

-- Verify everything is fixed
SELECT * FROM public.verify_call_rls_policies();
```

## Notes

- The guard system uses `SECURITY DEFINER` functions to ensure they can read from tables even when RLS is enabled
- Policies are checked for existence AND correctness (e.g., WITH CHECK clauses)
- The auto-fix function is idempotent - safe to run multiple times
- All functions are granted to appropriate roles for security
