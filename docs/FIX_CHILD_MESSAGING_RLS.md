# Fix Child Messaging RLS Policy

## Issue
Children cannot send messages - getting RLS violation error (code 42501):
```
new row violates row-level security policy for table "messages"
```

## Solution
Apply the migration that fixes the child message INSERT policy.

## Step 1: Open Supabase Dashboard

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **"SQL Editor"** in the left sidebar
4. Click **"New query"**

## Step 2: Run the Migration

### Option A: Copy from Migration File

1. Open the file: `supabase/migrations/20250124000000_fix_child_message_insert_rls_direct.sql`
2. Copy the **entire contents** (all 78 lines)
3. Paste into the Supabase SQL Editor
4. Click **"Run"** (or press `Ctrl+Enter` / `Cmd+Enter`)

### Option B: Use Supabase CLI (if installed)

```bash
cd kidscallhome
supabase migration up
```

## Step 3: Verify the Fix

After running the migration, verify the policy was created:

```sql
SELECT 
    policyname,
    cmd as command,
    roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
  AND policyname = 'Children can send messages';
```

**Expected result:**
- `policyname`: "Children can send messages"
- `cmd`: "INSERT"
- `roles`: "{anon}"

## Step 4: Test

1. Refresh your browser
2. As a child user, try sending a message
3. The message should send successfully without RLS errors

## What the Migration Does

1. **Ensures children table allows anonymous reads** - Required for the EXISTS check
2. **Drops old child message policies** - Removes any conflicting policies
3. **Creates new "Children can view their messages" policy** - Allows children to SELECT their messages
4. **Creates new "Children can send messages" policy** - Uses direct EXISTS check (no function dependency)

## Key Differences from Previous Migration

- **Previous**: Used `verify_child_can_send_message()` SECURITY DEFINER function (may fail if function not accessible)
- **New**: Uses direct `EXISTS` check (more reliable, no function dependency)

## Troubleshooting

### Error: "policy already exists"
- The migration has already been run
- Try refreshing your browser and testing again

### Error: "permission denied"
- Make sure you're logged in as a project owner/admin
- Check your Supabase project permissions

### Still getting RLS errors after migration
1. Verify the policy exists (see Step 3)
2. Check that the payload matches requirements:
   - `sender_type = 'child'`
   - `sender_id = child_id` (must be equal)
   - Child record exists in `children` table
3. Check browser console for detailed error messages

## Related Files

- Migration: `supabase/migrations/20250124000000_fix_child_message_insert_rls_direct.sql`
- Documentation: `docs/RLS_POLICY_COMPARISON.md`
- Frontend code: `src/pages/Chat.tsx`

