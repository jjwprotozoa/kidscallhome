# Troubleshooting: Parent Cannot See Children

## Current Status

✅ **Code Fix Applied**: `ParentChildrenList.tsx` now explicitly filters by `parent_id`  
✅ **RLS Policies Verified**: Policies exist and look correct  
⚠️ **SQL Editor Limitation**: `auth.uid()` returns NULL in SQL Editor (expected - no auth session)

## Next Steps: Test from Application

The SQL Editor runs without authentication, so we need to test from the actual application.

### Step 1: Check Browser Console

1. Open the app in browser
2. Log in as parent (`justwessels@gmail.com`)
3. Navigate to `/parent/children`
4. Open Browser DevTools Console (F12)
5. Look for debug logs:
   - `🔍 [PARENT CHILDREN] Fetching children for parent:` - Should show user ID
   - `✅ [PARENT CHILDREN] Children fetched:` - Should show count and children
   - `❌ [PARENT CHILDREN] Query error:` - If there's an error

### Step 2: Check Network Tab

1. Open Browser DevTools → Network tab
2. Filter by "children" or "rest"
3. Find the request to `/rest/v1/children`
4. Check:
   - **Request Headers**: Should have `Authorization: Bearer <token>`
   - **Response Status**: Should be `200 OK` (not `401` or `403`)
   - **Response Body**: Should contain 4 children or empty array `[]`

### Step 3: Verify JWT Token

Run this in Browser Console while logged in:

```javascript
// Get current session
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('User ID:', session?.user?.id);
console.log('Expected:', '70888a10-ad5e-4764-8dff-537ad2da34d1');

// Decode JWT (basic - just the payload)
if (session?.access_token) {
  const payload = JSON.parse(atob(session.access_token.split('.')[1]));
  console.log('JWT Payload:', payload);
  console.log('JWT sub (user ID):', payload.sub);
}
```

### Step 4: Test Query Directly

Run this in Browser Console:

```javascript
// Test children query
const { data, error } = await supabase
  .from('children')
  .select('*')
  .order('created_at', { ascending: false });

console.log('Children (no filter):', data);
console.log('Error (no filter):', error);

// Test with explicit filter
const { data: { user } } = await supabase.auth.getUser();
const { data: data2, error: error2 } = await supabase
  .from('children')
  .select('*')
  .eq('parent_id', user?.id)
  .order('created_at', { ascending: false });

console.log('Children (filtered):', data2);
console.log('Error (filtered):', error2);
```

## Common Issues & Solutions

### Issue 1: `auth.uid()` returns NULL in app

**Symptoms**: 
- Console shows `userId: null` or `user: null`
- Error: "Not authenticated"

**Causes**:
- Session expired
- Token not being sent
- User not logged in

**Solutions**:
1. Check if user is actually logged in
2. Try logging out and back in
3. Clear browser storage and re-login
4. Check if token is in localStorage: `localStorage.getItem('sb-...-auth-token')`

### Issue 2: RLS Error (PGRST116)

**Symptoms**:
- Error code: `PGRST116`
- Message: "The result contains 0 rows"
- Response status: `200` but empty array

**Causes**:
- RLS policy is blocking access
- `parent_id` doesn't match `auth.uid()`
- Policy expression is incorrect

**Solutions**:
1. Verify `user.id === '70888a10-ad5e-4764-8dff-537ad2da34d1'`
2. Check if migration was applied: `supabase migration list`
3. Verify policy exists: Run diagnostic SQL
4. Check if `parent_id` in children table matches user ID

### Issue 3: Empty Array Returned

**Symptoms**:
- No error, but `data = []`
- Console shows `count: 0`

**Causes**:
- No children with matching `parent_id`
- Filter is too restrictive
- Data doesn't exist

**Solutions**:
1. Verify children exist in database:
   ```sql
   SELECT id, name, parent_id 
   FROM children 
   WHERE parent_id = '70888a10-ad5e-4764-8dff-537ad2da34d1';
   ```
2. Check if `parent_id` column has correct values
3. Verify no typos in user ID

### Issue 4: Network Error / CORS

**Symptoms**:
- Network request fails
- CORS error in console
- 401/403 status codes

**Solutions**:
1. Check Supabase URL is correct
2. Verify API key is valid
3. Check CORS settings in Supabase dashboard
4. Ensure request includes Authorization header

## Expected Results

When working correctly, you should see:

1. **Console Logs**:
   ```
   🔍 [PARENT CHILDREN] Fetching children for parent: { userId: '70888a10-...', email: 'justwessels@gmail.com' }
   ✅ [PARENT CHILDREN] Children fetched: { count: 4, children: [...] }
   ```

2. **Network Request**:
   - Status: `200 OK`
   - Headers: `Authorization: Bearer <token>`
   - Response: Array with 4 children

3. **UI**: 
   - Shows 4 child cards (Jolene, Bev, Alex, Stella)
   - No error messages

## If Still Not Working

1. **Check Migration Status**:
   ```bash
   supabase migration list
   ```
   Ensure `20251210000000_fix_parent_view_children_rls.sql` is applied

2. **Verify RLS Policies**:
   Run `docs/sql/DIAGNOSE_CHILDREN_RLS.sql` (but remember `auth.uid()` will be NULL)

3. **Test with Service Role** (temporary, for debugging only):
   ```sql
   -- This bypasses RLS - use only for testing
   SET LOCAL role = 'service_role';
   SELECT * FROM children WHERE parent_id = '70888a10-ad5e-4764-8dff-537ad2da34d1';
   RESET role;
   ```

4. **Check Supabase Dashboard**:
   - Go to Authentication → Users
   - Verify user exists and is active
   - Check if email is confirmed

## Files to Check

- `src/pages/ParentChildrenList.tsx` - Main component (updated with debugging)
- `supabase/migrations/20251210000000_fix_parent_view_children_rls.sql` - RLS fix
- `docs/sql/DIAGNOSE_CHILDREN_RLS.sql` - Diagnostic queries
- `docs/sql/TEST_PARENT_CHILDREN_ACCESS.sql` - Test queries

