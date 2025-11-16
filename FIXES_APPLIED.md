# Fixes Applied for Call Signaling Issues

## Issues Identified

### 1. Parent to Child: InvalidStateError
**Error**: `Failed to execute 'createAnswer' on 'RTCPeerConnection': PeerConnection cannot create an answer in a state other than have-remote-offer or have-local-pranswer.`

**Root Cause**: The parent was trying to create an answer immediately after setting the remote description, without waiting for the signaling state to change. Also, if the offer didn't exist yet, it would try to create an answer anyway.

**Fix Applied**:
- Added proper waiting for signaling state change after `setRemoteDescription`
- Added handling for case where offer doesn't exist yet (waits for it via Realtime subscription)
- Added timeout protection for signaling state changes

### 2. Child to Parent: 400 Bad Request
**Error**: `PATCH ... 400 (Bad Request)` when updating call with offer

**Root Cause**: Could be:
- RLS policy WITH CHECK clause being too restrictive
- Invalid JSON format
- Missing error details in logs

**Fixes Applied**:
- Enhanced error logging to capture full error details (code, message, data)
- Created SQL script to fix RLS policy if needed (`fix_child_rls_with_check.sql`)
- Added better error categorization (RLS, validation, schema cache issues)

## Files Modified

### 1. `src/utils/callHandlers.ts`
- Fixed parent call handler to wait for signaling state before creating answer
- Added handling for incoming calls without offers yet
- Improved error handling and logging

### 2. `src/utils/childCallHandler.ts`
- Enhanced error logging for offer updates
- Added detailed error categorization
- Improved error messages for debugging

### 3. `fix_child_rls_with_check.sql` (NEW)
- SQL script to fix child UPDATE policy if RLS is blocking updates
- Makes WITH CHECK clause more permissive for SDP field updates

## Next Steps

### 1. Test the Fixes
1. **Child to Parent Call**:
   - Child initiates call
   - Check browser console for detailed error messages if 400 persists
   - If 400 persists, run `fix_child_rls_with_check.sql` in Supabase SQL Editor

2. **Parent to Child Call**:
   - Parent initiates call
   - Should now properly wait for signaling state before creating answer
   - Should handle case where child hasn't created offer yet

### 2. If 400 Error Persists
Run this in Supabase SQL Editor:
```sql
-- Run fix_child_rls_with_check.sql
```

Then check the browser console for the detailed error logs. The enhanced logging will show:
- Error code
- Error message
- Full error details
- The exact data being sent

### 3. Verify RLS Policies
The child UPDATE policy should allow updating `offer`, `answer`, and `ice_candidates`. If the policy is blocking updates, the fix script will resolve it.

## Debugging Tips

### Check Browser Console
The enhanced logging will show:
- `Update response:` with both data and error
- `Error code:` - helps identify the type of error
- `Error message:` - specific Supabase error
- `Offer data JSON:` - what's being sent to the database

### Common Error Codes
- `PGRST204` - Column not found (schema cache issue)
- `PGRST301` - RLS policy violation
- `42501` - Permission denied
- `23514` - Check constraint violation
- `400` - Bad Request (usually validation or format issue)

### Test RLS Policy
Run this query as the child user (anon role) to test if they can update:
```sql
-- This should work if RLS is correct
UPDATE public.calls 
SET offer = '{"type":"offer","sdp":"test"}'::jsonb 
WHERE id = '<call_id>' 
  AND EXISTS (
    SELECT 1 FROM public.children 
    WHERE children.id = calls.child_id
  );
```

## Expected Behavior After Fixes

1. **Child creates offer**: Should update successfully, or show detailed error if it fails
2. **Parent receives offer**: Should wait for signaling state, then create answer
3. **Parent creates offer**: Should work as before
4. **Child receives answer**: Should work as before

If issues persist, the enhanced error logging will provide the exact cause.

