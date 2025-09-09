/**
 * ============================================================================
 * KIDS CALL HOME - Demo Family Data
 * ============================================================================
 * 
 * Purpose: Pre-populate demo family data for testing and demonstration
 * Interface: Used by development and demo purposes
 * Dependencies: FamilyDataService, types
 * 
 * V1 Features:
 * - Demo family with realistic data
 * - Easy testing and demonstration
 * - Pre-configured guardians and children
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import FamilyDataService from '../services/familyDataService';
import type { Family } from '../types';

/**
 * Create a demo family for testing purposes
 */
export function createDemoFamily(): Family {
  // Clear any existing demo families
  FamilyDataService.clearAllFamilies();
  
  // Create demo family
  const demoFamily = FamilyDataService.createFamily({
    familyName: 'The Johnson Family',
    guardianName: 'Mom',
    guardianEmail: 'mom@johnsonfamily.com'
  });
  
  // Add a second guardian
  const dadGuardian = {
    id: `guardian-${Date.now()}-dad`,
    name: 'Dad',
    email: 'dad@johnsonfamily.com',
    avatar: '👨‍💼',
    isOnline: true,
    lastSeen: new Date(),
    deviceId: `device-${Date.now()}-dad`,
    preferences: {
      theme: 'guardian' as const,
      notifications: {
        calls: true,
        messages: true,
        childOnline: true,
      },
      callQuality: 'auto' as const,
      showTechnicalDetails: true,
    },
  };
  
  // Add dad to the family
  demoFamily.guardians.push(dadGuardian);
  
  // Add children
  FamilyDataService.addChildToFamily(demoFamily.id, {
    childName: 'Emma',
    childAge: 8,
    childAvatar: '👧'
  });
  
  FamilyDataService.addChildToFamily(demoFamily.id, {
    childName: 'Jake',
    childAge: 6,
    childAvatar: '👦'
  });
  
  FamilyDataService.addChildToFamily(demoFamily.id, {
    childName: 'Sophie',
    childAge: 10,
    childAvatar: '👩'
  });
  
  // Update the family with all members
  FamilyDataService.saveFamily(demoFamily);
  
  return demoFamily;
}

/**
 * Get demo family information for display
 */
export function getDemoFamilyInfo(): {
  familyCode: string;
  guardians: string[];
  children: string[];
  instructions: string[];
} {
  const families = FamilyDataService.getAllFamilies();
  const demoFamily = families.find(f => f.name === 'The Johnson Family');
  
  if (!demoFamily) {
    return {
      familyCode: 'DEMO-CODE',
      guardians: ['Mom', 'Dad'],
      children: ['Emma', 'Jake', 'Sophie'],
      instructions: ['Demo family not found. Run createDemoFamily() first.']
    };
  }
  
  return {
    familyCode: demoFamily.code,
    guardians: demoFamily.guardians.map(g => g.name),
    children: demoFamily.children.map(c => c.name),
    instructions: [
      `Family Code: ${demoFamily.code}`,
      'Guardians: Mom, Dad',
      'Children: Emma, Jake, Sophie',
      '',
      'To test:',
      '1. Go to Login page',
      '2. Enter family code and any guardian/child name',
      '3. You should be logged in successfully',
      '4. KidsDashboard will show the real family data'
    ]
  };
}

/**
 * Reset demo data
 */
export function resetDemoData(): void {
  FamilyDataService.clearAllFamilies();
}

export default {
  createDemoFamily,
  getDemoFamilyInfo,
  resetDemoData
};
