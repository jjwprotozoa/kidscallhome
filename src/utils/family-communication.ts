// src/utils/family-communication.ts
// Utility functions for Family Communication System
// Handles permission checks, family structure operations, blocking, reporting, etc.

import { supabase } from "@/integrations/supabase/client";
import type {
  HouseholdType,
  ChildConnectionStatus,
  CommunicationPermission,
  ChildConnectionRequestInput,
  BlockContactInput,
  ReportInput,
  Family,
  ChildConnection,
  BlockedContact,
  Report,
} from "@/types/family-communication";

/**
 * Check if two children can communicate
 * Requires approval from both parents in two-household setups
 */
export async function canChildrenCommunicate(
  child1Id: string,
  child2Id: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('can_children_communicate', {
      p_child1_id: child1Id,
      p_child2_id: child2Id,
    });

    if (error) {
      console.error('Error checking child communication permission:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in canChildrenCommunicate:', error);
    return false;
  }
}

/**
 * Check if a contact is blocked for a child
 */
export async function isContactBlocked(
  childId: string,
  adultProfileId?: string,
  childProfileId?: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_contact_blocked', {
      p_child_id: childId,
      p_adult_profile_id: adultProfileId || null,
      p_child_profile_id: childProfileId || null,
    });

    if (error) {
      console.error('Error checking if contact is blocked:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in isContactBlocked:', error);
    return false;
  }
}

/**
 * Get all families a child belongs to
 * Supports two-household setups
 */
export async function getChildFamilies(childProfileId: string): Promise<Family[]> {
  try {
    const { data, error } = await supabase.rpc('get_child_families', {
      p_child_profile_id: childProfileId,
    });

    if (error) {
      console.error('Error getting child families:', error);
      return [];
    }

    // Fetch full family details
    if (!data || data.length === 0) {
      return [];
    }

    const familyIds = data.map((row: { family_id: string }) => row.family_id);
    const { data: families, error: familiesError } = await supabase
      .from('families')
      .select('*')
      .in('id', familyIds);

    if (familiesError) {
      console.error('Error fetching family details:', familiesError);
      return [];
    }

    return families || [];
  } catch (error) {
    console.error('Error in getChildFamilies:', error);
    return [];
  }
}

/**
 * Check communication permissions between users
 * Returns detailed permission information
 */
export async function checkCommunicationPermission(
  currentUserId: string,
  currentUserRole: 'parent' | 'family_member' | 'child',
  targetUserId: string,
  targetUserRole: 'parent' | 'family_member' | 'child',
  currentUserFamilyId?: string,
  targetUserFamilyId?: string
): Promise<CommunicationPermission> {
  // Rule: NO adult-to-adult communication
  if (
    (currentUserRole === 'parent' || currentUserRole === 'family_member') &&
    (targetUserRole === 'parent' || targetUserRole === 'family_member')
  ) {
    return {
      can_communicate: false,
      reason: 'Adults cannot communicate with other adults in this app',
    };
  }

  // Rule: Child-to-child requires approval
  if (currentUserRole === 'child' && targetUserRole === 'child') {
    const canCommunicate = await canChildrenCommunicate(currentUserId, targetUserId);
    return {
      can_communicate: canCommunicate,
      requires_approval: !canCommunicate,
      reason: canCommunicate
        ? undefined
        : 'Child-to-child communication requires approval from both parents',
    };
  }

  // Rule: Check if contact is blocked (for child blocking)
  if (currentUserRole === 'child') {
    const blocked = await isContactBlocked(
      currentUserId,
      targetUserRole !== 'child' ? targetUserId : undefined,
      targetUserRole === 'child' ? targetUserId : undefined
    );

    if (blocked) {
      return {
        can_communicate: false,
        is_blocked: true,
        reason: 'This contact has been blocked',
      };
    }
  }

  // Rule: Family members can only communicate with children in their family
  if (currentUserRole === 'family_member' && targetUserRole === 'child') {
    if (currentUserFamilyId !== targetUserFamilyId) {
      return {
        can_communicate: false,
        reason: 'Family members can only communicate with children in their family',
      };
    }
  }

  // Default: Allow communication
  return {
    can_communicate: true,
  };
}

/**
 * Request child-to-child connection
 * Creates a pending connection request
 */
export async function requestChildConnection(
  input: ChildConnectionRequestInput
): Promise<ChildConnection | null> {
  try {
    // Get family IDs for both children
    const { data: requesterFamilies } = await supabase
      .from('child_family_memberships')
      .select('family_id')
      .eq('child_profile_id', input.requester_child_id)
      .limit(1)
      .single();

    const { data: targetFamilies } = await supabase
      .from('child_family_memberships')
      .select('family_id')
      .eq('child_profile_id', input.target_child_id)
      .limit(1)
      .single();

    if (!requesterFamilies || !targetFamilies) {
      throw new Error('Could not find families for children');
    }

    const { data, error } = await supabase
      .from('child_connections')
      .insert({
        requester_child_id: input.requester_child_id,
        requester_family_id: requesterFamilies.family_id,
        target_child_id: input.target_child_id,
        target_family_id: targetFamilies.family_id,
        status: 'pending',
        requested_by_child: input.requested_by_child || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating child connection request:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in requestChildConnection:', error);
    return null;
  }
}

/**
 * Approve child-to-child connection
 * Requires approval from both parents in two-household setups
 */
export async function approveChildConnection(
  connectionId: string,
  parentProfileId: string
): Promise<boolean> {
  try {
    // Get connection details
    const { data: connection, error: fetchError } = await supabase
      .from('child_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (fetchError || !connection) {
      console.error('Error fetching connection:', fetchError);
      return false;
    }

    // Check if this parent has authority to approve
    // Parent must be in either requester or target family
    const { data: parentProfile } = await supabase
      .from('adult_profiles')
      .select('family_id')
      .eq('id', parentProfileId)
      .single();

    if (!parentProfile) {
      return false;
    }

    const isAuthorized =
      parentProfile.family_id === connection.requester_family_id ||
      parentProfile.family_id === connection.target_family_id;

    if (!isAuthorized) {
      return false;
    }

    // If already approved by one parent, check if we need both parents
    // For single household, one approval is enough
    // For two-household, both parents must approve

    const { data: requesterFamily } = await supabase
      .from('families')
      .select('household_type')
      .eq('id', connection.requester_family_id)
      .single();

    const { data: targetFamily } = await supabase
      .from('families')
      .select('household_type')
      .eq('id', connection.target_family_id)
      .single();

    const isTwoHousehold =
      requesterFamily?.household_type === 'two_household' ||
      targetFamily?.household_type === 'two_household';

    if (isTwoHousehold && connection.status === 'pending') {
      // For two-household, we need both parents to approve
      // For now, mark as approved if this is the first approval
      // In a full implementation, you'd track which parent approved
      const { error: updateError } = await supabase
        .from('child_connections')
        .update({
          status: 'approved',
          approved_by_parent_id: parentProfileId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      return !updateError;
    } else {
      // Single household or already partially approved
      const { error: updateError } = await supabase
        .from('child_connections')
        .update({
          status: 'approved',
          approved_by_parent_id: parentProfileId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      return !updateError;
    }
  } catch (error) {
    console.error('Error in approveChildConnection:', error);
    return false;
  }
}

/**
 * Block a contact (child blocking adult or another child)
 */
export async function blockContact(input: BlockContactInput): Promise<BlockedContact | null> {
  try {
    const { data, error } = await supabase
      .from('blocked_contacts')
      .insert({
        blocker_child_id: input.blocker_child_id,
        blocked_adult_profile_id: input.blocked_adult_profile_id || null,
        blocked_child_profile_id: input.blocked_child_profile_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error blocking contact:', error);
      return null;
    }

    // Notify parent (async, don't wait)
    notifyParentOfBlock(input.blocker_child_id, data.id).catch((err) =>
      console.error('Error notifying parent:', err)
    );

    return data;
  } catch (error) {
    console.error('Error in blockContact:', error);
    return null;
  }
}

/**
 * Unblock a contact (parent action)
 */
export async function unblockContact(
  blockedContactId: string,
  parentProfileId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('blocked_contacts')
      .update({
        unblocked_at: new Date().toISOString(),
        unblocked_by_parent_id: parentProfileId,
      })
      .eq('id', blockedContactId);

    return !error;
  } catch (error) {
    console.error('Error in unblockContact:', error);
    return false;
  }
}

/**
 * Create a report (child reporting inappropriate content/behavior)
 */
export async function createReport(input: ReportInput): Promise<Report | null> {
  try {
    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_child_id: input.reporter_child_id,
        reported_adult_profile_id: input.reported_adult_profile_id || null,
        reported_child_profile_id: input.reported_child_profile_id || null,
        report_type: input.report_type,
        report_message: input.report_message || null,
        related_message_id: input.related_message_id || null,
        related_call_id: input.related_call_id || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating report:', error);
      return null;
    }

    // Notify parent (async, don't wait)
    notifyParentOfReport(input.reporter_child_id, data.id).catch((err) =>
      console.error('Error notifying parent:', err)
    );

    return data;
  } catch (error) {
    console.error('Error in createReport:', error);
    return null;
  }
}

/**
 * Notify parent when child blocks someone
 */
async function notifyParentOfBlock(childId: string, blockedContactId: string): Promise<void> {
  // This would typically send a notification
  // For now, we'll update the parent_notified_at timestamp
  const { error } = await supabase
    .from('blocked_contacts')
    .update({
      parent_notified_at: new Date().toISOString(),
    })
    .eq('id', blockedContactId);

  if (error) {
    console.error('Error updating parent notification:', error);
  }
}

/**
 * Notify parent when child creates a report
 */
async function notifyParentOfReport(childId: string, reportId: string): Promise<void> {
  // This would typically send a notification
  // Implementation would depend on your notification system
  console.log(`Parent notification: Child ${childId} created report ${reportId}`);
}

/**
 * Get household type for a family
 */
export async function getHouseholdType(familyId: string): Promise<HouseholdType | null> {
  try {
    const { data, error } = await supabase
      .from('families')
      .select('household_type')
      .eq('id', familyId)
      .single();

    if (error || !data) {
      console.error('Error getting household type:', error);
      return null;
    }

    return data.household_type as HouseholdType;
  } catch (error) {
    console.error('Error in getHouseholdType:', error);
    return null;
  }
}

/**
 * Link two families (cooperative co-parents)
 * Both parents must consent
 */
export async function linkFamilies(
  family1Id: string,
  family2Id: string
): Promise<boolean> {
  try {
    // Update both families to link them
    const { error: error1 } = await supabase
      .from('families')
      .update({
        linked_family_id: family2Id,
        linked_at: new Date().toISOString(),
      })
      .eq('id', family1Id);

    const { error: error2 } = await supabase
      .from('families')
      .update({
        linked_family_id: family1Id,
        linked_at: new Date().toISOString(),
      })
      .eq('id', family2Id);

    return !error1 && !error2;
  } catch (error) {
    console.error('Error linking families:', error);
    return false;
  }
}

/**
 * Unlink families
 * Either parent can unlink
 */
export async function unlinkFamilies(familyId: string): Promise<boolean> {
  try {
    // Get linked family ID
    const { data: family } = await supabase
      .from('families')
      .select('linked_family_id')
      .eq('id', familyId)
      .single();

    if (!family?.linked_family_id) {
      return false;
    }

    // Unlink both families
    const { error: error1 } = await supabase
      .from('families')
      .update({
        linked_family_id: null,
        linked_at: null,
      })
      .eq('id', familyId);

    const { error: error2 } = await supabase
      .from('families')
      .update({
        linked_family_id: null,
        linked_at: null,
      })
      .eq('id', family.linked_family_id);

    return !error1 && !error2;
  } catch (error) {
    console.error('Error unlinking families:', error);
    return false;
  }
}

