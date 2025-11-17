# Family Code Migration Guide

## Issue
If you see the error: `column parents.family_code does not exist`, it means the database migration hasn't been run yet.

## Solution: Run the Migration

### Step 1: Open Supabase Dashboard
1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project

### Step 2: Open SQL Editor
1. Click on "SQL Editor" in the left sidebar
2. Click "New query"

### Step 3: Run the Migration
1. Open the file: `supabase/migrations/20250121000000_add_family_code.sql`
2. Copy the entire contents
3. Paste into the SQL Editor
4. Click "Run" (or press Ctrl+Enter / Cmd+Enter)

### Step 4: Verify
After running the migration, you should see:
- ✅ The `family_code` column added to the `parents` table
- ✅ All existing parents have been assigned family codes
- ✅ The `generate_unique_family_code()` function created
- ✅ Indexes created for performance

### What the Migration Does
1. Adds `family_code` column to `parents` table (unique, indexed)
2. Creates function to generate unique 6-character family codes
3. Backfills existing parents with family codes
4. Updates the parent signup trigger to auto-generate family codes
5. Updates login code generation to include family code format

### After Migration
- Refresh your browser
- The "Add Child" dialog should now show your family code
- Parent dashboard will display the family code prominently
- Children can now log in using: `familyCode-color/animal-number` format

## Troubleshooting

### Error: "column already exists"
- The migration has already been run
- Refresh your browser and try again

### Error: "permission denied"
- Make sure you're logged in as a project owner/admin
- Check your Supabase project permissions

### Family code shows as null
- The migration ran but didn't backfill existing parents
- Run this SQL to generate codes for existing parents:
```sql
UPDATE public.parents 
SET family_code = public.generate_unique_family_code()
WHERE family_code IS NULL;
```

## Need Help?
Check the console logs for detailed error messages. The improved error handling will show specific guidance based on the error type.

