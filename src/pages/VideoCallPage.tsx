/**
 * ============================================================================
 * KIDS CALL HOME - Video Call Page
 * ============================================================================
 * 
 * Purpose: Video calling interface for both guardian and kids interfaces
 * Interface: Shared - adapts styling based on user type
 * Dependencies: React, useWebRTC, zustand, tailwindcss
 * 
 * V1 Features:
 * - Video call with picture-in-picture
 * - Video controls (mute, camera, hang up)
 * - Different layouts for guardian vs kids interfaces
 * - Network quality indicators
 * 
 * V2 Ready:
 * - Screen sharing capabilities
 * - Multi-party video calls
 * - Advanced video controls
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import {
    ArrowsPointingOutIcon,
    MicrophoneIcon,
    SignalIcon,
    SpeakerWaveIcon,
    VideoCameraIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import { useTheme, useUserType } from '../stores/useAppStore';

/**
 * VideoCallPage - Video calling interface
 * 
 * Provides video calling with different layouts for guardian (child's video
 * as main) and kids (parent's video as main) interfaces.
 */
const VideoCallPage: React.FC = () => {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const userType = useUserType();
  const theme = useTheme();
  
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  // WebRTC hook
  const {
    initiateCall: _initiateCall,
    endCall,
    isCallActive,
    isRinging,
    isConnecting,
    toggleMute,
    toggleVideo,
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
  
  // Handle video toggle
  const handleVideoToggle = () => {
    toggleVideo();
    setIsVideoOn(!isVideoOn);
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
  
  // Handle minimize
  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };
  
  const isKidsInterface = userType === 'child' || theme === 'kids';
  
  if (isKidsInterface) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-4xl"
        >
          {/* Video Container */}
          <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl mb-6">
            {/* Remote Video (Parent) - Main for kids */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full aspect-video object-cover"
            />
            
            {/* Local Video (Self) - Picture in Picture for kids */}
            <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-1 text-xs text-white bg-black bg-opacity-50 px-1 rounded">
                That's You!
              </div>
            </div>
            
            {/* Call Status Overlay */}
            {!isCallActive && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="text-center">
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
                    className="text-6xl mb-4"
                  >
                    📹
                  </motion.div>
                  <h2 className="text-3xl font-bold text-white mb-2 text-shadow">
                    {isRinging && 'Ringing...'}
                    {isConnecting && 'Connecting...'}
                  </h2>
                </div>
              </div>
            )}
            
            {/* Call Duration */}
            {isCallActive && (
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg">
                {formatDuration(callDuration)}
              </div>
            )}
          </div>
          
          {/* Call Controls */}
          <div className="flex justify-center space-x-6">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleMuteToggle}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${
                isMuted ? 'bg-red-500' : 'bg-white bg-opacity-30'
              } text-white`}
            >
              {isMuted ? '🔇' : '🎤'}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleVideoToggle}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${
                isVideoOn ? 'bg-blue-500' : 'bg-white bg-opacity-30'
              } text-white`}
            >
              {isVideoOn ? '📹' : '📷'}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSpeakerToggle}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${
                isSpeakerOn ? 'bg-green-500' : 'bg-white bg-opacity-30'
              } text-white`}
            >
              {isSpeakerOn ? '🔊' : '🔈'}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleEndCall}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-2xl text-white hover:bg-red-600"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="container-responsive">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white text-shadow">
            Video Call
          </h1>
          <button
            onClick={handleMinimize}
            className="p-2 rounded-lg transition-all"
            style={{
              background: 'var(--theme-glass)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--theme-border)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.backdropFilter = 'blur(20px)';
              (e.currentTarget.style as any).WebkitBackdropFilter = 'blur(20px)';
              e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--theme-glass)';
              e.currentTarget.style.backdropFilter = 'blur(var(--glass-blur))';
              (e.currentTarget.style as any).WebkitBackdropFilter = 'blur(var(--glass-blur))';
              e.currentTarget.style.border = '1px solid var(--theme-border)';
            }}
          >
            <ArrowsPointingOutIcon className="w-6 h-6 text-white" />
          </button>
        </div>
        
        {/* Video Container */}
        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl mb-6">
          {/* Remote Video (Child) - Main for guardian */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full aspect-video object-cover"
          />
          
          {/* Local Video (Self) - Picture in Picture for guardian */}
          <div className="absolute top-4 right-4 w-40 h-30 bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Call Status Overlay */}
          {!isCallActive && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="text-center">
                <VideoCameraIcon className="w-16 h-16 text-white mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2 text-shadow">
                  {isRinging && 'Ringing...'}
                  {isConnecting && 'Connecting...'}
                </h2>
              </div>
            </div>
          )}
          
          {/* Call Duration and Quality */}
          <div className="absolute top-4 left-4 flex items-center space-x-4">
            <div className="bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg">
              {formatDuration(callDuration)}
            </div>
            <div className="flex items-center space-x-1 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg">
              <SignalIcon className="w-4 h-4" />
              <span className="text-sm">{connectionQuality}</span>
            </div>
          </div>
        </div>
        
        {/* Call Controls */}
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
            onClick={handleVideoToggle}
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isVideoOn ? 'bg-blue-500' : ''
            } text-white transition-all`}
            style={!isVideoOn ? {
              background: 'var(--theme-glass)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--theme-border)'
            } : {}}
            onMouseEnter={!isVideoOn ? (e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.backdropFilter = 'blur(20px)';
              (e.currentTarget.style as any).WebkitBackdropFilter = 'blur(20px)';
              e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            } : undefined}
            onMouseLeave={!isVideoOn ? (e) => {
              e.currentTarget.style.background = 'var(--theme-glass)';
              e.currentTarget.style.backdropFilter = 'blur(var(--glass-blur))';
              (e.currentTarget.style as any).WebkitBackdropFilter = 'blur(var(--glass-blur))';
              e.currentTarget.style.border = '1px solid var(--theme-border)';
            } : undefined}
          >
            <VideoCameraIcon className="w-6 h-6" />
          </button>
          
          <button
            onClick={handleSpeakerToggle}
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isSpeakerOn ? 'bg-green-500' : ''
            } text-white transition-all`}
            style={!isSpeakerOn ? {
              background: 'var(--theme-glass)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--theme-border)'
            } : {}}
            onMouseEnter={!isSpeakerOn ? (e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.backdropFilter = 'blur(20px)';
              (e.currentTarget.style as any).WebkitBackdropFilter = 'blur(20px)';
              e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            } : undefined}
            onMouseLeave={!isSpeakerOn ? (e) => {
              e.currentTarget.style.background = 'var(--theme-glass)';
              e.currentTarget.style.backdropFilter = 'blur(var(--glass-blur))';
              (e.currentTarget.style as any).WebkitBackdropFilter = 'blur(var(--glass-blur))';
              e.currentTarget.style.border = '1px solid var(--theme-border)';
            } : undefined}
          >
            <SpeakerWaveIcon className="w-6 h-6" />
          </button>
          
          <button
            onClick={handleEndCall}
            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        {/* Technical Details (Guardian only) */}
        {networkQuality && (
          <div 
            className="mt-6 p-4 rounded-lg"
            style={{
              background: 'var(--theme-glass)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--theme-border)'
            }}
          >
            <h3 className="text-white font-semibold mb-2">Connection Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-white text-opacity-75">
              <div>
                <p>Latency: {networkQuality.latency}ms</p>
                <p>Signal: {networkQuality.signalStrength}</p>
              </div>
              <div>
                <p>Type: {networkQuality.connectionType}</p>
                <p>Bandwidth: {networkQuality.bandwidth}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCallPage;
