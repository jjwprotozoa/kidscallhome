# Fix Parent Dashboard Slow Loading & Video/Audio Issues

## Problem Summary

1. **Parent dashboard takes long to load** - RLS policies use slow EXISTS subqueries without indexes
2. **Video and audio not working after connection** - ICE candidates and WebRTC connection issues

## Solution Overview

### Issue 1: Performance (Slow Dashboard Loading)

**Root Cause**: RLS policies use `EXISTS` subqueries on `children` table without indexes, causing slow queries.

**Fix**: Create indexes on `children.id` and `children.parent_id` to speed up EXISTS checks.

### Issue 2: Video/Audio Not Working

**Root Causes** (from WEBRTC_FIX_GUIDE.md):

1. ICE candidates overwriting each other (need separate `parent_ice_candidates` and `child_ice_candidates`)
2. Missing TURN servers for NAT traversal
3. ICE candidate exchange issues

## Step-by-Step Fix

### Step 1: Fix Performance (Run in Supabase SQL Editor)

```sql
-- Run FIX_PERFORMANCE_AND_WEBRTC.sql
-- This creates all necessary indexes
```

**OR** run manually:

```sql
-- Create indexes for children table (used in RLS EXISTS subqueries)
CREATE INDEX IF NOT EXISTS idx_children_id ON public.children(id);
CREATE INDEX IF NOT EXISTS idx_children_parent_id ON public.children(parent_id);
CREATE INDEX IF NOT EXISTS idx_children_id_parent_id ON public.children(id, parent_id);

-- Create indexes for calls table (used in parent/child queries)
CREATE INDEX IF NOT EXISTS idx_calls_parent_id ON public.calls(parent_id);
CREATE INDEX IF NOT EXISTS idx_calls_child_id ON public.calls(child_id);
CREATE INDEX IF NOT EXISTS idx_calls_parent_status ON public.calls(parent_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_child_status ON public.calls(child_id, status);

-- Update query statistics
ANALYZE public.children;
ANALYZE public.calls;
```

### Step 2: Fix ICE Candidates Schema (Run in Supabase SQL Editor)

```sql
-- Run fix_ice_candidates_schema.sql
-- This adds parent_ice_candidates and child_ice_candidates columns
```

**OR** run manually:

```sql
-- Add parent_ice_candidates column
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS parent_ice_candidates jsonb DEFAULT '[]'::jsonb;

-- Add child_ice_candidates column
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS child_ice_candidates jsonb DEFAULT '[]'::jsonb;
```

### Step 3: Verify RLS Policies Are Correct

```sql
-- Run CHECK_RLS_POLICIES_NOW.sql
-- All 7 policies should show ✅ EXISTS
```

If any are missing:

```sql
-- Run FIX_RLS_POLICIES_MANUAL.sql
```

### Step 4: Check WebRTC Code

According to `WEBRTC_FIX_GUIDE.md`, verify:

1. **ICE Candidates**: Code should use `parent_ice_candidates` and `child_ice_candidates` (not the old `ice_candidates` field)
2. **TURN Servers**: Check `src/hooks/useWebRTC.ts` - should have TURN servers for NAT traversal
3. **ICE Exchange**: Both handlers should read/write to correct fields

## Verification

### Performance Check

After creating indexes, parent dashboard should load much faster. Check:

1. Open parent dashboard
2. Check browser Network tab - `children` table query should be fast (< 100ms)
3. Check browser console - no slow query warnings

### Video/Audio Check

After fixes, test a call:

1. Parent initiates call to child
2. Child answers
3. Check console for:
   - `✅ [PARENT HANDLER] Answer received from child`
   - `✅ ICE STATE: ICE connection established - media should flow now!`
   - `✅ REMOTE TRACK: Track unmuted - MEDIA IS FLOWING!`
   - `✅ [VIDEO PLAY] Remote video playing successfully!`

If these logs appear, video/audio should work.

## Common Issues

### Dashboard Still Slow

- Check if indexes were created: `SELECT * FROM pg_indexes WHERE tablename IN ('children', 'calls');`
- Run `ANALYZE public.children; ANALYZE public.calls;` to update statistics
- Check browser console for specific slow queries

### Video/Audio Still Not Working

1. **Check ICE candidates**: Look for `🧊 [ICE CANDIDATE]` logs in console
2. **Check ICE connection state**: Should reach `connected` or `completed`
3. **Check TURN servers**: If behind NAT/firewall, TURN servers are required
4. **Check track states**: Console should show tracks unmuted and enabled

### RLS Still Blocking

- Run `CHECK_RLS_POLICIES_NOW.sql` to verify all policies exist
- Check browser Network tab for 403 errors
- Verify parent is authenticated (check `auth.uid()`)

## Files to Check

- `FIX_PERFORMANCE_AND_WEBRTC.sql` - Performance indexes
- `fix_ice_candidates_schema.sql` - ICE candidate columns
- `FIX_RLS_POLICIES_MANUAL.sql` - RLS policies
- `WEBRTC_FIX_GUIDE.md` - WebRTC troubleshooting
- `CHECK_RLS_POLICIES_NOW.sql` - Verify policies

## Quick Fix (All-in-One)

Run these in order in Supabase SQL Editor:

1. `FIX_PERFORMANCE_AND_WEBRTC.sql` - Creates indexes
2. `fix_ice_candidates_schema.sql` - Adds ICE candidate columns
3. `FIX_RLS_POLICIES_MANUAL.sql` - Ensures RLS policies are correct
4. `CHECK_RLS_POLICIES_NOW.sql` - Verify everything is fixed

Then test the call again.
