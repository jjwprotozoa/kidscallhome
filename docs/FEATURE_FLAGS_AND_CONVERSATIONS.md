# Feature Flags and Conversations System

## Overview

This system provides future-proof infrastructure for child-to-child messaging and calls, gated by feature flags that can be toggled per family without migrations.

## Architecture

### 1. Conversations Table
- Supports 1:1 and group conversations (future-proof for group chats)
- Each conversation has a `type` ('one_to_one' or 'group')
- Conversations are created by parents

### 2. Conversation Participants
- Links users/children to conversations
- `user_id` can be:
  - `auth.users.id` for adults (parents/family members)
  - `child_profiles.id` for children
- `role` indicates participant type: 'parent', 'family_member', or 'child'

### 3. Feature Flags
- Per-family feature flags stored in `family_feature_flags` table
- Keys: `'child_to_child_messaging'` and `'child_to_child_calls'`
- Can be toggled via admin UI without migrations or restarts

### 4. Schema Updates
- `messages` table: Added `conversation_id` and `receiver_type` (nullable for backward compatibility)
- `calls` table: Added `conversation_id` and `callee_id` (nullable for backward compatibility)

## How It Works

### Feature Flag Check Flow

1. **Child-to-Child Communication Request**
   - Child A wants to message/call Child B
   - Application checks if connection is approved (via `child_connections` table)
   - If approved, application checks feature flag via `is_feature_enabled_for_children()`
   - Feature flag checks if **either** child's family has the feature enabled
   - If enabled, communication is allowed; otherwise blocked

2. **Database-Level Enforcement**
   - `can_users_communicate()` function checks feature flag for messaging
   - `can_users_call()` function checks feature flag for calls
   - RLS policies call these functions before allowing INSERT
   - **Result**: Even if application code has bugs, database enforces the rules

### Feature Flag Logic

```sql
-- Feature is enabled if EITHER child's family has it enabled
-- This allows child-to-child even if only one family opts in
is_feature_enabled_for_children(child_a_id, child_b_id, 'child_to_child_messaging')
```

**Why "either" family?**
- More permissive approach: if one family enables it, their child can communicate
- Prevents one family from blocking communication if the other family wants it
- Parents can still control via connection approval (both must approve)

## Admin UI Implementation

### Toggle Feature Flags

Create an admin page that allows parents to toggle features:

```typescript
// Example: Toggle child-to-child messaging for a family
const toggleFeature = async (familyId: string, key: string, enabled: boolean) => {
  await supabase
    .from('family_feature_flags')
    .upsert({
      family_id: familyId,
      key,
      enabled,
    }, {
      onConflict: 'family_id,key'
    });
};

// Usage
await toggleFeature(familyId, 'child_to_child_messaging', true);
await toggleFeature(familyId, 'child_to_child_calls', false);
```

### UI Components Needed

1. **Feature Flags Toggle Page** (for parents)
   - Show current state of flags for their family
   - Toggle switches for:
     - "Enable child-to-child messaging"
     - "Enable child-to-child calls"
   - Save changes (upserts to `family_feature_flags`)

2. **Developer Admin Page** (optional, for testing)
   - View all families and their feature flags
   - Toggle flags for any family
   - Useful for testing and debugging

## Creating Conversations

### For Child-to-Child Messaging

```typescript
// 1. Create conversation
const { data: conversation } = await supabase
  .from('conversations')
  .insert({ type: 'one_to_one' })
  .select()
  .single();

// 2. Add participants
await supabase
  .from('conversation_participants')
  .insert([
    { conversation_id: conversation.id, user_id: childA_id, role: 'child' },
    { conversation_id: conversation.id, user_id: childB_id, role: 'child' }
  ]);

// 3. Send message with conversation_id
await supabase
  .from('messages')
  .insert({
    conversation_id: conversation.id,
    sender_id: childA_id,
    sender_type: 'child',
    child_id: childA_id,
    receiver_type: 'child',
    content: 'Hello!'
  });
```

### For Child-to-Parent (Legacy)

```typescript
// No conversation needed - works as before
await supabase
  .from('messages')
  .insert({
    sender_id: child_id,
    sender_type: 'child',
    child_id: child_id,
    content: 'Hi parent!'
    // conversation_id is NULL - uses legacy parent lookup
  });
```

## Migration Strategy

### Phase 1: Current State (Backward Compatible)
- ✅ Existing child-to-parent messages/calls work unchanged
- ✅ New conversation infrastructure is in place
- ✅ Feature flags default to `false` (child-to-child disabled)

### Phase 2: Enable Per Family
- Parents toggle feature flags in admin UI
- When enabled, child-to-child becomes available for that family
- Application code creates conversations for child-to-child

### Phase 3: Full Migration (Optional)
- Gradually migrate existing messages to use conversations
- Eventually make `conversation_id` required (breaking change)

## Testing

### Test Feature Flag Toggle

```sql
-- Enable child-to-child messaging for a family
INSERT INTO family_feature_flags (family_id, key, enabled)
VALUES ('family-uuid', 'child_to_child_messaging', true)
ON CONFLICT (family_id, key) 
DO UPDATE SET enabled = true;

-- Disable it
UPDATE family_feature_flags
SET enabled = false
WHERE family_id = 'family-uuid' AND key = 'child_to_child_messaging';

-- Check if enabled for children
SELECT is_feature_enabled_for_children('child-a-id', 'child-b-id', 'child_to_child_messaging');
```

### Test RLS Policies

```sql
-- As child, try to send message to another child
-- Should fail if:
-- 1. Connection not approved
-- 2. Feature flag not enabled
-- 3. Contact is blocked

-- Should succeed if:
-- 1. Connection is approved
-- 2. Feature flag is enabled (for either family)
-- 3. Contact is not blocked
```

## Security Guarantees

1. ✅ **Database-level enforcement**: Feature flags checked in RLS policies
2. ✅ **No bypass possible**: Even if application code has bugs, database enforces rules
3. ✅ **Per-family control**: Each family can enable/disable independently
4. ✅ **Backward compatible**: Legacy messages/calls work unchanged
5. ✅ **Approval still required**: Feature flag doesn't bypass connection approval

## Key Functions

### `is_feature_enabled_for_children(child_a_id, child_b_id, feature_key)`
- Checks if feature is enabled for at least one of the children's families
- Returns `true` if either family has it enabled
- Used by `can_users_communicate()` and `can_users_call()`

### `can_users_communicate(...)`
- Updated to check `'child_to_child_messaging'` feature flag
- All other rules still apply (blocking, approval, etc.)

### `can_users_call(...)`
- Same as `can_users_communicate()` but checks `'child_to_child_calls'` flag
- Separate flag allows independent control of messaging vs calls

## Future Enhancements

1. **Group Chats**: Conversations table already supports `type = 'group'`
2. **Global Feature Flags**: Add tenant-level flags for app-wide features
3. **Feature Flag Analytics**: Track which families use which features
4. **Gradual Rollout**: Enable for beta families first, then all

## Troubleshooting

### Feature Flag Not Working

1. **Check if flag exists:**
   ```sql
   SELECT * FROM family_feature_flags 
   WHERE family_id = 'your-family-id' AND key = 'child_to_child_messaging';
   ```

2. **Check if enabled:**
   ```sql
   SELECT is_feature_enabled_for_children('child-a', 'child-b', 'child_to_child_messaging');
   ```

3. **Verify connection is approved:**
   ```sql
   SELECT * FROM child_connections 
   WHERE requester_child_id IN ('child-a', 'child-b')
     AND target_child_id IN ('child-a', 'child-b')
     AND status = 'approved';
   ```

### Messages Not Creating

1. Check RLS policies are correct
2. Verify conversation exists and has participants
3. Check feature flag is enabled
4. Verify connection is approved
5. Check blocking status

## Summary

This system provides:
- ✅ Future-proof infrastructure for child-to-child communication
- ✅ Feature flags that can be toggled without migrations
- ✅ Database-level enforcement of all rules
- ✅ Backward compatibility with existing messages/calls
- ✅ Per-family control of features
- ✅ Ready for production use

The infrastructure is complete and ready. Just add the admin UI to toggle flags, and child-to-child will work immediately when enabled!

