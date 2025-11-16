# Fix PGRST204 Schema Cache Error

## The Problem
PostgREST's schema cache is out of sync. The `offer` column exists in the database but PostgREST doesn't know about it.

## Solution

### For Supabase Cloud:
1. Go to your Supabase Dashboard
2. Navigate to **Settings** → **API**
3. Click **"Reload schema"** button
4. Wait a few seconds for the cache to refresh
5. Try your app again

### For Local Supabase (CLI):
```bash
# Option 1: Restart Supabase
supabase stop
supabase start

# Option 2: Reset database (WARNING: This will delete all data)
supabase db reset
```

### Alternative: Verify Column Exists First
Run this in Supabase SQL Editor to verify the column exists:

```sql
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
  AND column_name IN ('offer', 'answer', 'ice_candidates');
```

If the columns don't exist, run `verify_and_fix_offer_column.sql` first.

## After Refreshing
The error should be resolved. If it persists:
1. Check that the columns actually exist (run the SQL above)
2. Verify RLS policies allow updates
3. Check browser console for any other errors

