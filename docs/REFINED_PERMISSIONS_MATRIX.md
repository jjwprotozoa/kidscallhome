# Refined Permissions Matrix

## Overview

This document defines the complete permissions matrix for the KidsCallHome communication system, including edge cases for shared children, blocking, and parent oversight.

## Communication Permissions Matrix

| From Role | To Role | Can Message | Can Call | Requires Approval | Oversight / Notes |
|-----------|---------|------------|----------|-------------------|-------------------|
| Parent | Child (own) | ✅ Yes | ✅ Yes | ❌ No | Always allowed. Parents can see metadata and safety signals for their own child. |
| Parent | Child (other parent, same linked child) | ❌ No | ❌ No | N/A | No direct communication; parent can only see metadata when families are linked. |
| Parent | Parent (same family or linked family) | ❌ No | ❌ No | N/A | No adult‑to‑adult communication, even if families are linked. |
| Parent | Family Member (same family) | ❌ No | ❌ No | N/A | No adult‑to‑adult communication. |
| Parent | Family Member (other family) | ❌ No | ❌ No | N/A | Not allowed. |
| Family Member | Child (same family) | ✅ Yes | ✅ Yes | ❌ No | Allowed only within same family. Parent(s) of the child have metadata oversight. |
| Family Member | Child (other family) | ❌ No | ❌ No | N/A | Not allowed, even if families are linked. |
| Family Member | Parent | ❌ No | ❌ No | N/A | No adult‑to‑adult. |
| Family Member | Family Member | ❌ No | ❌ No | N/A | No adult‑to‑adult. |
| Child | Parent (own) | ✅ Yes | ✅ Yes | ❌ No | Always allowed; child cannot fully block their own parent at the app level (you can still allow "mute" on the client). |
| Child | Family Member (same family) | ✅ Yes | ✅ Yes | ❌ No | Auto‑allowed if both are in same family and neither is blocked. |
| Child | Family Member (other family) | ❌ No | ❌ No | N/A | Not allowed. |
| Child | Child (approved) | ✅ Yes | ✅ Yes | ✅ Yes | Requires "connection" approved by both parents; each parent sees metadata for their own child. |
| Child | Child (unapproved) | ❌ No | ❌ No | ✅ Yes | Only connection request allowed until both parents approve. |
| Child | Blocked Contact | ❌ No | ❌ No | N/A | Blocking overrides everything; only parent can unblock. |
| Any | Any | ❌ No | ❌ No | N/A | If either side has blocked the other, no communication allowed regardless of family/role. |

## Key Rules

### 1. No Adult-to-Adult Communication
- **Enforced at**: Database level (RLS policies) and application level
- **Rationale**: App is designed for parent-child communication, not adult social networking
- **Exception**: None

### 2. Child Cannot Block Own Parent
- **Enforced at**: Database level (function check) and application level
- **Rationale**: Safety feature - parents need oversight access even if child wants to mute
- **Implementation**: 
  - Database function `is_contact_blocked()` returns `false` if checking child's own parent
  - Application-level check verifies parent relationship before applying block
  - Client-side "mute" can be implemented for UX without affecting parent oversight

### 3. Blocking Overrides Everything
- **Enforced at**: Database level (RLS INSERT policies) and application level
- **Rationale**: If a child blocks someone, that takes precedence over all other permissions
- **Exception**: Child cannot block their own parent (see rule #2)

### 4. Child-to-Child Requires Approval
- **Enforced at**: Database level (connection check) and application level
- **Rationale**: Both parents must approve child-to-child communication for safety
- **Process**: 
  1. Connection request created (status: `pending`)
  2. Both parents must approve
  3. Once approved (status: `approved`), communication is allowed

### 5. Family Members Restricted to Same Family
- **Enforced at**: Database level (family_id check) and application level
- **Rationale**: Family members should only communicate with children in their own family
- **Exception**: None, even if families are linked

### 6. Linked Families - Metadata Only
- **Enforced at**: Application level (RLS SELECT policies)
- **Rationale**: Co-parents can see metadata (call logs, approved contacts) but cannot communicate directly
- **Implementation**: 
  - Parents in linked families can `SELECT` metadata for shared children
  - No `INSERT` allowed for cross-family communication
  - Metadata includes: timestamps, participants, call duration, connection status

## RLS Policy Enforcement

### Messages Table

**INSERT Policies:**
- ✅ Parent → Child: Checks parent owns child AND `can_users_communicate()` returns true
- ✅ Family Member → Child: Checks same family AND `can_users_communicate()` returns true
- ✅ Child → Parent/Child/Family Member: Checks `can_users_communicate()` returns true

**SELECT Policies:**
- ✅ Parents can see messages for their own children
- ✅ Parents in linked families can see metadata for shared children
- ✅ Children can see messages they sent/received
- ✅ Family members can see messages with children in their family

### Calls Table

**INSERT Policies:**
- ✅ Parent → Child: Checks parent owns child AND `can_users_communicate()` returns true
- ✅ Family Member → Child: Checks same family AND `can_users_communicate()` returns true
- ✅ Child → Parent/Child: Checks `can_users_communicate()` returns true

**SELECT Policies:**
- ✅ Parents can see calls for their own children
- ✅ Parents in linked families can see metadata for shared children
- ✅ Children can see calls they participated in
- ✅ Family members can see calls with children in their family

### Blocked Contacts Table

**INSERT Policies:**
- ✅ Parents can block contacts for their children
- ✅ Prevents blocking child's own parent (safety feature)

**UPDATE Policies:**
- ✅ Parents can unblock contacts for their children

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
- ✅ Status must be `approved`

## Safety Features

### 1. Parent Oversight
- Parents can always see metadata for their own children
- Parents in linked families can see metadata for shared children
- Parents receive notifications when children block or report contacts

### 2. Child Cannot Block Parent
- Database-level enforcement prevents child from blocking their own parent
- Allows client-side "mute" for UX while maintaining parent oversight
- Critical for safety - parents need access even if child wants privacy

### 3. Reporting System
- Children can report inappropriate content/behavior
- Reports are immediately visible to parents
- Parents can review, resolve, or dismiss reports

### 4. Blocking System
- Children can block contacts (except own parent)
- Parents are notified when child blocks someone
- Only parents can unblock contacts

## Testing Checklist

- [ ] Verify no adult-to-adult messages can be inserted
- [ ] Verify child cannot block their own parent
- [ ] Verify blocking prevents communication
- [ ] Verify child-to-child requires approval
- [ ] Verify family members restricted to same family
- [ ] Verify linked families can see metadata but not communicate
- [ ] Verify parents can see metadata for their children
- [ ] Verify unblocking works correctly

## Migration Notes

The migration `20251209000000_enforce_refined_permissions_matrix.sql` implements:
1. `can_users_communicate()` function for centralized permission checks
2. Updated `is_contact_blocked()` with parent exception
3. RLS policies on `messages` and `calls` tables that use these functions
4. Updated `blocked_contacts` INSERT policy to prevent blocking own parent

All rules are now enforced at the database level, making it impossible to violate the permissions matrix even if application code has bugs.

