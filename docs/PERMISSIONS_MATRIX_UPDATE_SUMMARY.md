# Permissions Matrix Update Summary

## Changes Made

### 1. Refined Permissions Matrix
Updated the permissions matrix to clarify edge cases:
- **Parent → Child (other parent, same linked child)**: No direct communication, only metadata access
- **Child → Parent**: Child cannot fully block their own parent (safety feature)
- **Blocking**: If either side has blocked the other, no communication allowed (except parent exception)

### 2. Database-Level Enforcement

#### New Migration: `20251209000000_enforce_refined_permissions_matrix.sql`

**Key Functions:**
- `can_users_communicate()`: Central permission check function that enforces all rules at database level
  - Prevents adult-to-adult communication
  - Checks blocking (with parent exception)
  - Verifies child-to-child approvals
  - Enforces family boundaries

- Updated `is_contact_blocked()`: 
  - Returns `false` if checking child's own parent (safety feature)
  - Prevents child from blocking their own parent at database level

**RLS Policies Updated:**
- **Messages INSERT**: All policies now use `can_users_communicate()` before allowing inserts
- **Calls INSERT**: All policies now use `can_users_communicate()` before allowing inserts
- **Blocked Contacts INSERT**: Prevents blocking child's own parent

### 3. Application-Level Updates

**File: `src/utils/family-communication.ts`**
- Simplified blocking check logic (database function handles parent exception)
- Maintains application-level permission checks for consistency

## Key Safety Features

### 1. Child Cannot Block Own Parent
- **Database Level**: `is_contact_blocked()` returns `false` for child's own parent
- **RLS Level**: INSERT policy prevents creating block for child's own parent
- **Application Level**: Permission check respects database exception
- **Rationale**: Parents need oversight access even if child wants privacy
- **Client-Side**: Can implement "mute" for UX without affecting parent oversight

### 2. No Adult-to-Adult Communication
- **Database Level**: `can_users_communicate()` returns `false` for any adult-to-adult
- **RLS Level**: INSERT policies check function before allowing inserts
- **Application Level**: Permission check enforces same rule
- **Rationale**: App is for parent-child communication, not adult social networking

### 3. Blocking Overrides Everything
- **Database Level**: `can_users_communicate()` checks blocking first
- **RLS Level**: INSERT policies fail if blocking exists
- **Application Level**: Permission check respects blocking
- **Exception**: Child cannot block their own parent

## Testing Requirements

Before deploying, verify:

1. ✅ No adult-to-adult messages/calls can be inserted
2. ✅ Child cannot block their own parent
3. ✅ Blocking prevents communication (except parent exception)
4. ✅ Child-to-child requires approved connection
5. ✅ Family members restricted to same family
6. ✅ Linked families can see metadata but not communicate
7. ✅ Parents can see metadata for their children

## Migration Steps

1. **Run Migration**: Execute `20251209000000_enforce_refined_permissions_matrix.sql`
2. **Verify Functions**: Test `can_users_communicate()` with various scenarios
3. **Test RLS**: Attempt to insert disallowed messages/calls and verify they fail
4. **Test Blocking**: Verify child cannot block own parent
5. **Test Oversight**: Verify parents can still see metadata even if child "mutes"

## Rollback Plan

If issues arise:
1. Drop the new RLS policies (they have specific names)
2. Drop the `can_users_communicate()` function
3. Restore previous `is_contact_blocked()` function
4. Restore previous RLS policies from backup

## Documentation

- **Refined Permissions Matrix**: `docs/REFINED_PERMISSIONS_MATRIX.md`
- **This Summary**: `docs/PERMISSIONS_MATRIX_UPDATE_SUMMARY.md`
- **Migration File**: `supabase/migrations/20251209000000_enforce_refined_permissions_matrix.sql`

