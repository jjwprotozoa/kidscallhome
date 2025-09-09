/**
 * ============================================================================
 * KIDS CALL HOME - WebRTC Service
 * ============================================================================
 * 
 * Purpose: Native WebRTC implementation for peer-to-peer calling
 * Technology: Native WebRTC APIs (no external dependencies)
 * 
 * Features:
 * - Voice and video calling
 * - ICE candidate handling
 * - Connection state management
 * - Media stream management
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
  bundlePolicy?: RTCBundlePolicy;
  rtcpMuxPolicy?: RTCRtcpMuxPolicy;
  iceTransportPolicy?: RTCIceTransportPolicy;
}

export interface CallState {
  id: string;
  type: 'voice' | 'video';
  status: 'idle' | 'ringing' | 'connecting' | 'active' | 'ended';
  participants: {
    local: string;
    remote: string;
  };
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: WebRTCConfig;
  private callState: CallState | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config?: Partial<WebRTCConfig>) {
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all',
      ...config
    };
  }

  /**
   * Initialize local media stream
   */
  async initializeLocalStream(video: boolean = true): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: video ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      return stream;
    } catch (error) {
      console.error('Failed to initialize local stream:', error);
      throw new Error('Failed to access camera and microphone');
    }
  }

  /**
   * Create peer connection
   */
  private createPeerConnection(): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection(this.config);

    // Add local stream to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('📹 Received remote stream');
      this.remoteStream = event.streams[0];
      this.emit('remoteStream', event.streams[0]);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated');
        this.emit('iceCandidate', event.candidate);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', peerConnection.connectionState);
      this.emit('connectionStateChange', peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        this.updateCallState({ status: 'active' });
      } else if (peerConnection.connectionState === 'disconnected' || 
                 peerConnection.connectionState === 'failed') {
        this.endCall();
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
      this.emit('iceConnectionStateChange', peerConnection.iceConnectionState);
    };

    return peerConnection;
  }

  /**
   * Initiate a call
   */
  async initiateCall(remoteId: string, type: 'voice' | 'video'): Promise<void> {
    try {
      console.log(`📞 Initiating ${type} call to ${remoteId}`);
      
      // Initialize local stream
      await this.initializeLocalStream(type === 'video');
      
      // Create call state
      this.callState = {
        id: `call_${Date.now()}`,
        type,
        status: 'ringing',
        participants: {
          local: 'current-user',
          remote: remoteId
        },
        startTime: new Date()
      };

      // Create peer connection
      this.peerConnection = this.createPeerConnection();
      
      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      // Emit offer event
      this.emit('offer', offer);
      
      console.log('✅ Call initiated successfully');
    } catch (error) {
      console.error('❌ Failed to initiate call:', error);
      throw error;
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      console.log('📞 Answering incoming call');
      
      if (!this.callState) {
        throw new Error('No incoming call to answer');
      }

      // Initialize local stream
      await this.initializeLocalStream(this.callState.type === 'video');
      
      // Create peer connection
      this.peerConnection = this.createPeerConnection();
      
      // Set remote description
      await this.peerConnection.setRemoteDescription(offer);
      
      // Create answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      // Update call state
      this.updateCallState({ status: 'connecting' });
      
      // Emit answer event
      this.emit('answer', answer);
      
      console.log('✅ Call answered successfully');
    } catch (error) {
      console.error('❌ Failed to answer call:', error);
      throw error;
    }
  }

  /**
   * Handle incoming offer
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      console.log('📞 Handling incoming offer');
      
      if (!this.peerConnection) {
        // This is an incoming call
        this.callState = {
          id: `call_${Date.now()}`,
          type: 'voice', // Default to voice, could be determined from offer
          status: 'ringing',
          participants: {
            local: 'current-user',
            remote: 'unknown'
          },
          startTime: new Date()
        };
        
        this.emit('incomingCall', { offer, callState: this.callState });
      } else {
        // This is a renegotiation
        await this.peerConnection.setRemoteDescription(offer);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.emit('answer', answer);
      }
    } catch (error) {
      console.error('❌ Failed to handle offer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      console.log('📞 Handling incoming answer');
      
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('❌ Failed to handle answer:', error);
      throw error;
    }
  }

  /**
   * Handle ICE candidate
   */
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      console.log('🧊 Handling ICE candidate');
      
      if (this.peerConnection) {
        await this.peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('❌ Failed to handle ICE candidate:', error);
    }
  }

  /**
   * End the current call
   */
  endCall(): void {
    console.log('📴 Ending call');
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Update call state
    if (this.callState) {
      this.updateCallState({ 
        status: 'ended',
        endTime: new Date(),
        duration: this.callState.startTime ? 
          Math.floor((Date.now() - this.callState.startTime.getTime()) / 1000) : 0
      });
    }
    
    // Emit end call event
    this.emit('callEnded', this.callState);
    
    // Reset call state
    this.callState = null;
  }

  /**
   * Update call state
   */
  private updateCallState(updates: Partial<CallState>): void {
    if (this.callState) {
      this.callState = { ...this.callState, ...updates };
      this.emit('callStateChange', this.callState);
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  /**
   * Get current call state
   */
  getCallState(): CallState | null {
    return this.callState;
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Check if call is active
   */
  isCallActive(): boolean {
    return this.callState?.status === 'active';
  }

  /**
   * Check if call is ringing
   */
  isRinging(): boolean {
    return this.callState?.status === 'ringing';
  }

  /**
   * Check if call is connecting
   */
  isConnecting(): boolean {
    return this.callState?.status === 'connecting';
  }
}

// Export singleton instance
export const webrtcService = new WebRTCService();
export default webrtcService;
