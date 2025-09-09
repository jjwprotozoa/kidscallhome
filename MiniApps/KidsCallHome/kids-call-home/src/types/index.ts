/**
 * ============================================================================
 * KIDS CALL HOME - Type Definitions
 * ============================================================================
 * 
 * Purpose: Core TypeScript interfaces for family communication system
 * Interface: Shared across all components
 * Dependencies: None - pure type definitions
 * 
 * V1 Features:
 * - Family code authentication system
 * - Guardian and child user types
 * - WebRTC calling state management
 * - Real-time messaging types
 * 
 * V2 Ready:
 * - Extensible user roles and permissions
 * - Multi-family support architecture
 * - Advanced calling features (group calls, etc.)
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

/**
 * Family - Core family group containing guardians and children
 * 
 * Each family has a unique code that serves as the primary authentication
 * mechanism. No traditional login required - family code + device fingerprint
 * provides secure, family-scoped access.
 */
export interface Family {
  id: string;
  code: string;          // e.g., "BEAR-CAKE-2024" - memorable, secure
  name: string;          // "Johnson Family" - display name
  guardians: Guardian[];
  children: Child[];
  created: Date;
  lastActive: Date;
  settings: FamilySettings;
}

/**
 * Guardian - Parent or caregiver with full access to family features
 * 
 * Guardians can call any child, manage family settings, and have access
 * to professional interface with technical details and multi-child management.
 */
export interface Guardian {
  id: string;
  name: string;          // "Mom", "Dad", "Grandma" - family role
  email: string;         // Optional - for notifications
  avatar?: string;       // Profile picture or emoji
  isOnline: boolean;
  lastSeen: Date;
  deviceId: string;      // Browser fingerprint for device tracking
  preferences: GuardianPreferences;
}

/**
 * Child - Family member with simplified, kid-friendly interface
 * 
 * Children have access to playful interface with large buttons, simple
 * language, and safety-focused design. Can only call approved guardians.
 */
export interface Child {
  id: string;
  name: string;          // "Emma", "Jake" - first name only
  age?: number;          // Optional - for age-appropriate features
  avatar?: string;       // Profile picture or emoji
  deviceId: string;      // Browser fingerprint for device tracking
  isOnline: boolean;
  lastSeen: Date;
  preferences: ChildPreferences;
  approvedGuardians: string[]; // Array of guardian IDs who can be called
}

/**
 * Family Settings - Configuration options for the family group
 */
export interface FamilySettings {
  allowChildInitiatedCalls: boolean;
  emergencyContacts: string[];
  callTimeout: number;   // Seconds before call times out
  maxCallDuration: number; // Maximum call length in minutes
  requireGuardianApproval: boolean;
  timezone: string;
}

/**
 * Guardian Preferences - Personal settings for guardian interface
 */
export interface GuardianPreferences {
  theme: 'guardian' | 'auto';
  notifications: {
    calls: boolean;
    messages: boolean;
    childOnline: boolean;
  };
  callQuality: 'auto' | 'high' | 'medium' | 'low';
  showTechnicalDetails: boolean;
}

/**
 * Child Preferences - Personal settings for kids interface
 */
export interface ChildPreferences {
  theme: 'kids' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  soundEffects: boolean;
  animations: boolean;
  emergencyButtonEnabled: boolean;
}

/**
 * Call State - WebRTC calling state management
 * 
 * Tracks the current state of voice/video calls with quality metrics
 * and connection information for both guardian and child interfaces.
 */
export interface CallState {
  id: string;
  type: 'voice' | 'video';
  participants: {
    guardian: Guardian;
    child: Child;
  };
  status: 'idle' | 'ringing' | 'connecting' | 'active' | 'ended' | 'failed';
  startTime?: Date;
  endTime?: Date;
  duration?: number;     // Seconds
  quality: {
    audio: 'excellent' | 'good' | 'fair' | 'poor';
    video?: 'excellent' | 'good' | 'fair' | 'poor';
    connection: 'stable' | 'unstable' | 'poor';
  };
  networkInfo: NetworkInfo;
}

/**
 * Network Information - Real-time network quality monitoring
 * 
 * Provides human-readable network status for both technical (guardian)
 * and simple (kids) interfaces. Helps users understand connection quality.
 */
export interface NetworkInfo {
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  signalStrength: 'excellent' | 'good' | 'fair' | 'poor';
  bandwidth: 'high' | 'medium' | 'low';
  latency: number;       // Milliseconds
  jitter: number;        // Milliseconds
  packetLoss: number;    // Percentage
  location?: string;     // "School network", "Home WiFi", etc.
}

/**
 * Message - Real-time messaging between family members
 * 
 * Supports text messages, voice notes, and emoji reactions with
 * family-scoped delivery and optional encryption.
 */
export interface Message {
  id: string;
  familyId: string;
  from: {
    id: string;
    name: string;
    type: 'guardian' | 'child';
  };
  to: {
    id: string;
    name: string;
    type: 'guardian' | 'child';
  };
  content: {
    type: 'text' | 'voice' | 'emoji' | 'call_invitation';
    text?: string;
    audioUrl?: string;
    emoji?: string;
    callType?: 'voice' | 'video';
  };
  timestamp: Date;
  read: boolean;
  delivered: boolean;
}

/**
 * Device Information - Browser and device detection
 * 
 * Used for device fingerprinting, responsive design adaptation,
 * and cross-platform compatibility optimization.
 */
export interface DeviceInfo {
  id: string;            // Unique device fingerprint
  type: 'phone' | 'tablet' | 'desktop' | 'watch';
  platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';
  browser: 'chrome' | 'safari' | 'firefox' | 'edge' | 'unknown';
  screenSize: {
    width: number;
    height: number;
  };
  capabilities: {
    webRTC: boolean;
    webSocket: boolean;
    notifications: boolean;
    camera: boolean;
    microphone: boolean;
    touch: boolean;
  };
  userAgent: string;
}

/**
 * App State - Global application state management
 * 
 * Centralized state for family data, calling state, UI preferences,
 * and real-time connection status across all components.
 */
export interface AppState {
  // Family and authentication
  currentFamily: Family | null;
  currentUser: Guardian | Child | null;
  userType: 'guardian' | 'child' | null;
  
  // Calling state
  activeCall: CallState | null;
  incomingCall: CallState | null;
  callHistory: CallState[];
  
  // Messaging
  messages: Message[];
  unreadCount: number;
  
  // UI state
  theme: 'guardian' | 'kids' | 'auto';
  isLoading: boolean;
  error: string | null;
  
  // Device and network
  deviceInfo: DeviceInfo | null;
  networkInfo: NetworkInfo | null;
  isOnline: boolean;
  
  // WebSocket connection
  socketConnected: boolean;
  lastHeartbeat: Date | null;
}

/**
 * WebRTC Configuration - Peer connection settings
 * 
 * Optimized configuration for family calling with STUN servers
 * and quality adaptation based on network conditions.
 */
export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
  bundlePolicy: RTCBundlePolicy;
  rtcpMuxPolicy: RTCRtcpMuxPolicy;
  iceTransportPolicy: RTCIceTransportPolicy;
}

/**
 * API Response - Standardized API response format
 * 
 * Consistent response structure for all API calls with proper
 * error handling and type safety.
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

/**
 * Family Code Generation - Secure family code creation
 * 
 * Generates memorable, secure family codes using word combinations
 * that are easy for children to remember and type.
 */
export interface FamilyCode {
  code: string;          // "BEAR-CAKE-2024"
  words: string[];       // ["BEAR", "CAKE", "2024"]
  expires: Date;         // Optional expiration
  maxUses?: number;      // Optional usage limit
}

// Types are already exported above, no need for duplicate exports
