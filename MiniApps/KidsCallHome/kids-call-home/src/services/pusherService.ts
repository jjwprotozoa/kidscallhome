/**
 * ============================================================================
 * KIDS CALL HOME - Pusher Service
 * ============================================================================
 * 
 * Purpose: Handle real-time communication using Pusher
 * Technology: Pusher-js client library
 * 
 * Features:
 * - WebRTC signaling (offers, answers, ICE candidates)
 * - Call notifications (incoming, accepted, rejected)
 * - Connection management
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import Pusher from 'pusher-js';
import { useAppStore } from '../stores/useAppStore';
import FamilyDataService from './familyDataService';

export interface SignalingData {
  from: string;
  to: string;
  timestamp: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  callType?: 'voice' | 'video';
}

export interface CallNotification {
  from: string;
  to: string;
  callType: 'voice' | 'video';
  timestamp: string;
}

export interface StatusUpdate {
  userId: string;
  isOnline: boolean;
  lastSeen: string;
}

// Custom interface to avoid Pusher.Channel type conflicts
interface PusherChannel {
  bind<T = unknown>(event: string, callback: (data: T) => void): void;
  unbind<T = unknown>(event?: string, callback?: (data: T) => void): void;
  trigger(event: string, data: unknown): void;
}

class PusherService {
  private pusher: Pusher | null = null;
  private channel: PusherChannel | null = null;
  private familyId: string = '';
  private deviceId: string = '';
  private isConnecting: boolean = false;
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize Pusher with environment variables
    if (typeof window !== 'undefined') {
      const pusherKey = import.meta.env.VITE_PUSHER_KEY;
      const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER || 'eu';
      
      console.log('🔧 Initializing Pusher with cluster:', pusherCluster);
      console.log('🔧 Pusher key:', pusherKey);
      
      // Check if we have a valid Pusher key
      if (!pusherKey) {
        console.error('❌ No valid Pusher key provided. Please set VITE_PUSHER_KEY environment variable.');
        this.pusher = null;
        return;
      }
      
      try {
        // Enable Pusher logging for debugging
        if (import.meta.env.DEV) {
          Pusher.logToConsole = true;
        }
        
        this.pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
          forceTLS: true,
          enabledTransports: ['ws', 'wss'],
          authEndpoint: '/api/pusher-auth',
          // Optimize heartbeat settings to reduce ping/pong frequency
          activityTimeout: 120000, // 2 minutes
          pongTimeout: 30000,      // 30 seconds
          unavailableTimeout: 10000,
        });
        
        // Set up connection state monitoring
        this.pusher.connection.bind('state_change', (states: { previous: string; current: string }) => {
          console.log('Pusher connection state changed:', states.previous, '->', states.current);
          
          // Update store with connection state
          useAppStore.getState().setPusherConnected(states.current === 'connected');
          
          // If connection is lost, try to reconnect after a delay
          if (states.current === 'disconnected' && states.previous === 'connected') {
            console.warn('Pusher connection lost, will attempt to reconnect...');
            setTimeout(() => {
              if (this.pusher && this.pusher.connection.state === 'disconnected') {
                console.log('Attempting to reconnect to Pusher...');
                this.pusher.connect();
              }
            }, 2000);
          }
        });
        
        this.pusher.connection.bind('error', (error: Error) => {
          console.error('Pusher connection error:', error);
          // Update store to reflect connection failure
          useAppStore.getState().setPusherConnected(false);
        });
        
        this.pusher.connection.bind('unavailable', () => {
          console.warn('Pusher connection unavailable');
          useAppStore.getState().setPusherConnected(false);
        });
        
        this.pusher.connection.bind('connected', () => {
          console.log('Pusher connected successfully');
          useAppStore.getState().setPusherConnected(true);
          
          // Test the connection in development
          if (import.meta.env.DEV) {
            this.testConnection();
          }
        });
        
      } catch (error) {
        console.error('Failed to initialize Pusher:', error);
        this.pusher = null;
        
        // In development, provide a fallback message
        if (import.meta.env.DEV) {
          console.warn('⚠️ Pusher initialization failed. Real-time features may not work properly.');
          console.warn('This is expected if Pusher credentials are not configured for development.');
        }
      }
    }
  }


  /**
   * Connect to Pusher channel for a specific family
   */
  connect(familyId: string, deviceId: string): void {
    if (!this.pusher) {
      console.error('Pusher not initialized - real-time features will not work');
      // Update store to reflect that Pusher is not available
      useAppStore.getState().setPusherConnected(false);
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      console.log('Pusher connection already in progress, skipping...');
      return;
    }

    // Don't reconnect if already connected to the same family
    if (this.familyId === familyId && this.deviceId === deviceId && this.channel) {
      console.log(`Already connected to family channel: family-${familyId}`);
      return;
    }

    // Clear any existing connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Disconnect from previous channel if different
    if (this.channel && (this.familyId !== familyId || this.deviceId !== deviceId)) {
      this.disconnect();
    }

    this.isConnecting = true;

    // Wait for Pusher to be connected before subscribing
    if (this.pusher.connection.state === 'connected') {
      this.subscribeToChannel(familyId, deviceId);
    } else {
      // Wait for connection to be established with timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.isConnecting) {
          console.warn('Pusher connection timeout, retrying...');
          this.isConnecting = false;
          this.connect(familyId, deviceId);
        }
      }, 5000);

      // Wait for connection to be established
      this.pusher.connection.bind('connected', () => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.subscribeToChannel(familyId, deviceId);
      });
    }
  }

  /**
   * Subscribe to Pusher channel
   */
  private subscribeToChannel(familyId: string, deviceId: string): void {
    try {
      this.familyId = familyId;
      this.deviceId = deviceId;
      this.channel = this.pusher!.subscribe(`family-${familyId}`) as PusherChannel;
      this.isConnecting = false;

      console.log(`Connected to family channel: family-${familyId}`);
      console.log(`Channel type: ${this.channel.constructor.name}`);
      console.log(`Channel name: family-${familyId}`);
      
      // Set up status update listener immediately after channel subscription
      this.setupStatusUpdateListener();
      
      // Send initial online status immediately after connecting
      setTimeout(() => {
        console.log('Sending initial online status after channel connection');
        this.sendStatusUpdate(true).catch(console.error);
        
        // Test client event capability
        this.testClientEvents();
      }, 100);
    } catch (error) {
      console.error('Failed to connect to Pusher channel:', error);
      this.isConnecting = false;
    }
  }

  /**
   * Set up status update listener
   */
  private setupStatusUpdateListener(): void {
    if (!this.channel) return;
    
    console.log('Setting up status update listener for channel:', `family-${this.familyId}`);
    
    this.channel.bind('client-status-update', (data: StatusUpdate) => {
      console.log('🔔 Received status update event:', {
        data,
        currentDeviceId: this.deviceId,
        isFromSelf: data.userId === this.deviceId
      });
      
      // Only process status updates from other family members (not from self)
      if (data.userId !== this.deviceId) {
        console.log('✅ Processing status update from family member:', data);
        
        // Update the store with the status change
        const { updateFamilyMemberStatus } = useAppStore.getState();
        updateFamilyMemberStatus(data.userId, data.isOnline, new Date(data.lastSeen));
        
        // Also update the persistent family data
        if (this.familyId) {
          FamilyDataService.updateFamilyMemberStatus(this.familyId, data.userId, data.isOnline);
        }
      } else {
        console.log('⏭️ Skipping status update from self');
      }
    });
  }

  /**
   * Disconnect from Pusher
   */
  disconnect(): void {
    try {
      // Clear connection timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      this.isConnecting = false;

      if (this.channel) {
        this.pusher?.unsubscribe(`family-${this.familyId}`);
        this.channel = null;
      }
      
      // Only disconnect if we're actually connected
      if (this.pusher && this.pusher.connection.state === 'connected') {
        try {
          this.pusher.disconnect();
        } catch (disconnectError) {
          console.warn('Error during Pusher disconnect:', disconnectError);
        }
      }
      
      // Reset family and device IDs
      this.familyId = '';
      this.deviceId = '';
    } catch (error) {
      console.warn('Error during Pusher disconnect:', error);
      // Reset channel but keep pusher instance
      this.channel = null;
      this.isConnecting = false;
    }
  }

  /**
   * Send signaling data to the server
   */
  private async sendSignaling(action: string, toDeviceId: string, data?: unknown): Promise<void> {
    try {
      const response = await fetch('/api/signaling', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          fromDeviceId: this.deviceId,
          toDeviceId,
          familyId: this.familyId,
          data
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Signaling sent:', result);
    } catch (error) {
      console.error('Failed to send signaling:', error);
      throw error;
    }
  }

  /**
   * Send WebRTC offer
   */
  async sendOffer(toDeviceId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    await this.sendSignaling('offer', toDeviceId, offer);
  }

  /**
   * Send WebRTC answer
   */
  async sendAnswer(toDeviceId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    await this.sendSignaling('answer', toDeviceId, answer);
  }

  /**
   * Send ICE candidate
   */
  async sendIceCandidate(toDeviceId: string, candidate: RTCIceCandidateInit): Promise<void> {
    await this.sendSignaling('ice-candidate', toDeviceId, candidate);
  }

  /**
   * Send call request notification
   */
  async sendCallRequest(toDeviceId: string, callType: 'voice' | 'video'): Promise<void> {
    await this.sendSignaling('call-request', toDeviceId, { callType });
  }

  /**
   * Send call accepted notification
   */
  async sendCallAccepted(toDeviceId: string): Promise<void> {
    await this.sendSignaling('call-accepted', toDeviceId);
  }

  /**
   * Send call rejected notification
   */
  async sendCallRejected(toDeviceId: string): Promise<void> {
    await this.sendSignaling('call-rejected', toDeviceId);
  }

  /**
   * Send end call notification
   */
  async sendEndCall(toDeviceId: string): Promise<void> {
    await this.sendSignaling('end-call', toDeviceId);
  }

  /**
   * Listen for WebRTC offers
   */
  onOffer(callback: (data: SignalingData) => void): void {
    if (!this.channel) return;
    this.channel.bind('webrtc-offer', (data: SignalingData) => {
      if (data.to === this.deviceId) {
        callback(data);
      }
    });
  }

  /**
   * Listen for WebRTC answers
   */
  onAnswer(callback: (data: SignalingData) => void): void {
    if (!this.channel) return;
    this.channel.bind('webrtc-answer', (data: SignalingData) => {
      if (data.to === this.deviceId) {
        callback(data);
      }
    });
  }

  /**
   * Listen for ICE candidates
   */
  onIceCandidate(callback: (data: SignalingData) => void): void {
    if (!this.channel) return;
    this.channel.bind('webrtc-ice-candidate', (data: SignalingData) => {
      if (data.to === this.deviceId) {
        callback(data);
      }
    });
  }

  /**
   * Listen for incoming calls
   */
  onIncomingCall(callback: (data: CallNotification) => void): void {
    if (!this.channel) return;
    this.channel.bind('incoming-call', (data: CallNotification) => {
      if (data.to === this.deviceId) {
        callback(data);
      }
    });
  }

  /**
   * Listen for call accepted
   */
  onCallAccepted(callback: (data: SignalingData) => void): void {
    if (!this.channel) return;
    this.channel.bind('call-accepted', (data: SignalingData) => {
      if (data.to === this.deviceId) {
        callback(data);
      }
    });
  }

  /**
   * Listen for call rejected
   */
  onCallRejected(callback: (data: SignalingData) => void): void {
    if (!this.channel) return;
    this.channel.bind('call-rejected', (data: SignalingData) => {
      if (data.to === this.deviceId) {
        callback(data);
      }
    });
  }

  /**
   * Listen for end call
   */
  onEndCall(callback: (data: SignalingData) => void): void {
    if (!this.channel) return;
    this.channel.bind('webrtc-end-call', (data: SignalingData) => {
      if (data.to === this.deviceId) {
        callback(data);
      }
    });
  }

  /**
   * Send status update
   */
  async sendStatusUpdate(isOnline: boolean): Promise<void> {
    if (!this.familyId || !this.deviceId) {
      console.warn('Cannot send status update: missing familyId or deviceId', {
        familyId: this.familyId,
        deviceId: this.deviceId
      });
      return;
    }
    
    console.log('Sending status update:', {
      deviceId: this.deviceId,
      familyId: this.familyId,
      isOnline,
      pusherConnected: this.pusher?.connection?.state
    });
    
    try {
      const response = await fetch('/api/signaling', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'status-update',
          fromDeviceId: this.deviceId,
          toDeviceId: 'all', // Broadcast to all family members
          familyId: this.familyId,
          data: {
            isOnline,
            lastSeen: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Status update sent successfully:', result);
    } catch (error) {
      console.error('Failed to send status update:', error);
    }
  }


  /**
   * Get connection state
   */
  getConnectionState(): string {
    return this.pusher?.connection?.state || 'disconnected';
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.pusher?.connection?.state === 'connected';
  }

  /**
   * Test Pusher connection with a simple event
   */
  testConnection(): void {
    if (!this.pusher) {
      console.error('Pusher not initialized');
      return;
    }

    console.log('🧪 Testing Pusher connection...');
    
    // Subscribe to a test channel
    const testChannel = this.pusher.subscribe('test-channel');
    
    testChannel.bind('test-event', (data: unknown) => {
      console.log('✅ Pusher test event received:', data);
    });
    
    // Note: Client-side Pusher cannot trigger events directly
    // This would need to be done from the server side
    console.log('🧪 Test channel subscribed. Use server-side trigger to test.');
  }

  /**
   * Test client events capability
   */
  private testClientEvents(): void {
    if (!this.channel) {
      console.log('❌ Cannot test client events: no channel');
      return;
    }

    console.log('🧪 Testing client events capability...');
    
    try {
      // Try to trigger a client event
      this.channel.trigger('client-test', {
        message: 'Testing client events',
        timestamp: new Date().toISOString()
      });
      console.log('✅ Client event triggered successfully - client events are enabled!');
    } catch (error) {
      console.error('❌ Client event failed:', error);
      console.log('💡 Make sure "Client Events" is enabled in your Pusher app settings');
    }
  }
}

// Export singleton instance
export const pusherService = new PusherService();
export default pusherService;
