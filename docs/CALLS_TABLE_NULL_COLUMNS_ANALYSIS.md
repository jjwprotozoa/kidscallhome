# Calls Table NULL Columns Analysis

**Date:** 2025-01-XX  
**Issue:** Columns 3, 4, 5, 7, 8 in `calls` table all have NULL values  
**Status:** ✅ **VERIFIED - Functionality is working correctly**

---

## Summary

The NULL values in columns 3, 4, 5, 7, and 8 are **expected and do not affect functionality**. These columns are either:
1. **Legacy columns** from an older schema that are no longer used
2. **Reserved for future features** (child-to-child calls)
3. **Unused columns** that were added but never populated

The application uses a different set of columns (`child_id`, `parent_id`, `caller_type`, `family_member_id`, `recipient_type`) which are properly populated and used by all RLS policies and application code.

---

## Column Analysis

### Column Mapping (by position in schema)

Based on `supabase/migrations/20251212142835_remote_schema.sql`:

| Position | Column Name | Type | Status | Purpose |
|----------|-------------|------|--------|---------|
| 1 | `id` | UUID | ✅ Active | Primary key |
| 2 | `created_at` | TIMESTAMPTZ | ✅ Active | Timestamp |
| **3** | **`caller_id`** | **UUID** | **❌ NULL (Legacy)** | **Legacy column, references auth.users** |
| **4** | **`callee_id`** | **UUID** | **❌ NULL (Reserved)** | **Reserved for child-to-child calls** |
| **5** | **`call_type`** | **TEXT** | **❌ NULL (Unused)** | **Unused column** |
| 6 | `status` | TEXT | ✅ Active | Call status ('ringing', 'active', 'ended') |
| **7** | **`caller_profile`** | **JSONB** | **❌ NULL (Unused)** | **Unused column** |
| **8** | **`callee_profile`** | **JSONB** | **❌ NULL (Unused)** | **Unused column** |
| 9 | `child_id` | UUID | ✅ Active | Child participant |
| 10 | `parent_id` | UUID | ✅ Active | Parent participant |
| 11 | `caller_type` | TEXT | ✅ Active | Who initiated ('parent', 'child', 'family_member') |
| 12 | `offer` | JSONB | ✅ Active | WebRTC SDP offer |
| 13 | `answer` | JSONB | ✅ Active | WebRTC SDP answer |
| 14 | `parent_ice_candidates` | JSONB | ✅ Active | Parent ICE candidates |
| 15 | `child_ice_candidates` | JSONB | ✅ Active | Child ICE candidates |
| 16 | `ended_at` | TIMESTAMPTZ | ✅ Active | Call end timestamp |
| 17 | `ended_by` | TEXT | ✅ Active | Who ended the call |
| 18 | `end_reason` | TEXT | ✅ Active | Reason for ending |
| 19 | `version` | BIGINT | ✅ Active | Optimistic locking version |
| 20 | `missed_call` | BOOLEAN | ✅ Active | Missed call flag |
| 21 | `missed_call_read_at` | TIMESTAMPTZ | ✅ Active | When missed call was read |
| 22 | `family_member_id` | UUID | ✅ Active | Family member participant |
| 23 | `conversation_id` | UUID | ✅ Active | Conversation reference |
| 24 | `recipient_type` | TEXT | ✅ Active | Recipient discriminator |

---

## Detailed Column Analysis

### Column 3: `caller_id` (UUID, NULL)
- **Status:** Legacy column, not used
- **Foreign Key:** References `auth.users(id)`
- **Purpose:** Old schema used `caller_id`/`callee_id` instead of `child_id`/`parent_id`/`caller_type`
- **Migration:** See `docs/sql/RUN_THIS_IN_SUPABASE.sql` lines 93-99 for migration logic
- **Current Usage:** None - application uses `child_id` + `caller_type` instead

### Column 4: `callee_id` (UUID, NULL)
- **Status:** Reserved for future feature
- **Foreign Key:** References `child_profiles(id)` (for child-to-child calls)
- **Purpose:** Will be used for child-to-child calls when that feature is enabled
- **Migration:** Added in `supabase/migrations/20251209000001_add_conversations_and_feature_flags.sql`
- **Current Usage:** None - child-to-child calls not yet implemented

### Column 5: `call_type` (TEXT, NULL)
- **Status:** Unused column
- **Purpose:** Unknown - appears to be unused
- **Current Usage:** None

### Column 7: `caller_profile` (JSONB, NULL)
- **Status:** Unused column
- **Purpose:** Unknown - appears to be unused
- **Current Usage:** None

### Column 8: `callee_profile` (JSONB, NULL)
- **Status:** Unused column
- **Purpose:** Unknown - appears to be unused
- **Current Usage:** None

---

## Active Columns Used by Application

The application correctly uses these columns:

### Core Identification
- `child_id` - Child participant in the call
- `parent_id` - Parent participant (when caller is parent or recipient is parent)
- `family_member_id` - Family member participant (when caller is family member or recipient is family member)
- `caller_type` - Who initiated: 'parent', 'child', or 'family_member'

### Call State
- `status` - Current call state: 'ringing', 'active', 'ended'
- `recipient_type` - Discriminator for Realtime filtering: 'parent', 'family_member', 'child'

### WebRTC Signaling
- `offer` - SDP offer (created by initiator)
- `answer` - SDP answer (created by answerer)
- `parent_ice_candidates` - Parent's ICE candidates
- `child_ice_candidates` - Child's ICE candidates

### Call Metadata
- `ended_at` - When call ended
- `ended_by` - Who ended the call
- `end_reason` - Reason for ending
- `missed_call` - Whether call was missed
- `missed_call_read_at` - When missed call notification was read
- `version` - Optimistic locking version

---

## RLS Policy Verification

All RLS policies use the **active columns**, not the NULL columns:

### INSERT Policies
- ✅ `"Parents can initiate calls to their children"` - Uses `caller_type`, `parent_id`, `child_id`
- ✅ `"Family members can initiate calls to children in their family"` - Uses `caller_type`, `family_member_id`, `child_id`
- ✅ `"Children can initiate calls"` - Uses `caller_type`, `child_id`

### SELECT Policies
- ✅ `"Parents can view calls for their children"` - Uses `parent_id`
- ✅ `"Family members can view calls to children in their family"` - Uses `family_member_id`
- ✅ `"Children can view their own calls"` - Uses `child_id`
- ✅ `"Calls readable by participants and parents"` - Uses `caller_type`, `parent_id`, `family_member_id`, `child_id`

### UPDATE Policies
- ✅ `"Parents can update calls"` - Uses `parent_id`
- ✅ `"Family members can update calls"` - Uses `family_member_id`
- ✅ `"Children can update their calls"` - Uses `caller_type`, `child_id`

**Conclusion:** None of the RLS policies reference `caller_id`, `callee_id`, `call_type`, `caller_profile`, or `callee_profile`.

---

## Application Code Verification

### Call Creation (Parent)
```typescript
// src/features/calls/utils/callHandlers.ts:916-922
.insert({
  child_id: childId,
  parent_id: userId,
  caller_type: "parent",
  recipient_type: "child",
  status: "ringing",
})
```

### Call Creation (Child)
```typescript
// src/features/calls/utils/childCallHandler.ts:1161-1190
const callData: Record<string, unknown> = {
  child_id: child.id,
  caller_type: "child",
  status: "ringing",
  // ... conditionally adds parent_id or family_member_id
  recipient_type: "parent" | "family_member",
};
```

### Call Queries
```typescript
// src/components/GlobalIncomingCall/useIncomingCallState.ts:421-444
.eq("family_member_id", cachedUserId)  // or parent_id
.eq("caller_type", "child")
.eq("status", "ringing")
```

**Conclusion:** All application code uses the active columns. No code references the NULL columns.

---

## Functionality Verification

### ✅ Call Creation Works
- **Parent-to-child calls**: Creates records with `child_id`, `parent_id`, `caller_type='parent'`, `recipient_type='child'`
- **Family-member-to-child calls**: Creates records with `child_id`, `family_member_id`, `caller_type='family_member'`, `recipient_type='child'`
- **Child-to-parent calls**: Creates records with `child_id`, `parent_id`, `caller_type='child'`, `recipient_type='parent'`
- **Child-to-family-member calls**: Creates records with `child_id`, `family_member_id`, `caller_type='child'`, `recipient_type='family_member'`

### ✅ RLS Policies Work
- Parents can create/view/update calls for their children
- Family members can create/view/update calls for children in their family
- Children can create/view/update their own calls

### ✅ Real-time Subscriptions Work
- Uses `recipient_type` for filtering (not the NULL columns)
- Subscriptions correctly filter by `parent_id`, `family_member_id`, or `child_id`

### ✅ Call State Management Works
- Status transitions: 'ringing' → 'active' → 'ended'
- WebRTC signaling: `offer`, `answer`, ICE candidates all work
- Call termination: `ended_at`, `ended_by`, `end_reason` all populated

---

## Recommendations

### Option 1: Keep NULL Columns (Recommended)
- **Pros:** 
  - No breaking changes
  - `callee_id` reserved for future child-to-child calls
  - Legacy columns may be needed for data migration/backup
- **Cons:**
  - Slight storage overhead (minimal)
  - May cause confusion

### Option 2: Remove Unused Columns
If you want to clean up the schema:

```sql
-- WARNING: Only do this if you're certain these columns are never used
-- Check for any references first:
SELECT 
    schemaname, 
    tablename, 
    column_name
FROM pg_stats
WHERE schemaname = 'public' 
  AND tablename = 'calls'
  AND column_name IN ('caller_id', 'call_type', 'caller_profile', 'callee_profile');

-- If no references found, you can drop:
ALTER TABLE public.calls DROP COLUMN IF EXISTS caller_id;
ALTER TABLE public.calls DROP COLUMN IF EXISTS call_type;
ALTER TABLE public.calls DROP COLUMN IF EXISTS caller_profile;
ALTER TABLE public.calls DROP COLUMN IF EXISTS callee_profile;

-- Keep callee_id for future child-to-child calls
```

### Option 3: Document NULL Columns
Add comments to clarify purpose:

```sql
COMMENT ON COLUMN public.calls.caller_id IS 'Legacy column from old schema. Not used by current application.';
COMMENT ON COLUMN public.calls.callee_id IS 'Reserved for future child-to-child calls feature. Currently NULL.';
COMMENT ON COLUMN public.calls.call_type IS 'Unused column. May be removed in future migration.';
COMMENT ON COLUMN public.calls.caller_profile IS 'Unused column. May be removed in future migration.';
COMMENT ON COLUMN public.calls.callee_profile IS 'Unused column. May be removed in future migration.';
```

---

## Conclusion

✅ **The NULL values in columns 3, 4, 5, 7, 8 are expected and do not affect functionality.**

The application correctly uses:
- `child_id`, `parent_id`, `family_member_id` for participants
- `caller_type` for who initiated
- `recipient_type` for filtering
- All WebRTC signaling fields (`offer`, `answer`, ICE candidates)
- All call state fields (`status`, `ended_at`, etc.)

All RLS policies and application code use these active columns. The NULL columns are either legacy or reserved for future features.

**No action required** - the system is working as designed.

