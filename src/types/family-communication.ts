// src/types/family-communication.ts
// TypeScript types for the Family Communication System
// Complete configuration specification types

/**
 * Household Types
 * - single: One family with two parent accounts (married/together parents)
 * - two_household: Two completely separate families (separated/divorced parents)
 */
export type HouseholdType = 'single' | 'two_household';

/**
 * Child Connection Status
 * - pending: Connection request pending approval from both parents
 * - approved: Both parents approved, children can communicate
 * - rejected: One or both parents rejected the connection
 * - blocked: Connection was blocked
 */
export type ChildConnectionStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

/**
 * Report Types
 */
export type ReportType = 'inappropriate_content' | 'harassment' | 'bullying' | 'threat' | 'other';

/**
 * Report Status
 */
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

/**
 * Relationship Types for Family Members
 */
export type RelationshipType = 'grandparent' | 'aunt' | 'uncle' | 'cousin' | 'other';

/**
 * Family Structure
 */
export interface Family {
  id: string;
  name: string | null;
  invite_code: string;
  household_type: HouseholdType;
  linked_family_id: string | null;
  linked_at: string | null;
  safety_mode_enabled: boolean;
  safety_mode_settings: SafetyModeSettings;
  created_at: string | null;
}

/**
 * Safety Mode Settings
 */
export interface SafetyModeSettings {
  keyword_alerts: boolean;
  export_conversations: boolean;
  alert_threshold: 'low' | 'medium' | 'high';
}

/**
 * Child Family Membership
 * Links a child to a family (supports two-household setups where child belongs to multiple families)
 */
export interface ChildFamilyMembership {
  id: string;
  child_profile_id: string;
  family_id: string;
  created_at: string;
}

/**
 * Child-to-Child Connection Request
 */
export interface ChildConnection {
  id: string;
  requester_child_id: string;
  requester_family_id: string;
  target_child_id: string;
  target_family_id: string;
  status: ChildConnectionStatus;
  approved_by_parent_id: string | null;
  approved_at: string | null;
  requested_at: string;
  requested_by_child: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Blocked Contact
 * Tracks when a child blocks an adult or another child
 */
export interface BlockedContact {
  id: string;
  blocker_child_id: string;
  blocked_adult_profile_id: string | null;
  blocked_child_profile_id: string | null;
  blocked_at: string;
  parent_notified_at: string | null;
  unblocked_at: string | null;
  unblocked_by_parent_id: string | null;
  created_at: string;
}

/**
 * Report
 * Tracks reports from children about inappropriate content or behavior
 */
export interface Report {
  id: string;
  reporter_child_id: string;
  reported_adult_profile_id: string | null;
  reported_child_profile_id: string | null;
  report_type: ReportType;
  report_message: string | null;
  related_message_id: string | null;
  related_call_id: string | null;
  status: ReportStatus;
  reviewed_by_parent_id: string | null;
  reviewed_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

/**
 * Extended Family with household information
 */
export interface FamilyWithHousehold extends Family {
  linked_family?: Family | null;
  is_linked: boolean;
}

/**
 * Child Profile with Family Memberships
 */
export interface ChildProfileWithFamilies {
  id: string;
  family_id: string; // Primary family (for backward compatibility)
  name: string;
  login_code: string;
  avatar_url: string | null;
  avatar_color: string;
  age: number | null;
  created_at: string;
  updated_at: string;
  // Extended fields
  families: Family[]; // All families this child belongs to
  primary_family: Family;
}

/**
 * Adult Profile with Role Information
 */
export interface AdultProfile {
  id: string;
  user_id: string;
  family_id: string;
  role: 'parent' | 'family_member';
  relationship_type: RelationshipType | null;
  name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Communication Permission Check Result
 */
export interface CommunicationPermission {
  can_communicate: boolean;
  reason?: string;
  is_blocked?: boolean;
  requires_approval?: boolean;
}

/**
 * Onboarding Family Setup Selection
 */
export interface FamilySetupSelection {
  household_type: HouseholdType;
  parent_email?: string; // For two-household, second parent email
}

/**
 * Child Connection Request Input
 */
export interface ChildConnectionRequestInput {
  requester_child_id: string;
  target_child_id: string;
  requested_by_child?: boolean;
}

/**
 * Block Contact Input
 */
export interface BlockContactInput {
  blocker_child_id: string;
  blocked_adult_profile_id?: string;
  blocked_child_profile_id?: string;
}

/**
 * Report Input
 */
export interface ReportInput {
  reporter_child_id: string;
  reported_adult_profile_id?: string;
  reported_child_profile_id?: string;
  report_type: ReportType;
  report_message?: string;
  related_message_id?: string;
  related_call_id?: string;
}

/**
 * Parent Notification for Block/Report
 */
export interface ParentNotification {
  id: string;
  type: 'block' | 'report';
  child_id: string;
  child_name: string;
  blocked_or_reported_name: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

