/**
 * ============================================================================
 * KIDS CALL HOME - Family Data Service
 * ============================================================================
 * 
 * Purpose: Centralized family data management and persistence
 * Interface: Shared across all components
 * Dependencies: types, familyValidationService
 * 
 * V1 Features:
 * - Family data creation and validation
 * - User authentication and management
 * - Local storage persistence
 * - Family code generation
 * 
 * V2 Ready:
 * - Backend API integration
 * - Real-time data synchronization
 * - Multi-device support
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import type { Child, Family, Guardian } from '../types';
import { FamilyValidationService } from './familyValidationService';

export interface CreateFamilyRequest {
  familyName: string;
  guardianName: string;
  guardianEmail?: string;
}

export interface JoinFamilyRequest {
  familyCode: string;
  userName: string;
}

export interface AddChildRequest {
  childName: string;
  childAge?: number;
  childAvatar?: string;
}

export class FamilyDataService {
  private static readonly STORAGE_KEY = 'kids-call-home-families';

  /**
   * Generate a secure, memorable family code
   */
  static generateFamilyCode(): string {
    const adjectives = [
      'HAPPY', 'SUNNY', 'BRAVE', 'SMART', 'KIND', 'FUNNY', 'CUTE', 'SWEET',
      'BOLD', 'CALM', 'WISE', 'FAST', 'TALL', 'SMALL', 'BIG', 'LITTLE'
    ];
    
    const nouns = [
      'BEAR', 'CAT', 'DOG', 'BIRD', 'FISH', 'TREE', 'STAR', 'MOON',
      'SUN', 'RAIN', 'SNOW', 'WIND', 'FIRE', 'WATER', 'EARTH', 'SKY'
    ];
    
    const numbers = new Date().getFullYear().toString().slice(-2);
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    const familyCode = `${adjective}-${noun}-${numbers}`;
    return familyCode;
  }

  /**
   * Create a new family with a guardian
   */
  static createFamily(request: CreateFamilyRequest): Family {
    const familyCode = this.generateFamilyCode();
    const guardianId = `guardian-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const familyId = `family-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const guardian: Guardian = {
      id: guardianId,
      name: request.guardianName,
      email: request.guardianEmail || '',
      avatar: '👨‍💼',
      isOnline: false, // Will be set to true when user actually connects
      lastSeen: new Date(),
      deviceId: this.generateDeviceId(),
      preferences: {
        theme: 'guardian',
        notifications: {
          calls: true,
          messages: true,
          childOnline: true,
        },
        callQuality: 'auto',
        showTechnicalDetails: true,
      },
    };

    const family: Family = {
      id: familyId,
      code: familyCode,
      name: request.familyName,
      guardians: [guardian],
      children: [],
      created: new Date(),
      lastActive: new Date(),
      settings: {
        allowChildInitiatedCalls: true,
        emergencyContacts: [],
        callTimeout: 30,
        maxCallDuration: 60,
        requireGuardianApproval: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    // Save family to local storage
    this.saveFamily(family);
    
    return family;
  }

  /**
   * Join an existing family
   */
  static joinFamily(request: JoinFamilyRequest): { family: Family; user: Guardian | Child; userType: 'guardian' | 'child' } | null {
    const family = this.findFamilyByCode(request.familyCode);
    if (!family) {
      return null;
    }

    const validation = FamilyValidationService.validateFamilyJoin(
      family,
      request.familyCode,
      request.userName
    );

    if (!validation.isValid || !validation.user || !validation.userType) {
      return null;
    }

    // Update user's last seen time (online status will be managed by real-time system)
    if (validation.userType === 'guardian') {
      const guardian = family.guardians.find(g => g.id === validation.user!.id);
      if (guardian) {
        guardian.lastSeen = new Date();
        // isOnline will be set by the real-time status system
      }
    } else {
      const child = family.children.find(c => c.id === validation.user!.id);
      if (child) {
        child.lastSeen = new Date();
        // isOnline will be set by the real-time status system
      }
    }

    // Save updated family
    this.saveFamily(family);

    return {
      family,
      user: validation.user,
      userType: validation.userType,
    };
  }

  /**
   * Add a child to an existing family
   */
  static addChildToFamily(familyId: string, request: AddChildRequest): Child | null {
    const family = this.findFamilyById(familyId);
    if (!family) {
      return null;
    }

    const childId = `child-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const child: Child = {
      id: childId,
      name: request.childName,
      age: request.childAge,
      avatar: request.childAvatar || '👶',
      deviceId: this.generateDeviceId(),
      isOnline: false, // Will be set to true when user actually connects
      lastSeen: new Date(),
      preferences: {
        theme: 'kids',
        fontSize: 'large',
        soundEffects: true,
        animations: true,
        emergencyButtonEnabled: true,
      },
      approvedGuardians: family.guardians.map(g => g.id), // Approve all guardians by default
    };

    family.children.push(child);
    family.lastActive = new Date();

    // Save updated family
    this.saveFamily(family);

    return child;
  }

  /**
   * Find family by code
   */
  static findFamilyByCode(code: string): Family | null {
    const families = this.getAllFamilies();
    const found = families.find(f => f.code.toUpperCase() === code.toUpperCase());
    return found || null;
  }

  /**
   * Find family by ID
   */
  static findFamilyById(id: string): Family | null {
    const families = this.getAllFamilies();
    return families.find(f => f.id === id) || null;
  }

  /**
   * Get all families from storage
   */
  static getAllFamilies(): Family[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const families = JSON.parse(stored) as Family[];
      // Convert date strings back to Date objects
      return families.map((family) => ({
        ...family,
        created: new Date(family.created),
        lastActive: new Date(family.lastActive),
        guardians: family.guardians.map((guardian) => ({
          ...guardian,
          lastSeen: new Date(guardian.lastSeen),
        })),
        children: family.children.map((child) => ({
          ...child,
          lastSeen: new Date(child.lastSeen),
        })),
      }));
    } catch (error) {
      console.error('Error loading families from storage:', error);
      return [];
    }
  }

  /**
   * Save family to storage
   */
  private static saveFamily(family: Family): void {
    try {
      const families = this.getAllFamilies();
      const existingIndex = families.findIndex(f => f.id === family.id);
      
      if (existingIndex >= 0) {
        families[existingIndex] = family;
      } else {
        families.push(family);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(families));
    } catch (error) {
      console.error('Error saving family to storage:', error);
    }
  }

  /**
   * Generate a unique device ID
   */
  private static generateDeviceId(): string {
    return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update family member status by deviceId
   */
  static updateFamilyMemberStatus(familyId: string, deviceId: string, isOnline: boolean): void {
    const family = this.findFamilyById(familyId);
    if (!family) {
      return;
    }

    let memberFound = false;

    // Update guardian status (search by deviceId)
    const guardian = family.guardians.find(g => g.deviceId === deviceId);
    if (guardian) {
      guardian.isOnline = isOnline;
      guardian.lastSeen = new Date();
      memberFound = true;
    }

    // Update child status (search by deviceId)
    const child = family.children.find(c => c.deviceId === deviceId);
    if (child) {
      child.isOnline = isOnline;
      child.lastSeen = new Date();
      memberFound = true;
    }

    if (!memberFound) {
      return;
    }

    family.lastActive = new Date();
    this.saveFamily(family);
  }

  /**
   * Sync device ID for a family member (useful when user logs in with different device)
   */
  static syncDeviceId(familyId: string, userId: string, newDeviceId: string): void {
    const family = this.findFamilyById(familyId);
    if (!family) {
      return;
    }

    let memberFound = false;

    // Update guardian device ID
    const guardian = family.guardians.find(g => g.id === userId);
    if (guardian) {
      console.log(`🔄 Syncing device ID for guardian ${guardian.name}: ${guardian.deviceId} -> ${newDeviceId}`);
      guardian.deviceId = newDeviceId;
      memberFound = true;
    }

    // Update child device ID
    const child = family.children.find(c => c.id === userId);
    if (child) {
      console.log(`🔄 Syncing device ID for child ${child.name}: ${child.deviceId} -> ${newDeviceId}`);
      child.deviceId = newDeviceId;
      memberFound = true;
    }

    if (memberFound) {
      family.lastActive = new Date();
      this.saveFamily(family);
    }
  }



  /**
   * Add a guardian to an existing family
   */
  static addGuardianToFamily(familyId: string, guardianName: string, guardianEmail?: string): Guardian | null {
    const family = this.findFamilyById(familyId);
    if (!family) {
      return null;
    }

    const guardianId = `guardian-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const guardian: Guardian = {
      id: guardianId,
      name: guardianName,
      email: guardianEmail || '',
      avatar: '👨‍💼',
      isOnline: false,
      lastSeen: new Date(),
      deviceId: this.generateDeviceId(),
      preferences: {
        theme: 'guardian',
        notifications: {
          calls: true,
          messages: true,
          childOnline: true,
        },
        callQuality: 'auto',
        showTechnicalDetails: true,
      },
    };

    family.guardians.push(guardian);
    family.lastActive = new Date();

    // Save updated family
    this.saveFamily(family);

    return guardian;
  }

  /**
   * Remove a guardian from a family
   */
  static removeGuardianFromFamily(familyId: string, guardianId: string): boolean {
    const family = this.findFamilyById(familyId);
    if (!family) {
      return false;
    }

    // Don't allow removing the last guardian
    if (family.guardians.length <= 1) {
      return false;
    }

    family.guardians = family.guardians.filter(g => g.id !== guardianId);
    family.lastActive = new Date();

    // Save updated family
    this.saveFamily(family);

    return true;
  }

  /**
   * Remove a child from a family
   */
  static removeChildFromFamily(familyId: string, childId: string): boolean {
    const family = this.findFamilyById(familyId);
    if (!family) {
      return false;
    }

    family.children = family.children.filter(c => c.id !== childId);
    family.lastActive = new Date();

    // Save updated family
    this.saveFamily(family);

    return true;
  }

  /**
   * Update family settings
   */
  static updateFamilySettings(familyId: string, settings: Partial<Family['settings']>): boolean {
    const family = this.findFamilyById(familyId);
    if (!family) {
      return false;
    }

    family.settings = { ...family.settings, ...settings };
    family.lastActive = new Date();

    // Save updated family
    this.saveFamily(family);

    return true;
  }

  /**
   * Update family name
   */
  static updateFamilyName(familyId: string, newName: string): boolean {
    const family = this.findFamilyById(familyId);
    if (!family) {
      return false;
    }

    family.name = newName;
    family.lastActive = new Date();

    // Save updated family
    this.saveFamily(family);

    return true;
  }

  /**
   * Check if a family name already exists
   */
  static isFamilyNameTaken(familyName: string): boolean {
    const families = this.getAllFamilies();
    return families.some(f => f.name.toLowerCase() === familyName.toLowerCase());
  }

  /**
   * Check if a family code already exists
   */
  static isFamilyCodeTaken(familyCode: string): boolean {
    const families = this.getAllFamilies();
    return families.some(f => f.code.toUpperCase() === familyCode.toUpperCase());
  }

}

export default FamilyDataService;
