# Complete RLS Policies Implementation

## Overview

This document describes the complete Row-Level Security (RLS) policies that enforce the refined permissions matrix at the database level.

## Migration: `20251209000000_enforce_refined_permissions_matrix.sql`

### What This Migration Enforces

#### ✅ INSERT Policies (Communication Control)

1. **No Adult-to-Adult Communication**

   - `can_users_communicate()` function returns `false` immediately if both sides are `parent` or `family_member`
   - All INSERT policies call this function before allowing inserts
   - **Result**: Impossible to insert adult-to-adult messages/calls at database level

2. **Blocking Overrides Everything**

   - `can_users_communicate()` calls `is_contact_blocked()` before allowing communication
   - Blocked contacts cannot send messages/calls even if application tries
   - **Exception**: Child cannot block their own parent (safety feature)

3. **Child Cannot Block Own Parent**

   - `is_contact_blocked()` returns `false` if checking child's own parent
   - RLS INSERT policy on `blocked_contacts` prevents creating block for own parent
   - **Result**: Parents always have oversight access, even if child wants privacy

4. **Parent ↔ Own Child Only**

   - Parent message/call policies verify parent is linked to child via `child_family_memberships`
   - Must have role `'parent'` in the same family
   - **Result**: Parents can only communicate with their own children

5. **Family Member ↔ Same Family Only**

   - Family member policies check shared `family_id` between `adult_profiles` and `child_family_memberships`
   - **Result**: Family members can only communicate with children in their own family

6. **Child-to-Child Requires Approval**
   - `can_users_communicate()` calls `can_children_communicate()` for child-to-child
   - Requires approved connection in `child_connections` table
   - **Status**: Logic is ready, but child message/call policies need schema updates (see TODOs)

#### ✅ SELECT Policies (Oversight & Privacy)

1. **Messages SELECT Policy**

   - Senders can see their own messages
   - Parents can see messages for their own children (oversight)
   - Family members can see messages with children in their family
   - Children can see their own messages (via anon role or parent verification)
   - **Result**: Parents have oversight, but adults cannot see other adults' messages

2. **Calls SELECT Policy**
   - Callers can see their own calls
   - Parents can see calls for their own children (oversight)
   - Family members can see calls with children in their family
   - Children can see their own calls (via anon role or parent verification)
   - **Result**: Parents have oversight, but adults cannot see other adults' calls

## Current Limitations & TODOs

### 1. Child-to-Child Messaging

**Current State:**

- `can_users_communicate()` function supports child-to-child logic
- Child message INSERT policy assumes receiver is always parent
- Schema limitation: `messages` table has no `receiver_id` or `conversation_id`

**What's Needed:**

1. Add `conversation_id` or `receiver_id` column to `messages` table
2. Update child message INSERT policy to:
   - Determine receiver from conversation context
   - Pass correct `receiver_id` and `receiver_type` to `can_users_communicate()`
3. Ensure `can_children_communicate()` is called for child-to-child messages

**Example Future Policy:**

```sql
-- When conversation_id is added:
can_users_communicate(
  p_sender_id := messages.child_id,
  p_sender_type := 'child',
  p_receiver_id := (
    SELECT receiver_id FROM conversations
    WHERE id = messages.conversation_id
  ),
  p_receiver_type := (
    SELECT receiver_type FROM conversations
    WHERE id = messages.conversation_id
  )
)
```

### 2. Child-to-Child Calls

**Current State:**

- `can_users_communicate()` function supports child-to-child logic
- Child call INSERT policy assumes receiver is always parent (`parent_id` must be set)
- Schema limitation: `calls` table has no `callee_id` for child-to-child calls

**What's Needed:**

1. Add `callee_id` column to `calls` table (or use `conversation_id`)
2. Update child call INSERT policy to:
   - Use `callee_id` when present (child-to-child)
   - Use `parent_id` when present (child-to-parent)
   - Pass correct `receiver_id` and `receiver_type` to `can_users_communicate()`

**Example Future Policy:**

```sql
-- When callee_id is added:
can_users_communicate(
  p_sender_id := calls.child_id,
  p_sender_type := 'child',
  p_receiver_id := COALESCE(calls.callee_id, calls.parent_id),
  p_receiver_type := CASE
    WHEN calls.callee_id IS NOT NULL THEN 'child'
    ELSE 'parent'
  END
)
```

## Database Functions

### `can_users_communicate()`

Central permission check function that enforces all rules:

- ✅ Prevents adult-to-adult communication
- ✅ Checks blocking (with parent exception)
- ✅ Verifies child-to-child approvals
- ✅ Enforces family boundaries
- ✅ Returns `false` if any rule is violated

### `is_contact_blocked()`

Checks if a contact is blocked for a child:

- ✅ Returns `false` if checking child's own parent (safety feature)
- ✅ Checks active blocks (unblocked_at IS NULL)
- ✅ Supports blocking adults or other children

### `can_children_communicate()`

Checks if two children can communicate:

- ✅ Requires approved connection in `child_connections` table
- ✅ Status must be `'approved'`

## Testing Checklist

Before deploying, verify:

- [ ] No adult-to-adult messages/calls can be inserted
- [ ] Child cannot block their own parent
- [ ] Blocking prevents communication (except parent exception)
- [ ] Child-to-child requires approved connection (when implemented)
- [ ] Family members restricted to same family
- [ ] Parents can see their children's messages/calls (SELECT)
- [ ] Adults cannot see other adults' messages/calls (SELECT)
- [ ] Children can see their own messages/calls (SELECT)

## Schema Requirements for Full Child-to-Child Support

When implementing child-to-child messaging/calls, you'll need:

1. **For Messages:**

   - Option A: Add `conversation_id UUID REFERENCES conversations(id)`
   - Option B: Add `receiver_id UUID` and `receiver_type TEXT`
   - Update child message INSERT policy to use these fields

2. **For Calls:**

   - Option A: Add `callee_id UUID REFERENCES child_profiles(id)`
   - Option B: Add `conversation_id UUID REFERENCES conversations(id)`
   - Update child call INSERT policy to use these fields

3. **Update Policies:**
   - Modify child INSERT policies to determine receiver from new columns
   - Ensure `can_users_communicate()` is called with correct receiver info
   - Test that child-to-child approval is properly checked

## Security Guarantees

With this migration in place:

1. ✅ **Database-level enforcement**: Rules cannot be bypassed by application bugs
2. ✅ **No adult-to-adult**: Impossible to insert adult-to-adult communication
3. ✅ **Parent oversight**: Parents can always see their children's data
4. ✅ **Privacy**: Adults cannot see other adults' data
5. ✅ **Blocking works**: Blocked contacts cannot communicate
6. ✅ **Safety feature**: Child cannot block own parent

All rules are enforced at the database level via RLS policies and security definer functions.
