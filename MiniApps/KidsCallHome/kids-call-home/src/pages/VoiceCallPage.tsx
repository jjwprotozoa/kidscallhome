/**
 * ============================================================================
 * KIDS CALL HOME - Voice Call Page
 * ============================================================================
 * 
 * Purpose: Voice calling interface for both guardian and kids interfaces
 * Interface: Shared - adapts styling based on user type
 * Dependencies: React, useWebRTC, zustand, tailwindcss
 * 
 * V1 Features:
 * - Voice call controls (mute, speaker, hang up)
 * - Call status and timer display
 * - Different UI for guardian vs kids interfaces
 * - Network quality indicators
 * 
 * V2 Ready:
 * - Call recording capabilities
 * - Advanced audio controls
 * - Multi-party calling
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import {
    MicrophoneIcon,
    PhoneIcon,
    SignalIcon,
    SpeakerWaveIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import { useTheme, useUserType } from '../stores/useAppStore';

/**
 * VoiceCallPage - Voice calling interface
 * 
 * Provides voice calling controls with different styling for guardian
 * (professional) and kids (playful) interfaces.
 */
const VoiceCallPage: React.FC = () => {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const userType = useUserType();
  const theme = useTheme();
  
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  
  // WebRTC hook
  const {
    initiateCall: _initiateCall,
    endCall,
    isCallActive,
    isRinging,
    isConnecting,
    toggleMute,
    toggleSpeaker,
    networkQuality,
    connectionQuality,
  } = useWebRTC({
    familyId: familyId || '',
    deviceId: 'current-device', // TODO: Get from store
  });
  
  // Call timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCallActive]);
  
  // Format call duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle mute toggle
  const handleMuteToggle = () => {
    toggleMute();
    setIsMuted(!isMuted);
  };
  
  // Handle speaker toggle
  const handleSpeakerToggle = () => {
    toggleSpeaker();
    setIsSpeakerOn(!isSpeakerOn);
  };
  
  // Handle end call
  const handleEndCall = () => {
    endCall();
    navigate(-1); // Go back to previous page
  };
  
  const isKidsInterface = userType === 'child' || theme === 'kids';
  
  if (isKidsInterface) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md w-full"
        >
          {/* Call Status */}
          <div className="mb-8">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="text-8xl mb-4"
            >
              📞
            </motion.div>
            
            <h1 className="text-4xl font-bold text-white mb-2 text-shadow-lg">
              {isRinging && 'Ringing...'}
              {isConnecting && 'Connecting...'}
              {isCallActive && 'Talking to Parent!'}
            </h1>
            
            {isCallActive && (
              <p className="text-2xl text-white text-opacity-75 text-shadow">
                {formatDuration(callDuration)}
              </p>
            )}
          </div>
          
          {/* Call Controls */}
          <div className="space-y-6">
            <div className="flex justify-center space-x-8">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleMuteToggle}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl ${
                  isMuted ? 'bg-red-500' : 'bg-white bg-opacity-30'
                } text-white`}
              >
                {isMuted ? '🔇' : '🎤'}
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleSpeakerToggle}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl ${
                  isSpeakerOn ? 'bg-blue-500' : 'bg-white bg-opacity-30'
                } text-white`}
              >
                {isSpeakerOn ? '🔊' : '🔈'}
              </motion.button>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEndCall}
              className="w-32 h-32 bg-red-500 rounded-full flex items-center justify-center text-white text-4xl hover:bg-red-600"
            >
              📞
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }
  
  // Guardian interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-8 rounded-2xl max-w-md w-full"
        style={{
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}
      >
        {/* Call Status */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <PhoneIcon className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2 text-shadow">
            {isRinging && 'Ringing...'}
            {isConnecting && 'Connecting...'}
            {isCallActive && 'Call Active'}
          </h1>
          
          {isCallActive && (
            <p className="text-lg text-white text-opacity-75 text-shadow">
              {formatDuration(callDuration)}
            </p>
          )}
          
          {/* Network Quality */}
          <div className="flex items-center justify-center space-x-2 mt-4">
            <SignalIcon className="w-5 h-5 text-white" />
            <span className="text-white text-sm">
              {connectionQuality}
            </span>
          </div>
        </div>
        
        {/* Call Controls */}
        <div className="space-y-4">
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleMuteToggle}
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isMuted ? 'bg-red-500' : ''
              } text-white transition-all`}
              style={!isMuted ? {
                background: 'var(--theme-glass)',
                backdropFilter: 'blur(var(--glass-blur))',
                WebkitBackdropFilter: 'blur(var(--glass-blur))',
                border: '1px solid var(--theme-border)'
              } : {}}
              onMouseEnter={!isMuted ? (e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.backdropFilter = 'blur(20px)';
                (e.currentTarget.style as any).WebkitBackdropFilter = 'blur(20px)';
                e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.3)';
              } : undefined}
              onMouseLeave={!isMuted ? (e) => {
                e.currentTarget.style.background = 'var(--theme-glass)';
                e.currentTarget.style.backdropFilter = 'blur(var(--glass-blur))';
                (e.currentTarget.style as any).WebkitBackdropFilter = 'blur(var(--glass-blur))';
                e.currentTarget.style.border = '1px solid var(--theme-border)';
              } : undefined}
            >
              <MicrophoneIcon className="w-6 h-6" />
            </button>
            
            <button
              onClick={handleSpeakerToggle}
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isSpeakerOn ? 'bg-blue-500' : 'glass'
              } text-white hover:glass-strong transition-all`}
            >
              <SpeakerWaveIcon className="w-6 h-6" />
            </button>
          </div>
          
          <button
            onClick={handleEndCall}
            className="w-full py-4 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold text-lg"
          >
            End Call
          </button>
        </div>
        
        {/* Technical Details (Guardian only) */}
        {networkQuality && (
          <div className="mt-6 p-4 bg-black bg-opacity-20 rounded-lg">
            <h3 className="text-white font-semibold mb-2">Connection Details</h3>
            <div className="text-sm text-white text-opacity-75 space-y-1">
              <p>Latency: {networkQuality.latency}ms</p>
              <p>Signal: {networkQuality.signalStrength}</p>
              <p>Type: {networkQuality.connectionType}</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default VoiceCallPage;
