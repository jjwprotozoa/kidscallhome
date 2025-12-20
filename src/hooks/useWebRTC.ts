/**
 * ============================================================================
 * KIDS CALL HOME - WebRTC Hook
 * ============================================================================
 * 
 * Purpose: Manages WebRTC peer connections for family calling
 * Interface: Shared across guardian and kids interfaces
 * Dependencies: simple-peer, zustand, types
 * 
 * V1 Features:
 * - Voice and video calling with simple-peer
 * - Automatic STUN server selection
 * - Quality adaptation based on network conditions
 * - Call state management and history
 * - Graceful error handling and fallbacks
 * 
 * V2 Ready:
 * - Multi-peer support for "Ring All" emergency calls
 * - End-to-end encryption key exchange
 * - Advanced quality metrics and reporting
 * - Screen sharing capabilities
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from 'react';
// import { webrtcService, type CallState as WebRTCCallState } from '../services/webrtcService';
import SimplePeer from 'simple-peer';
import { pusherService, type CallNotification, type SignalingData } from '../services/pusherService';
import { useAppStore } from '../stores/useAppStore';
import type { CallState, NetworkInfo, WebRTCConfig } from '../types';

interface UseWebRTCOptions {
  familyId: string;
  deviceId: string;
  onCallStateChange?: (call: CallState | null) => void;
  onNetworkQualityChange?: (network: NetworkInfo) => void;
}

interface UseWebRTCReturn {
  // Call management
  initiateCall: (targetId: string, type: 'voice' | 'video') => Promise<void>;
  answerCall: () => Promise<void>;
  endCall: () => void;
  
  // Call state
  callState: CallState | null;
  isCallActive: boolean;
  isRinging: boolean;
  isConnecting: boolean;
  hasIncomingCall: boolean;
  incomingCall: CallNotification | null;
  
  // Media controls
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerEnabled: boolean;
  
  // Quality and network
  networkQuality: NetworkInfo | null;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

/**
 * WebRTC peer configuration - optimized for family calling
 * 
 * Uses multiple STUN servers for reliability and includes configuration
 * for optimal performance across different network conditions.
 */
const peerConfig: WebRTCConfig = {
  iceServers: [
    // Primary STUN servers for NAT traversal
    { urls: 'stun:stun.l.google.com:19302' },
    // Backup STUN for reliability
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Additional STUN servers for better connectivity
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all',
};

export const useWebRTC = ({
  familyId,
  deviceId,
  onCallStateChange,
  onNetworkQualityChange,
}: UseWebRTCOptions): UseWebRTCReturn => {
  // State management
  const [callState, setCallState] = useState<CallState | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkQuality, setNetworkQuality] = useState<NetworkInfo | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallNotification | null>(null);
  
  // Refs for media streams and peer connection
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<any>(null);
  
  // Zustand store actions
  const { setActiveCall, addCallToHistory, setError: setAppError } = useAppStore();
  
  // Derived state
  const isCallActive = callState?.status === 'active';
  const isRinging = callState?.status === 'ringing';
  const isConnecting = callState?.status === 'connecting';
  const hasIncomingCall = incomingCall !== null;
  
  // Connection quality assessment
  const connectionQuality = useCallback((): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (!networkQuality) return 'fair';
    
    const { latency, packetLoss, signalStrength } = networkQuality;
    
    if (latency < 100 && packetLoss < 1 && signalStrength === 'excellent') return 'excellent';
    if (latency < 200 && packetLoss < 3 && signalStrength === 'good') return 'good';
    if (latency < 500 && packetLoss < 5) return 'fair';
    return 'poor';
  }, [networkQuality]);
  
  // Network quality monitoring
  const updateNetworkQuality = useCallback(async () => {
    try {
      // TODO: Implement real network quality detection
      // This would use WebRTC stats API and network information API
      const mockNetworkInfo: NetworkInfo = {
        connectionType: 'wifi',
        signalStrength: 'good',
        bandwidth: 'high',
        latency: 50,
        jitter: 10,
        packetLoss: 0.5,
        location: 'Home WiFi',
      };
      
      setNetworkQuality(mockNetworkInfo);
      onNetworkQualityChange?.(mockNetworkInfo);
    } catch (err) {
      console.warn('Failed to update network quality:', err);
    }
  }, [onNetworkQualityChange]);
  
  // Initialize local media stream
  const initializeLocalStream = useCallback(async (video: boolean = true) => {
    try {
      // Check if getUserMedia is available with better browser detection
      if (!navigator.mediaDevices) {
        // Fallback for older browsers
        const getUserMedia = (navigator as any).getUserMedia || 
                            (navigator as any).webkitGetUserMedia || 
                            (navigator as any).mozGetUserMedia || 
                            (navigator as any).msGetUserMedia;
        
        if (!getUserMedia) {
          throw new Error('getUserMedia is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.');
        }
        
        // Use legacy getUserMedia for older browsers
        return new Promise<MediaStream>((resolve, reject) => {
          const constraints = {
            audio: true,
            video: video ? {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 60 },
            } : false,
          };
          
          getUserMedia.call(navigator, constraints, resolve, reject);
        }).then((stream) => {
          localStreamRef.current = stream;
          return stream;
        });
      }

      // Modern browser with navigator.mediaDevices
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
      
      // Request permissions first
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        return stream;
      } catch (permissionError) {
        // If permission is denied, try with more basic constraints
        console.log('Permission denied, trying with basic constraints...');
        const basicConstraints: MediaStreamConstraints = {
          audio: true,
          video: video ? true : false,
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
        localStreamRef.current = stream;
        return stream;
      }
    } catch (err) {
      let errorMessage = 'Failed to access media devices';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Camera and microphone access denied. Please allow access and try again.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No camera or microphone found. Please check your device.';
        } else if (err.name === 'NotSupportedError') {
          errorMessage = 'Camera and microphone are not supported in this browser.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Camera or microphone is already in use by another application.';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'Camera or microphone settings are not supported.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      
      // For development/testing, create a mock stream if getUserMedia fails
      if (import.meta.env.DEV) {
        console.warn('getUserMedia failed, using mock stream for development');
        try {
          // Create a mock audio context for testing
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          
          // Create a mock stream (this won't have real audio/video but will prevent crashes)
          const mockStream = new MediaStream();
          localStreamRef.current = mockStream;
          return mockStream;
        } catch (mockError) {
          console.error('Failed to create mock stream:', mockError);
        }
      }
      
      throw new Error(errorMessage);
    }
  }, []);
  
  // Create WebRTC peer connection
  const createPeer = useCallback((initiator: boolean, stream?: MediaStream) => {
    const peer = new SimplePeer({
      initiator,
      trickle: false,
      stream,
      config: peerConfig,
    });
    
    // Handle peer connection events
    peer.on('signal', async (data: any) => {
      console.log('WebRTC signal:', data);
      
      // Send signaling data through appropriate service
      if (callState) {
        const targetId = callState.participants.guardian.id === deviceId 
          ? callState.participants.child.id 
          : callState.participants.guardian.id;
        
        // const isDevelopment = import.meta.env.DEV;
        const service = pusherService;
        
        if (data.type === 'offer') {
          await service.sendOffer(targetId, data);
        } else if (data.type === 'answer') {
          await service.sendAnswer(targetId, data);
        }
      }
    });
    
    peer.on('stream', (stream: any) => {
      remoteStreamRef.current = stream;
      console.log('Received remote stream');
    });
    
    peer.on('connect', () => {
      console.log('WebRTC peer connected');
      setCallState(prev => prev ? { ...prev, status: 'active' } : null);
    });
    
    peer.on('close', () => {
      console.log('WebRTC peer closed');
      endCall();
    });
    
    peer.on('error', (err: any) => {
      console.error('WebRTC peer error:', err);
      setError(err.message || 'WebRTC connection error');
    });
    
    return peer;
  }, [callState, deviceId]);
  
  // Initiate a call
  const initiateCall = useCallback(async (targetId: string, type: 'voice' | 'video') => {
    try {
      setError(null);
      
      // Initialize local media stream
      const stream = await initializeLocalStream(type === 'video');
      
      // Get current user and family from store
      const { currentUser, currentFamily } = useAppStore.getState();
      
      // Find target user in family
      const targetUser = currentFamily?.guardians.find(g => g.id === targetId) || 
                        currentFamily?.children.find(c => c.id === targetId);
      
      if (!targetUser) {
        throw new Error('Target user not found in family');
      }
      
      // Create new call state with proper participants
      const newCall: CallState = {
        id: `call_${Date.now()}`,
        type,
        participants: {
          guardian: currentUser && 'email' in currentUser ? currentUser as any : targetUser as any,
          child: currentUser && 'age' in currentUser ? currentUser as any : targetUser as any,
        },
        status: 'ringing',
        startTime: new Date(),
        quality: {
          audio: 'good',
          video: type === 'video' ? 'good' : undefined,
          connection: 'stable',
        },
        networkInfo: networkQuality || {
          connectionType: 'wifi',
          signalStrength: 'good',
          bandwidth: 'high',
          latency: 100,
          jitter: 20,
          packetLoss: 1,
        },
      };
      
      setCallState(newCall);
      setActiveCall(newCall);
      
      // Create peer connection
      const peer = createPeer(true, stream);
      peerRef.current = peer;
      
      // Start network quality monitoring
      updateNetworkQuality();
      
      // Send call request notification through appropriate service
      // const isDevelopment = import.meta.env.DEV;
      const service = pusherService;
      await service.sendCallRequest(targetId, type);
      
      // Note: Navigation should be handled by the calling component
      // The call page will be navigated to by the dashboard components
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate call';
      setError(errorMessage);
      setAppError(errorMessage);
    }
  }, [initializeLocalStream, createPeer, networkQuality, updateNetworkQuality, setActiveCall, setAppError, familyId]);
  
  // Answer an incoming call
  const answerCall = useCallback(async () => {
    try {
      if (!callState || !peerRef.current) return;
      
      setError(null);
      
      // Initialize local media stream
      const stream = await initializeLocalStream(callState.type === 'video');
      
      // Update call state
      setCallState(prev => prev ? { ...prev, status: 'connecting' } : null);
      
      // Create peer connection for answering
      const peer = createPeer(false, stream);
      peerRef.current = peer;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to answer call';
      setError(errorMessage);
      setAppError(errorMessage);
    }
  }, [callState, initializeLocalStream, createPeer, setAppError]);
  
  // End the current call
  const endCall = useCallback(() => {
    try {
      // Clean up peer connection
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      
      // Clean up media streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(track => track.stop());
        remoteStreamRef.current = null;
      }
      
      // Update call state
      if (callState) {
        const endedCall = {
          ...callState,
          status: 'ended' as const,
          endTime: new Date(),
          duration: callState.startTime ? 
            Math.floor((Date.now() - callState.startTime.getTime()) / 1000) : 0,
        };
        
        addCallToHistory(endedCall);
      }
      
      setCallState(null);
      setActiveCall(null);
      
    } catch (err) {
      console.error('Error ending call:', err);
    }
  }, [callState, addCallToHistory, setActiveCall]);
  
  // Media control functions
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);
  
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [isVideoEnabled]);
  
  const toggleSpeaker = useCallback(() => {
    // TODO: Implement speaker toggle
    setIsSpeakerEnabled(!isSpeakerEnabled);
  }, [isSpeakerEnabled]);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    setAppError(null);
  }, [setAppError]);
  
  // Set up Pusher event listeners (connection is handled in App.tsx)
  useEffect(() => {
    if (!familyId || !deviceId) return;
    
    const service = pusherService;
    console.log(`🔧 Setting up WebRTC event listeners`);
    
    // Set up event listeners (Pusher connection is handled in App.tsx)
    service.onIncomingCall((data: CallNotification) => {
      console.log('📞 Incoming call:', data);
      setIncomingCall(data);
    });
    
    service.onOffer(async (data: SignalingData) => {
      console.log('📡 Received offer:', data);
      if (peerRef.current && data.offer) {
        peerRef.current.signal(data.offer);
      }
    });
    
    service.onAnswer(async (data: SignalingData) => {
      console.log('📡 Received answer:', data);
      if (peerRef.current && data.answer) {
        peerRef.current.signal(data.answer);
      }
    });
    
    service.onIceCandidate(async (data: SignalingData) => {
      console.log('🧊 Received ICE candidate:', data);
      if (peerRef.current && data.candidate) {
        peerRef.current.signal(data.candidate);
      }
    });
    
    service.onCallAccepted((data: SignalingData) => {
      console.log('✅ Call accepted:', data);
      setIncomingCall(null);
    });
    
    service.onCallRejected((data: SignalingData) => {
      console.log('❌ Call rejected:', data);
      setIncomingCall(null);
      endCall();
    });
    
    service.onEndCall((data: SignalingData) => {
      console.log('📴 Call ended:', data);
      endCall();
    });
  }, [familyId, deviceId, endCall]);
  
  // Update call state in store when it changes
  useEffect(() => {
    setActiveCall(callState);
    onCallStateChange?.(callState);
  }, [callState, setActiveCall, onCallStateChange]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);
  
  return {
    // Call management
    initiateCall,
    answerCall,
    endCall,
    
    // Call state
    callState,
    isCallActive,
    isRinging,
    isConnecting,
    hasIncomingCall,
    incomingCall,
    
    // Media controls
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    isMuted,
    isVideoEnabled,
    isSpeakerEnabled,
    
    // Quality and network
    networkQuality,
    connectionQuality: connectionQuality(),
    
    // Error handling
    error,
    clearError,
  };
};
