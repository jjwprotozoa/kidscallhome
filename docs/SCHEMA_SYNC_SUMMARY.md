# Database Schema Sync Summary

## Overview
This document summarizes the database schema synchronization performed to ensure all tables and columns match the application requirements.

## Migration File
`supabase/migrations/20251210000000_sync_schema_with_app.sql`

## Tables Created

### 1. `adult_profiles`
- Unified table for parents and family members
- Columns: `id`, `user_id`, `family_id`, `role`, `relationship_type`, `name`, `email`, `avatar_url`, `created_at`, `updated_at`
- Indexes: user_id, family_id, role, user_family composite

### 2. `child_profiles`
- Profile table for children
- Columns: `id`, `family_id`, `name`, `login_code`, `avatar_url`, `avatar_color`, `age`, `created_at`, `updated_at`
- Indexes: family_id, login_code

### 3. `conversations`
- Supports 1:1 and group conversations
- Columns: `id`, `type`, `adult_id`, `child_id`, `adult_role`, `created_at`, `updated_at`
- Unique constraint on (adult_id, child_id)
- Indexes: type, adult_id, child_id, adult_role, composite indexes

### 4. `conversation_participants`
- Links users/children to conversations
- Columns: `id`, `conversation_id`, `user_id`, `role`, `created_at`
- Unique constraint on (conversation_id, user_id)
- Indexes: conversation_id, user_id, role

### 5. `child_family_memberships`
- Junction table for children belonging to multiple families (two-household setup)
- Columns: `id`, `child_profile_id`, `family_id`, `created_at`
- Unique constraint on (child_profile_id, family_id)
- Indexes: child_profile_id, family_id

### 6. `child_connections`
- Tracks child-to-child connection requests and approvals
- Columns: `id`, `requester_child_id`, `requester_family_id`, `target_child_id`, `target_family_id`, `status`, `approved_by_parent_id`, `approved_at`, `requested_at`, `requested_by_child`, `created_at`, `updated_at`
- Status: 'pending', 'approved', 'rejected', 'blocked'
- Indexes: requester_child_id, target_child_id, status, families composite

### 7. `blocked_contacts`
- Tracks child blocking of adults or other children
- Columns: `id`, `blocker_child_id`, `blocked_adult_profile_id`, `blocked_child_profile_id`, `blocked_at`, `parent_notified_at`, `unblocked_at`, `unblocked_by_parent_id`, `created_at`
- Constraint: Either adult or child must be blocked, not both
- Indexes: blocker_child_id, blocked_adult_profile_id, blocked_child_profile_id, active blocks

### 8. `reports`
- Tracks reports of inappropriate content/behavior
- Columns: `id`, `reporter_child_id`, `reported_adult_profile_id`, `reported_child_profile_id`, `report_type`, `report_message`, `related_message_id`, `related_call_id`, `status`, `reviewed_by_parent_id`, `reviewed_at`, `resolution_notes`, `created_at`
- Report types: 'inappropriate_content', 'harassment', 'bullying', 'threat', 'other'
- Status: 'pending', 'reviewed', 'resolved', 'dismissed'
- Indexes: reporter_child_id, reported_adult_profile_id, reported_child_profile_id, status, pending reports

### 9. `family_feature_flags`
- Feature flags per family (e.g., child_to_child_messaging, child_to_child_calls)
- Columns: `id`, `family_id`, `key`, `enabled`, `created_at`, `updated_at`
- Unique constraint on (family_id, key)
- Indexes: family_id, key, enabled (where enabled = true)

## Columns Added to Existing Tables

### `messages` table
- `conversation_id` (UUID, references conversations.id) - Links messages to conversations
- `receiver_type` (TEXT) - Optional explicit receiver type

### `calls` table
- `conversation_id` (UUID, references conversations.id) - Links calls to conversations
- `callee_id` (UUID, references child_profiles.id) - For child-to-child calls

### `families` table
- `household_type` (TEXT) - 'single' or 'two_household'
- `linked_family_id` (UUID) - For cooperative co-parents
- `linked_at` (TIMESTAMPTZ) - When families were linked
- `safety_mode_enabled` (BOOLEAN) - Safety mode flag
- `safety_mode_settings` (JSONB) - Safety mode configuration

## Indexes Created
All tables have appropriate indexes for efficient queries:
- Foreign key indexes
- Lookup indexes (by user_id, family_id, status, etc.)
- Composite indexes for common query patterns
- Partial indexes for filtered queries (e.g., active blocks, enabled features)

## Triggers Created
- `update_profile_updated_at()` function for automatic timestamp updates
- Triggers on: adult_profiles, child_profiles, conversations, child_connections, family_feature_flags

## Realtime Support
All new tables are added to the `supabase_realtime` publication for real-time updates.

## Row Level Security (RLS)
All new tables have RLS enabled. Note that RLS policies should be created by other migrations that handle the specific security requirements.

## Next Steps

1. **Run the migration** in your Supabase dashboard:
   ```sql
   -- Copy and paste the contents of:
   -- supabase/migrations/20251210000000_sync_schema_with_app.sql
   ```

2. **Verify the schema** matches your application code:
   - Check that all tables exist
   - Verify all columns are present
   - Confirm indexes are created

3. **Update TypeScript types** (if needed):
   - Run `supabase gen types typescript` to regenerate types
   - Or manually update `src/integrations/supabase/types.ts`

4. **Test the application**:
   - Ensure all queries work correctly
   - Verify RLS policies are functioning
   - Test real-time subscriptions

## Notes

- This migration is **idempotent** - it can be run multiple times safely
- It uses `CREATE TABLE IF NOT EXISTS` and `DO $$ BEGIN ... END $$` blocks to check for existing columns
- The migration does NOT create RLS policies - those should be handled by other migrations
- The migration does NOT migrate existing data - that should be handled by data migration scripts







