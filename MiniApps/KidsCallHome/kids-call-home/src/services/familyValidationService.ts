/**
 * ============================================================================
 * KIDS CALL HOME - Family Validation Service
 * ============================================================================
 * 
 * Purpose: Centralized family access control and validation
 * Interface: Shared across all components
 * Dependencies: types
 * 
 * V1 Features:
 * - Family membership validation
 * - Call authorization checks
 * - Family-specific error messages
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import type { Child, Family, Guardian } from '../types';

export interface FamilyValidationResult {
  isValid: boolean;
  error?: string;
  user?: Guardian | Child;
  userType?: 'guardian' | 'child';
}

export class FamilyValidationService {
  /**
   * Validate if a user can join a family
   */
  static validateFamilyJoin(
    family: Family,
    familyCode: string,
    userName: string
  ): FamilyValidationResult {
    // Check family code
    if (family.code.toUpperCase() !== familyCode.trim().toUpperCase()) {
      return {
        isValid: false,
        error: `Invalid family code. Please check the code and try again, or ask your family for the correct code.`
      };
    }

    // Look for user in guardians
    const guardian = family.guardians.find(
      g => g.name.toLowerCase() === userName.trim().toLowerCase()
    );

    if (guardian) {
      return {
        isValid: true,
        user: guardian,
        userType: 'guardian'
      };
    }

    // Look for user in children
    const child = family.children.find(
      c => c.name.toLowerCase() === userName.trim().toLowerCase()
    );

    if (child) {
      return {
        isValid: true,
        user: child,
        userType: 'child'
      };
    }

    // User not found in family
    return {
      isValid: false,
      error: `Sorry, "${userName}" is not a member of the "${family.name}" family. Please check your name or ask your parents to add you to the family first.`
    };
  }

  /**
   * Validate if a call can be made between two users
   */
  static validateCallAuthorization(
    family: Family,
    callerId: string,
    targetId: string
  ): FamilyValidationResult {
    // Check if caller is in family
    const caller = this.findUserInFamily(family, callerId);
    if (!caller) {
      return {
        isValid: false,
        error: 'You must be logged into a family to make calls.'
      };
    }

    // Check if target is in the same family
    const target = this.findUserInFamily(family, targetId);
    if (!target) {
      return {
        isValid: false,
        error: 'You can only call members of your own family.'
      };
    }

    return {
      isValid: true,
      user: caller.user,
      userType: caller.userType
    };
  }

  /**
   * Find a user in a family by ID
   */
  private static findUserInFamily(
    family: Family,
    userId: string
  ): { user: Guardian | Child; userType: 'guardian' | 'child' } | null {
    // Check guardians
    const guardian = family.guardians.find(g => g.id === userId);
    if (guardian) {
      return { user: guardian, userType: 'guardian' };
    }

    // Check children
    const child = family.children.find(c => c.id === userId);
    if (child) {
      return { user: child, userType: 'child' };
    }

    return null;
  }

  /**
   * Get family-specific error messages
   */
  static getFamilyErrorMessage(
    familyName: string,
    userName: string,
    errorType: 'not_member' | 'invalid_code' | 'call_unauthorized'
  ): string {
    switch (errorType) {
      case 'not_member':
        return `Sorry, "${userName}" is not a member of the "${familyName}" family. Please check your name or ask your parents to add you to the family first.`;
      
      case 'invalid_code':
        return `Invalid family code. Please check the code and try again, or ask your family for the correct code.`;
      
      case 'call_unauthorized':
        return `You can only call members of your own family.`;
      
      default:
        return 'An error occurred. Please try again.';
    }
  }

  /**
   * Check if a user can initiate calls
   */
  static canInitiateCalls(
    family: Family,
    userType: 'guardian' | 'child'
  ): boolean {
    if (userType === 'guardian') {
      return true; // Guardians can always initiate calls
    }

    // Children can only initiate calls if family settings allow it
    return family.settings.allowChildInitiatedCalls;
  }

  /**
   * Get available call targets for a user
   */
  static getAvailableCallTargets(
    family: Family,
    user: Guardian | Child,
    userType: 'guardian' | 'child'
  ): (Guardian | Child)[] {
    if (userType === 'guardian') {
      // Guardians can call all children
      return family.children;
    }

    // Children can only call approved guardians
    const child = user as Child;
    return family.guardians.filter(guardian => 
      child.approvedGuardians.includes(guardian.id)
    );
  }
}

export default FamilyValidationService;
