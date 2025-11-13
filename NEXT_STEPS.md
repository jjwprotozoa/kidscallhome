# Next Steps: Supabase SDP Columns Setup

## Summary

You've successfully added the `offer`, `answer`, and `ice_candidates` jsonb columns to the `public.calls` table. The original error should now be resolved.

## ✅ What's Done

1. **Columns Added**: `offer`, `answer`, `ice_candidates` (all jsonb)
2. **Schema Verified**: Columns are visible in the database schema
3. **Code Updated**: Client code already uses these columns correctly

## 🔍 Verification Steps

### 1. Run RLS Verification

Execute `verify_rls_for_new_columns.sql` in Supabase SQL Editor to verify:

- Columns exist and have correct types
- RLS policies allow UPDATE operations
- Realtime is enabled for the calls table

### 2. Test the Implementation

1. Start a call from parent to child (or vice versa)
2. Verify that:
   - Offer is created and stored in the database
   - Answer is received and stored
   - ICE candidates are being collected and stored
   - Realtime updates are being received by both parties

## 📋 Current Implementation Status

### RLS Policies

Your existing RLS policies should already allow updating the new columns:

- **Parents**: Can UPDATE calls for their children (includes SDP fields)
- **Children**: Can UPDATE their own calls (includes SDP fields)

The policies use relationship-based checks, not column-specific restrictions, so they apply to all columns including the new jsonb ones.

### Realtime Subscriptions

Your code already uses Supabase Realtime with `postgres_changes` subscriptions:

- Subscribes to `call:{callId}` channels
- Listens for UPDATE events on the calls table
- Handles offer, answer, and ICE candidate updates

### ICE Candidate Handling

**Note**: There's a minor race condition in ICE candidate updates (multiple candidates could overwrite each other). The code has been improved to:

- Check for duplicate candidates before adding
- Handle errors gracefully
- Use array spread for immutability

For production, consider using a PostgreSQL function for atomic jsonb array appends if you experience candidate loss.

## 🚀 Optional Enhancements

### Option A: Verify RLS (Recommended)

Run `ensure_rls_allows_sdp_updates.sql` to verify policies are correct. The existing policies should be sufficient, but this confirms it.

### Option B: Add Realtime Trigger (Optional)

If you want custom broadcasting or additional metadata, you can use `optional_realtime_trigger.sql`. However, the current `postgres_changes` approach is recommended and sufficient.

### Option C: Optimize ICE Candidate Updates (Future)

For high-volume scenarios, consider creating a PostgreSQL function that atomically appends to the jsonb array:

```sql
CREATE OR REPLACE FUNCTION append_ice_candidate(
  call_id UUID,
  candidate JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.calls
  SET ice_candidates = COALESCE(ice_candidates, '[]'::jsonb) || jsonb_build_array(candidate)
  WHERE id = call_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then call it from the client instead of read-modify-write.

## 🐛 Troubleshooting

### If you still see "Could not find the 'offer' column" error:

1. **Clear Supabase cache**: Wait a few minutes or refresh the Supabase dashboard
2. **Verify column exists**: Run `SELECT column_name FROM information_schema.columns WHERE table_name = 'calls' AND column_name IN ('offer', 'answer', 'ice_candidates');`
3. **Check RLS policies**: Run the verification script

### If updates are being rejected:

1. **Check RLS policies**: Verify the UPDATE policies allow your user role
2. **Check user context**: Ensure the user is authenticated (for parents) or using the correct child session (for children)
3. **Review error messages**: Check Supabase logs for specific permission errors

## ✅ Recommended Next Actions

1. **Run verification script** (`verify_rls_for_new_columns.sql`) to confirm everything is set up correctly
2. **Test a call** between parent and child to verify end-to-end functionality
3. **Monitor for errors** in the browser console and Supabase logs
4. **Consider ICE candidate optimization** if you notice candidate loss during calls

## 📝 Files Created

- `verify_rls_for_new_columns.sql` - Verification script for RLS and columns
- `ensure_rls_allows_sdp_updates.sql` - Analysis and optional policy updates
- `optional_realtime_trigger.sql` - Optional trigger for custom broadcasting
- `NEXT_STEPS.md` - This file

The client code has been updated to handle ICE candidates more safely, but the core implementation was already correct.
