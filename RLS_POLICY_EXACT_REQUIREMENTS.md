# Exact RLS Policy Requirements

Based on your actual database policies, here's **exactly** what RLS checks:

---

## ✅ Parent INSERT Policy Requirements

**Policy:** `"Parents can send messages"`  
**Role:** `authenticated`  
**WITH CHECK expression:**
```sql
sender_type = 'parent'::text 
AND 
sender_id = auth.uid() 
AND 
EXISTS (
    SELECT 1 FROM children
    WHERE children.id = messages.child_id 
    AND children.parent_id = auth.uid()
)
```

### What This Means:

1. ✅ `sender_type` must be **exactly** `'parent'` (lowercase string)
2. ✅ `sender_id` must **exactly equal** `auth.uid()` (the authenticated user's UUID)
3. ✅ `child_id` must exist in `children` table AND `children.parent_id` must equal `auth.uid()`

### Common Failures:

| Issue | What You're Sending | What RLS Expects | Fix |
|-------|---------------------|------------------|-----|
| Wrong sender_type | `"Parent"`, `"PARENT"`, `null` | `"parent"` | Use lowercase `"parent"` |
| Wrong sender_id | `parentTable.id`, `undefined` | `auth.user.id` | Use `auth.user.id` from `getUser()` |
| Child not yours | `child_id` of someone else's child | `child_id` where `parent_id = auth.uid()` | Verify child belongs to you |

---

## ✅ Child INSERT Policy Requirements

**Policy:** `"Children can send messages"`  
**Role:** `anon`  
**WITH CHECK expression:**
```sql
sender_type = 'child'::text 
AND 
sender_id = child_id 
AND 
EXISTS (
    SELECT 1 FROM children
    WHERE children.id = messages.child_id 
    AND children.id = messages.sender_id
)
```

### What This Means:

1. ✅ `sender_type` must be **exactly** `'child'` (lowercase string)
2. ✅ `sender_id` must **exactly equal** `child_id` (same value)
3. ✅ Child must exist in `children` table AND `children.id` must equal both `child_id` and `sender_id`

### Common Failures:

| Issue | What You're Sending | What RLS Expects | Fix |
|-------|---------------------|------------------|-----|
| Wrong sender_type | `"Child"`, `"CHILD"`, `null` | `"child"` | Use lowercase `"child"` |
| sender_id ≠ child_id | `sender_id: "abc"`, `child_id: "xyz"` | `sender_id === child_id` | Use same value for both |
| Child doesn't exist | `child_id` that's not in DB | Valid `child_id` from `children` table | Verify child exists |

---

## 🔍 Debugging Your Payload

### Step 1: Check Console Log

After sending a message, look for:
```
📤 [MESSAGE INSERT] Payload: {
  child_id: "...",
  sender_id: "...",
  sender_type: "parent" or "child",
  auth_uid: "...",
  sender_id_matches_auth_uid: true/false
}
```

### Step 2: For Parent Messages

Verify these **exact** conditions:

```javascript
// ✅ CORRECT payload
{
  sender_type: "parent",           // lowercase, exact string
  sender_id: auth.user.id,          // from getUser().data.user.id
  child_id: child.id,               // valid child UUID
  content: "message text"
}

// Verify:
// 1. sender_type === "parent" ✅
// 2. sender_id === auth_uid ✅ (check console log)
// 3. child exists AND child.parent_id === auth_uid ✅
```

### Step 3: For Child Messages

Verify these **exact** conditions:

```javascript
// ✅ CORRECT payload
{
  sender_type: "child",             // lowercase, exact string
  sender_id: child.id,              // MUST equal child_id
  child_id: child.id,               // MUST equal sender_id
  content: "message text"
}

// Verify:
// 1. sender_type === "child" ✅
// 2. sender_id === child_id ✅ (must be same value!)
// 3. child exists in database ✅
```

---

## 🚨 Most Common Issue: Parent sender_id Mismatch

**The #1 cause of 403 errors for parents:**

Your frontend might be doing:
```javascript
// ❌ WRONG - Using parent table ID
const senderId = parentData.id;  // This is from parents table
```

But RLS requires:
```javascript
// ✅ CORRECT - Using auth.users ID
const { data: { user } } = await supabase.auth.getUser();
const senderId = user.id;  // This is auth.uid()
```

**Why this fails:**
- `parents.id` should equal `auth.users.id` (they're linked)
- But if there's any mismatch, RLS blocks it
- Always use `auth.user.id` directly, never `parentTable.id`

---

## 🧪 Quick Test

Run this in your browser console **before** sending a message:

```javascript
// For parents:
const { data: { user } } = await supabase.auth.getUser();
console.log("Auth user ID:", user?.id);
console.log("Will use as sender_id:", user?.id);

// For children:
const childSession = JSON.parse(localStorage.getItem("childSession"));
console.log("Child ID:", childSession?.id);
console.log("Will use as sender_id:", childSession?.id);
console.log("Will use as child_id:", childSession?.id);
console.log("sender_id === child_id?", childSession?.id === childSession?.id);
```

Then compare these values to what appears in the `📤 [MESSAGE INSERT] Payload:` log.

---

## 📋 Checklist When You Get 403

- [ ] Check console log for `📤 [MESSAGE INSERT] Payload:`
- [ ] Verify `sender_type` is exactly `"parent"` or `"child"` (lowercase)
- [ ] For parents: Verify `sender_id === auth_uid` in console log
- [ ] For children: Verify `sender_id === child_id` in console log
- [ ] Verify `child_id` is not `undefined` or `null`
- [ ] Check `❌ [MESSAGE INSERT] Error:` log for details
- [ ] Run `test_message_payload.sql` with your actual values

---

## 💡 Quick Fix Template

If you're still getting 403, paste your console log output here and I'll tell you exactly which check is failing!

The console log should show something like:
```
📤 [MESSAGE INSERT] Payload: {
  child_id: "123e4567-e89b-12d3-a456-426614174000",
  sender_id: "987fcdeb-51a2-43d7-8f9e-123456789abc",
  sender_type: "parent",
  auth_uid: "987fcdeb-51a2-43d7-8f9e-123456789abc",
  sender_id_matches_auth_uid: true
}
```

If `sender_id_matches_auth_uid: false`, that's your problem!

