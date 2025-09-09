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
  private static readonly CURRENT_FAMILY_KEY = 'kids-call-home-current-family';

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
    
    return `${adjective}-${noun}-${numbers}`;
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
      isOnline: true,
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

    // Update user's online status
    if (validation.userType === 'guardian') {
      const guardian = family.guardians.find(g => g.id === validation.user!.id);
      if (guardian) {
        guardian.isOnline = true;
        guardian.lastSeen = new Date();
      }
    } else {
      const child = family.children.find(c => c.id === validation.user!.id);
      if (child) {
        child.isOnline = true;
        child.lastSeen = new Date();
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
      isOnline: false,
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
    return families.find(f => f.code.toUpperCase() === code.toUpperCase()) || null;
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
      
      const families = JSON.parse(stored);
      // Convert date strings back to Date objects
      return families.map((family: any) => ({
        ...family,
        created: new Date(family.created),
        lastActive: new Date(family.lastActive),
        guardians: family.guardians.map((guardian: any) => ({
          ...guardian,
          lastSeen: new Date(guardian.lastSeen),
        })),
        children: family.children.map((child: any) => ({
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
  static saveFamily(family: Family): void {
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
   * Update family member status
   */
  static updateFamilyMemberStatus(familyId: string, userId: string, isOnline: boolean): void {
    const family = this.findFamilyById(familyId);
    if (!family) return;

    // Update guardian status
    const guardian = family.guardians.find(g => g.id === userId);
    if (guardian) {
      guardian.isOnline = isOnline;
      guardian.lastSeen = new Date();
    }

    // Update child status
    const child = family.children.find(c => c.id === userId);
    if (child) {
      child.isOnline = isOnline;
      child.lastSeen = new Date();
    }

    family.lastActive = new Date();
    this.saveFamily(family);
  }

  /**
   * Delete family (for testing/cleanup)
   */
  static deleteFamily(familyId: string): boolean {
    try {
      const families = this.getAllFamilies();
      const filteredFamilies = families.filter(f => f.id !== familyId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredFamilies));
      return true;
    } catch (error) {
      console.error('Error deleting family:', error);
      return false;
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
   * Clear all family data (for testing/cleanup)
   */
  static clearAllFamilies(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.CURRENT_FAMILY_KEY);
    } catch (error) {
      console.error('Error clearing families:', error);
    }
  }
}

export default FamilyDataService;
