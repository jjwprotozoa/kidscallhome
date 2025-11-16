# Migration Guide: Transform Calls Table Schema

This guide will help you transform your existing `calls` table from using `caller_id`/`callee_id` to `child_id`/`parent_id`/`caller_type` while preserving all existing data.

## Prerequisites

1. Access to your Supabase dashboard: https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt
2. SQL Editor access
3. Backup of your database (recommended)

## Step-by-Step Process

### Step 1: Check Current Schema
Run this in SQL Editor to see what you're working with:

```sql
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
ORDER BY ordinal_position;
```

**Expected to see:** `caller_id`, `callee_id` (and possibly other columns)

### Step 2: Create Backup (IMPORTANT!)
Before making any changes, create a backup:

```sql
CREATE TABLE calls_backup AS SELECT *, NOW() as backup_created_at FROM calls;
```

### Step 3: Run Transformation
Open `transform_calls_safe.sql` in your SQL Editor and run it. This script will:
- Add new columns (`child_id`, `parent_id`, `caller_type`)
- Transform existing data
- Add constraints
- Verify the transformation

### Step 4: Verify Transformation
Run `verify_transformation.sql` to check:
- All columns exist
- No NULL values where they shouldn't be
- Foreign keys are valid
- Data relationships are correct

### Step 5: Update Policies
Run `update_policies_after_transform.sql` to:
- Remove old policies
- Create new policies that match the code expectations

### Step 6: Test the Application
1. Try creating a call from child dashboard
2. Check browser console for any errors
3. Verify parent receives the call notification

## Troubleshooting

### If transformation fails:
1. Check the error message
2. Review the backup table: `SELECT * FROM calls_backup LIMIT 10;`
3. Check if `children` table has the expected data

### If policies don't work:
1. Verify policies exist: Run `check_calls_policies.sql`
2. Check RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'calls';`

### If calls still don't work:
1. Check browser console for errors
2. Verify environment variables match your project
3. Check Supabase logs for RLS policy violations

## Rollback (if needed)

If something goes wrong, you can restore from backup:

```sql
-- Drop the transformed table
DROP TABLE IF EXISTS calls CASCADE;

-- Restore from backup
CREATE TABLE calls AS SELECT * FROM calls_backup;

-- Recreate any constraints that were on the original table
```

## Expected Final Schema

After transformation, your `calls` table should have:
- `id` (uuid, primary key)
- `child_id` (uuid, foreign key to children.id)
- `parent_id` (uuid)
- `caller_type` (text: 'parent' or 'child')
- `status` (text: 'ringing', 'active', 'ended')
- `offer` (jsonb)
- `answer` (jsonb)
- `ice_candidates` (jsonb)
- `created_at` (timestamptz)
- `ended_at` (timestamptz)

## Questions?

If you encounter issues, check:
1. The verification script output
2. Browser console errors
3. Supabase logs in the dashboard

