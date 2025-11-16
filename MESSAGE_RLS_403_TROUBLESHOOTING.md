# Message RLS 403 Error Troubleshooting Guide

## Quick Diagnosis Steps

### 1. Check Browser Console Logs

After sending a message, check the browser console for:

```
📤 [MESSAGE INSERT] Payload: {
  child_id: "...",
  sender_id: "...",
  sender_type: "parent" or "child",
  ...
}
```

### 2. Verify Payload Matches RLS Requirements

#### For Parent Messages (sender_type = "parent"):

✅ **CORRECT:**
```javascript
{
  sender_id: auth.user.id,  // Must equal auth.uid()
  sender_type: "parent",     // Exact string, lowercase
  child_id: child.id,        // Must belong to parent
  content: "message text"
}
```

❌ **WRONG:**
```javascript
{
  sender_id: parentTable.id,     // ❌ Not auth.uid()
  sender_type: "Parent",         // ❌ Wrong case
  sender_type: "PARENT",         // ❌ Wrong case
  sender_id: undefined,          // ❌ Missing
  child_id: undefined            // ❌ Missing
}
```

#### For Child Messages (sender_type = "child"):

✅ **CORRECT:**
```javascript
{
  sender_id: child.id,      // Must equal child_id
  sender_type: "child",     // Exact string, lowercase
  child_id: child.id,       // Must equal sender_id
  content: "message text"
}
```

❌ **WRONG:**
```javascript
{
  sender_id: child.parent_id,  // ❌ Should be child.id
  sender_id: child.id + "x",   // ❌ Doesn't match child_id
  sender_type: "Child",        // ❌ Wrong case
  sender_id: undefined         // ❌ Missing
}
```

---

## Common Issues & Fixes

### Issue #1: `sender_id` is `undefined`

**Symptom:** Console shows `sender_id: undefined`

**Cause:** `auth.getUser()` failed or returned null

**Fix:** The updated `Chat.tsx` now validates this and throws a clear error.

**Check:**
```javascript
// In browser console:
const { data: { user } } = await supabase.auth.getUser();
console.log("Current user:", user?.id);
```

---

### Issue #2: `sender_id` doesn't match `auth.uid()` for parents

**Symptom:** Parent gets 403, console shows `sender_id` different from `auth_uid`

**Cause:** Using `parents.id` from database instead of `auth.user.id`

**Fix:** Always use `auth.user.id` for parents:
```javascript
// ✅ CORRECT
const { data: { user } } = await supabase.auth.getUser();
const senderId = user.id;

// ❌ WRONG
const senderId = parentData.id;  // This is from parents table, not auth.users
```

**Verify in SQL:**
```sql
-- Check if parents.id matches auth.users.id
SELECT p.id as parent_table_id, au.id as auth_users_id
FROM public.parents p
JOIN auth.users au ON au.id = p.id
WHERE p.id = '{your_parent_id}';
```

---

### Issue #3: Wrong `sender_type` case

**Symptom:** 403 error, payload shows `sender_type: "Parent"` or `"PARENT"`

**Cause:** Case sensitivity - RLS requires exact match: `'parent'` or `'child'`

**Fix:** Use lowercase strings:
```javascript
// ✅ CORRECT
sender_type: isChild ? "child" : "parent"

// ❌ WRONG
sender_type: isChild ? "Child" : "Parent"
sender_type: isChild ? "CHILD" : "PARENT"
```

---

### Issue #4: `child_id` doesn't belong to parent

**Symptom:** Parent gets 403, console shows valid `sender_id` and `sender_type`

**Cause:** Trying to message a child that doesn't belong to the parent

**Fix:** Verify parent-child relationship:
```sql
-- Check if child belongs to parent
SELECT c.id, c.name, c.parent_id, p.id as auth_parent_id
FROM public.children c
JOIN auth.users p ON p.id = c.parent_id
WHERE c.id = '{child_id_from_payload}'
  AND c.parent_id = '{sender_id_from_payload}';
```

**In Frontend:** Ensure you're using the correct `childId` from the route params or state.

---

### Issue #5: Child `sender_id` doesn't match `child_id`

**Symptom:** Child gets 403, console shows `sender_id` ≠ `child_id`

**Cause:** Using wrong ID for `sender_id`

**Fix:** For children, `sender_id` MUST equal `child_id`:
```javascript
// ✅ CORRECT
const senderId = childData.id;
const childId = childData.id;
// sender_id === child_id

// ❌ WRONG
const senderId = childData.parent_id;  // Wrong!
const senderId = "some-other-id";      // Wrong!
```

---

## Debugging Checklist

When you get a 403 error:

- [ ] Check browser console for `📤 [MESSAGE INSERT] Payload:` log
- [ ] Verify `sender_id` is not `undefined`
- [ ] For parents: Verify `sender_id === auth_uid` in console log
- [ ] Verify `sender_type` is exactly `"parent"` or `"child"` (lowercase)
- [ ] Verify `child_id` is not `undefined`
- [ ] Check `❌ [MESSAGE INSERT] Error:` log for details
- [ ] Run `diagnose_message_rls_403.sql` in Supabase SQL Editor
- [ ] Verify parent-child relationship exists in database

---

## Quick Test Queries

### Test Parent Can Insert Message

Replace `{parent_uuid}` and `{child_uuid}` with values from console log:

```sql
-- Simulate parent insert check
SELECT 
    'parent' = 'parent' as sender_type_ok,
    '{parent_uuid}' = '{parent_uuid}' as sender_id_ok,
    EXISTS (
        SELECT 1 FROM public.children
        WHERE id = '{child_uuid}'::uuid
        AND parent_id = '{parent_uuid}'::uuid
    ) as child_belongs_to_parent;
```

All should return `true`.

### Test Child Can Insert Message

Replace `{child_uuid}` with value from console log:

```sql
-- Simulate child insert check
SELECT 
    'child' = 'child' as sender_type_ok,
    '{child_uuid}' = '{child_uuid}' as sender_id_matches_child_id,
    EXISTS (
        SELECT 1 FROM public.children
        WHERE id = '{child_uuid}'::uuid
        AND id = '{child_uuid}'::uuid
    ) as child_exists;
```

All should return `true`.

---

## Next Steps

1. **Send a message** and check browser console
2. **Copy the payload** from `📤 [MESSAGE INSERT] Payload:` log
3. **Run diagnostic SQL** with the actual values
4. **Compare** payload values to RLS requirements above
5. **Fix** the mismatch in frontend code

The updated `Chat.tsx` now includes comprehensive logging - use it to identify the exact mismatch!

