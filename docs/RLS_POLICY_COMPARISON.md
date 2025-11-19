# RLS Policy Comparison: Children vs Parents for Messages

## Overview

This document explains the differences between RLS (Row Level Security) policies for children (anonymous users) vs parents (authenticated users) when sending messages.

## Key Differences

### 1. **User Role**

| Aspect | Children | Parents |
|--------|----------|---------|
| **Role** | `anon` (anonymous) | `authenticated` (logged in) |
| **Authentication** | No auth session | Has `auth.uid()` |
| **Identity** | Identified by `child_id` from localStorage | Identified by `auth.uid()` |

### 2. **INSERT Policy for Messages**

#### **Children (Anonymous)**
```sql
CREATE POLICY "Children can send messages"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  sender_type = 'child' AND
  sender_id = child_id AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = messages.child_id
    AND children.id = messages.sender_id
  )
);
```

**Requirements:**
- `sender_type = 'child'`
- `sender_id = child_id` (child can only send as themselves)
- Child record must exist in `children` table
- `sender_id` must match the `child_id` in the children table

#### **Parents (Authenticated)**
```sql
CREATE POLICY "Parents can send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'parent' AND
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = messages.child_id
    AND children.parent_id = auth.uid()
  )
);
```

**Requirements:**
- `sender_type = 'parent'`
- `sender_id = auth.uid()` (parent's authenticated user ID)
- Child record must exist in `children` table
- Child's `parent_id` must match `auth.uid()` (parent owns the child)

### 3. **SELECT Policy for Messages**

#### **Children (Anonymous)**
```sql
CREATE POLICY "Children can view their messages"
ON public.messages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = messages.child_id
  )
);
```

**Requirements:**
- Child record must exist in `children` table
- No ownership check (any child can view any child's messages - may need tightening)

#### **Parents (Authenticated)**
```sql
CREATE POLICY "Parents can view messages for their children"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.children
    WHERE children.id = messages.child_id
    AND children.parent_id = auth.uid()
  )
);
```

**Requirements:**
- Child record must exist
- Child's `parent_id` must match `auth.uid()` (parent owns the child)

### 4. **Why Children Need Different Approach**

1. **No Authentication**: Children don't have `auth.uid()`, so we can't use it for verification
2. **Anonymous Access**: Children use `anon` role, which has limited permissions
3. **Self-Identification**: Children are identified by their `child_id` stored in localStorage
4. **Verification**: We verify the child exists by checking the `children` table

### 5. **Common Issues and Solutions**

#### Issue: RLS Violation (Code 42501)
**Error:** `new row violates row-level security policy for table "messages"`

**Possible Causes:**
1. `sender_id` doesn't equal `child_id` (for children)
2. Child record doesn't exist in `children` table
3. Policy not applied or incorrectly configured
4. Function-based policy failing (if using SECURITY DEFINER function)

**Solution:**
- Ensure payload has `sender_id = child_id` for children
- Verify child record exists in database
- Use direct `EXISTS` check instead of function-based policy
- Run migration `20250124000000_fix_child_message_insert_rls_direct.sql`

### 6. **Payload Requirements**

#### For Children:
```typescript
{
  child_id: string,      // Must match child's ID
  sender_id: string,     // MUST equal child_id
  sender_type: "child",  // Must be "child"
  content: string        // Message content
}
```

#### For Parents:
```typescript
{
  child_id: string,           // Child they're messaging
  sender_id: string,          // MUST equal auth.uid()
  sender_type: "parent",      // Must be "parent"
  content: string             // Message content
}
```

### 7. **Migration History**

- **20250123000000**: Initial fix using SECURITY DEFINER function (may fail if function not accessible)
- **20250124000000**: Direct EXISTS check (more reliable, no function dependency)

## Testing

To verify policies are working:

1. **Check policies exist:**
```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY cmd, policyname;
```

2. **Test child insert (as anonymous):**
```sql
-- Should succeed if child exists
INSERT INTO messages (child_id, sender_id, sender_type, content)
VALUES ('child-uuid', 'child-uuid', 'child', 'Test message');
```

3. **Test parent insert (as authenticated):**
```sql
-- Should succeed if child belongs to parent
INSERT INTO messages (child_id, sender_id, sender_type, content)
VALUES ('child-uuid', auth.uid(), 'parent', 'Test message');
```

## References

- Migration: `supabase/migrations/20250124000000_fix_child_message_insert_rls_direct.sql`
- Production Fix: `docs/sql/FIX_MESSAGING_RLS_PRODUCTION.sql`
- Original Migration: `supabase/migrations/20250123000000_fix_child_messaging_rls.sql`

