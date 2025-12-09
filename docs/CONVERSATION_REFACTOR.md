# Conversation-Based Messaging Refactor

## Overview

This refactor implements a WhatsApp-style conversation model where each conversation is a private 1-on-1 chat between an adult (parent or family member) and a child. The system uses profile-based IDs (`adult_profiles.id` and `child_profiles.id`) to ensure stable references and proper message isolation - each user can only see messages from conversations they are part of.

## Problem Solved

**Before:** Family members could see parents' messages with children because messages were only filtered by `child_id` and `sender_type`, not by the specific conversation participants. Conversations referenced raw auth UIDs directly.

**After:** Each conversation is between exactly one adult profile and one child profile. Messages belong to a conversation, and users can only see messages from conversations where they are a participant. All conversation participants use profile IDs, not raw auth UIDs.

## Profile-Based Architecture

### Profile Tables

The system uses profile tables to provide stable IDs that align with the account/profile model:

#### `adult_profiles` Table

Unified table for both parents and family members:

```sql
CREATE TABLE public.adult_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  family_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'family_member')),
  relationship_type TEXT, -- 'grandparent', 'aunt', 'uncle', 'cousin', 'other'
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (user_id, family_id, role)
);
```

#### `child_profiles` Table

```sql
CREATE TABLE public.child_profiles (
  id UUID PRIMARY KEY,
  family_id UUID NOT NULL,
  name TEXT NOT NULL,
  login_code TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  avatar_color TEXT DEFAULT '#3B82F6',
  age INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Key Points:**

- `adult_profiles.id` is used as `conversations.adult_id` (not `auth.uid()`)
- `child_profiles.id` is used as `conversations.child_id` (not raw child ID)
- `family_id` groups all adults and children in the same family
- Profile IDs are stable and don't change when auth changes

## Data Model Changes

### `conversations` Table

```sql
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY,
  adult_id UUID NOT NULL REFERENCES adult_profiles(id),  -- Profile ID, not auth UID
  child_id UUID NOT NULL REFERENCES child_profiles(id),   -- Profile ID
  adult_role TEXT NOT NULL CHECK (adult_role IN ('parent', 'family_member')), -- Denormalized for performance
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (adult_id, child_id)  -- One conversation per adult-child pair
);
```

**Important:**

- `adult_id` references `adult_profiles.id` (not `auth.users.id`)
- `child_id` references `child_profiles.id`
- Each `(adult_id, child_id)` pair has exactly one conversation

### `messages` Table

```sql
CREATE TABLE public.messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),  -- REQUIRED, no backward compatibility
  child_id UUID NOT NULL,  -- Kept for compatibility, but conversation_id is primary
  sender_type TEXT NOT NULL CHECK (sender_type IN ('parent', 'child', 'family_member')),
  sender_id UUID NOT NULL,
  family_member_id UUID,  -- Set when sender_type = 'family_member'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);
```

**Critical:** `conversation_id` is **NOT NULL** and **REQUIRED** for all messages. There is no backward compatibility.

## Key Functions

### `get_or_create_conversation(p_adult_id, p_adult_role, p_child_id)`

Database function that ensures each adult-child pair has exactly one conversation. Uses profile IDs.

**Parameters:**

- `p_adult_id`: `adult_profiles.id` (not `auth.uid()`)
- `p_adult_role`: 'parent' | 'family_member'
- `p_child_id`: `child_profiles.id`

**Usage in application:**

```typescript
import {
  getOrCreateConversation,
  getCurrentAdultProfileId,
  getChildProfileId,
} from "@/utils/conversations";

// Resolve profile IDs first
const adultProfileId = await getCurrentAdultProfileId(
  userId,
  familyId,
  "parent"
);
const childProfileId = await getChildProfileId(childId);

// Then create/get conversation
const conversationId = await getOrCreateConversation(
  adultProfileId, // Profile ID, not auth UID
  "parent",
  childProfileId // Profile ID
);
```

### Profile Resolution Helpers

**`getCurrentAdultProfileId(userId, familyId, role)`**

- Resolves `auth.uid()` to `adult_profiles.id`
- Must be called before creating conversations
- Never use raw `auth.uid()` as conversation participant ID

**`getChildProfileId(childId)`**

- Resolves child ID to `child_profiles.id`
- `child_profiles.id` should match `children.id` after migration

## RLS Policies

### Conversations Table

- **Adults** can view conversations where `conversations.adult_id = their adult_profiles.id`
  - Resolved via: `auth.uid()` → `adult_profiles.user_id` → `adult_profiles.id`
- **Children** can view conversations where `conversations.child_id = their child_profiles.id`
  - Verified at application level (children use anonymous auth)

### Messages Table

- **Adults** can view messages where `messages.conversation_id` belongs to a conversation where `conversations.adult_id = their adult_profiles.id`
- **Children** can view messages where `messages.conversation_id` belongs to a conversation where `conversations.child_id = their child_profiles.id`
- **All policies require `conversation_id IS NOT NULL`** - no backward compatibility

## Application Code Changes

### Profile ID Resolution

**Critical:** All conversation operations must resolve profile IDs first:

```typescript
// ❌ WRONG - Don't use raw auth UID
const convId = await getOrCreateConversation(user.id, "parent", childId);

// ✅ CORRECT - Resolve profile IDs first
const adultProfileId = await getCurrentAdultProfileId(
  user.id,
  familyId,
  "parent"
);
const childProfileId = await getChildProfileId(childId);
const convId = await getOrCreateConversation(
  adultProfileId,
  "parent",
  childProfileId
);
```

### Chat Component (`src/pages/Chat.tsx`)

1. **Initialization:**

   - Resolve current user's `adult_profiles.id` from auth context
   - Resolve child's `child_profiles.id` from child data
   - Get or create conversation using profile IDs
   - **Never** use raw `auth.uid()` directly

2. **Message Fetching:**

   - **REQUIRES** `conversation_id` - no fallback to `child_id`
   - Query: `.eq("conversation_id", conversationId)`
   - Shows error if `conversation_id` is missing

3. **Message Sending:**
   - Resolve profile IDs before sending
   - Automatically creates conversation if it doesn't exist
   - Always includes `conversation_id` in payload

### Helper Functions (`src/utils/conversations.ts`)

Updated functions:

- `getOrCreateConversation(adultProfileId, adultRole, childProfileId)` - Uses profile IDs
- `getConversationId(adultProfileId, childProfileId)` - Uses profile IDs
- `getUserConversations(adultProfileId)` - Uses profile ID
- `getChildConversations(childProfileId)` - Uses profile ID
- `getCurrentAdultProfileId(userId, familyId, role)` - **NEW** - Resolves profile ID
- `getChildProfileId(childId)` - **NEW** - Resolves profile ID

## Family Member Registration

When a parent adds a family member:

1. **Invitation Created:** `family_members` record created with `status = 'pending'`
2. **Profile Created on Signup:** When family member accepts invitation and signs up:
   - `handle_new_family_member()` trigger creates `adult_profiles` record
   - Links `user_id` to the new auth user
   - Sets `family_id` to parent's ID
   - Sets `role = 'family_member'`
3. **Appears in Family List:** Family member automatically appears in child's family list (same `family_id`)
4. **Can Have Conversations:** Family member can now create conversations with children in their family

## Security Fixes

1. **Never query messages by `child_id` alone** - Always require `conversation_id`
2. **Remove all backward compatibility** - `conversation_id` is NOT NULL and required
3. **Enforce conversation creation** - Always create conversation before sending first message
4. **RLS checks conversation ownership** - Verify user is participant before allowing access
5. **Always use profile IDs** - Never use raw auth UIDs directly as conversation participant IDs
6. **Profile ID resolution** - All RLS policies and queries resolve profile IDs from auth context

## Migration Strategy

The migration includes:

1. **Phase 0:** Create `adult_profiles` and `child_profiles` tables, migrate existing data
2. **Phase 1:** Refactor conversations to use `adult_id`/`child_id` (profile IDs)
3. **Phase 2:** Update frontend to resolve profile IDs before all conversation operations
4. **Phase 3:** Tighten RLS policies, remove backward compatibility

**No Backward Compatibility:** Unlike the initial refactor, this version requires `conversation_id` for all messages. All existing messages are migrated to have `conversation_id` before the constraint is applied.

## Testing Checklist

- [ ] Parent can send/receive messages with child
- [ ] Family member can send/receive messages with child
- [ ] **Two different adults messaging same child see different conversations** (different `conversation_id`)
- [ ] **Same adult messaging two different children sees two separate conversations**
- [ ] **Child sees one conversation per adult** (each backed by unique `(adult_id, child_id)` conversation)
- [ ] Family member **cannot** see parent's messages with same child
- [ ] Parent **cannot** see family member's messages with same child
- [ ] Profile IDs are correctly resolved from auth context
- [ ] New family members automatically appear in child's family list
- [ ] Realtime updates work correctly
- [ ] Message read tracking works
- [ ] Unread message counts are correct

## Verification Queries

See `supabase/migrations/20251207000004_verification_queries.sql` for test queries to verify:

- Two adults messaging same child have different conversations
- Same adult messaging two children has separate conversations
- Child sees one conversation per adult
- All messages have `conversation_id`
- All conversations use profile IDs
- Profile ID resolution works correctly

## Future Enhancements

1. **Conversation List:** Show list of conversations instead of children list
2. **Last Message Preview:** Show last message in conversation list
3. **Unread Counts:** Show unread count per conversation
4. **Conversation Search:** Search conversations by participant name

## Notes

- Children use anonymous auth, so their access is handled at application level
- The `child_id` column is kept for compatibility but `conversation_id` is primary
- Conversations are automatically created when first message is sent
- Each adult-child pair has exactly one conversation (enforced by unique constraint)
- Profile IDs provide stable references that don't change with auth changes
- All conversation operations must resolve profile IDs from auth context first
