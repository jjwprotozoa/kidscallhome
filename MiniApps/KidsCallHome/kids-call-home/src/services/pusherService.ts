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

// Custom interface to avoid Pusher.Channel type conflicts
interface PusherChannel {
  bind<T = unknown>(event: string, callback: (data: T) => void): void;
  unbind<T = unknown>(event?: string, callback?: (data: T) => void): void;
}

class PusherService {
  private pusher: Pusher | null = null;
  private channel: PusherChannel | null = null;
  private familyId: string = '';
  private deviceId: string = '';

  constructor() {
    // Initialize Pusher with environment variables
    if (typeof window !== 'undefined') {
      const pusherKey = import.meta.env.VITE_PUSHER_KEY;
      const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER || 'us2';
      
      console.log('🔧 Initializing Pusher with:', { pusherKey, pusherCluster });
      
      // Check if we have a valid Pusher key
      if (!pusherKey) {
        console.error('❌ No valid Pusher key provided. Please set VITE_PUSHER_KEY environment variable.');
        this.pusher = null;
        return;
      }
      
      try {
        this.pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
          forceTLS: true, // Always use TLS for real Pusher connections
          enabledTransports: ['ws', 'wss'],
          authEndpoint: '/api/pusher-auth', // Optional auth endpoint
        });
        
        // Set up connection state monitoring
        this.pusher.connection.bind('state_change', (states: { previous: string; current: string }) => {
          console.log('Pusher connection state changed:', states.previous, '->', states.current);
          
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
        });
        
      } catch (error) {
        console.error('Failed to initialize Pusher:', error);
        this.pusher = null;
      }
    }
  }


  /**
   * Connect to Pusher channel for a specific family
   */
  connect(familyId: string, deviceId: string): void {
    if (!this.pusher) {
      console.error('Pusher not initialized');
      return;
    }

    // Don't reconnect if already connected to the same family
    if (this.familyId === familyId && this.deviceId === deviceId && this.channel) {
      console.log(`Already connected to family channel: family-${familyId}`);
      return;
    }

    // Disconnect from previous channel if different
    if (this.channel && (this.familyId !== familyId || this.deviceId !== deviceId)) {
      this.disconnect();
    }

    // Wait for Pusher to be connected before subscribing
    if (this.pusher.connection.state === 'connected') {
      this.subscribeToChannel(familyId, deviceId);
    } else {
      // Wait for connection to be established
      this.pusher.connection.bind('connected', () => {
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

      console.log(`Connected to family channel: family-${familyId}`);
    } catch (error) {
      console.error('Failed to connect to Pusher channel:', error);
    }
  }

  /**
   * Disconnect from Pusher
   */
  disconnect(): void {
    try {
      if (this.channel) {
        this.pusher?.unsubscribe(`family-${this.familyId}`);
        this.channel = null;
      }
      if (this.pusher) {
        // Check connection state before disconnecting
        const connectionState = this.pusher.connection.state;
        if (connectionState === 'connected' || connectionState === 'connecting') {
          try {
            this.pusher.disconnect();
          } catch (disconnectError) {
            console.warn('Error during Pusher disconnect:', disconnectError);
          }
        }
        // Don't set pusher to null - keep the instance for reconnection
        // this.pusher = null;
      }
    } catch (error) {
      console.warn('Error during Pusher disconnect:', error);
      // Reset channel but keep pusher instance
      this.channel = null;
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
}

// Export singleton instance
export const pusherService = new PusherService();
export default pusherService;
