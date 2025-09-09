/**
 * ============================================================================
 * KIDS CALL HOME - Kids Dashboard
 * ============================================================================
 * 
 * Purpose: Playful dashboard for children to call their parents
 * Interface: Kids - warm orange/pink theme with large, friendly design
 * Dependencies: React, zustand, useWebRTC, tailwindcss, framer-motion
 * 
 * V1 Features:
 * - Large parent cards with calling buttons
 * - Simple, kid-friendly language
 * - Emergency button with 2-step activation
 * - Playful animations and decorations
 * - Extra-large touch targets
 * 
 * V2 Ready:
 * - Customizable themes and avatars
 * - Voice commands
 * - Educational games
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import {
    ExclamationTriangleIcon,
    HeartIcon,
    PhoneIcon,
    SparklesIcon,
    VideoCameraIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DevelopmentHelper from '../components/shared/DevelopmentHelper';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import PermissionHelper from '../components/shared/PermissionHelper';
import { useSimpleWebRTC } from '../hooks/useSimpleWebRTC';
import { useAppStore, useCurrentUser, useFamily } from '../stores/useAppStore';

/**
 * KidsDashboard - Playful interface for children
 * 
 * Provides simple, colorful interface with large buttons and kid-friendly
 * language for calling parents and guardians with safety-focused design.
 */
const KidsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const family = useFamily();
  const currentUser = useCurrentUser();
  const { setTheme, setIncomingCall } = useAppStore();
  
  const [emergencyStep, setEmergencyStep] = useState(0);
  const [showLove, setShowLove] = useState(false);
  const [showPermissionHelper, setShowPermissionHelper] = useState(false);
  const [showDevelopmentHelper, setShowDevelopmentHelper] = useState(false);
  
  // WebRTC hook for calling functionality
  const {
    initiateCall,
    answerCall,
    endCall,
    isCallActive,
    isRinging,
    isConnecting,
    hasIncomingCall,
    incomingCall,
  } = useSimpleWebRTC({
    familyId: family?.id || '',
    deviceId: currentUser?.deviceId || '',
  });
  
  // Set kids theme
  React.useEffect(() => {
    setTheme('kids');
  }, [setTheme]);
  
  // Check browser compatibility and request permissions
  const checkBrowserCompatibility = async () => {
    console.log('Checking browser compatibility...');
    console.log('Secure context:', window.isSecureContext);
    console.log('Hostname:', window.location.hostname);
    console.log('User agent:', navigator.userAgent);
    
    // Check if we're in a secure context (HTTPS or localhost)
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
      setShowDevelopmentHelper(true);
      return false;
    }

    // Check for basic getUserMedia support
    const hasGetUserMedia = !!(navigator.mediaDevices?.getUserMedia || 
                              (navigator as any).getUserMedia || 
                              (navigator as any).webkitGetUserMedia || 
                              (navigator as any).mozGetUserMedia || 
                              (navigator as any).msGetUserMedia);
    
    console.log('getUserMedia support:', hasGetUserMedia);
    console.log('navigator.mediaDevices:', !!navigator.mediaDevices);
    console.log('navigator.getUserMedia:', !!(navigator as any).getUserMedia);
    
    if (!hasGetUserMedia) {
      alert('Your browser doesn\'t support video calling. Please use Chrome, Firefox, Safari, or Edge to make calls.');
      return false;
    }

    // Try to request permissions first
    try {
      if (navigator.permissions) {
        console.log('Checking permissions...');
        const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        
        console.log('Microphone permission:', micPermission.state);
        console.log('Camera permission:', cameraPermission.state);
        
        if (micPermission.state === 'denied' || cameraPermission.state === 'denied') {
          setShowPermissionHelper(true);
          return false;
        }
      } else {
        console.log('Permissions API not available');
      }
    } catch (error) {
      // Permissions API not supported, continue anyway
      console.log('Permissions API not supported, continuing...', error);
    }

    console.log('Browser compatibility check passed');
    return true;
  };

  // Handle voice call
  const handleVoiceCall = async (guardianId: string) => {
    if (!(await checkBrowserCompatibility())) return;
    
    try {
      await initiateCall(guardianId, 'voice');
      // Navigate to voice call page
      navigate(`/call/voice/${family?.id}`);
    } catch (error) {
      console.error('Failed to call parent:', error);
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Sorry, I couldn\'t start the call. Please check that your microphone is working and try again.';
      alert(errorMessage);
    }
  };
  
  // Handle video call
  const handleVideoCall = async (guardianId: string) => {
    if (!(await checkBrowserCompatibility())) return;
    
    try {
      await initiateCall(guardianId, 'video');
      // Navigate to video call page
      navigate(`/call/video/${family?.id}`);
    } catch (error) {
      console.error('Failed to video call parent:', error);
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Sorry, I couldn\'t start the video call. Please check that your camera and microphone are working and try again.';
      alert(errorMessage);
    }
  };
  
  // Handle emergency call
  const handleEmergency = () => {
    console.log('Emergency button clicked, current step:', emergencyStep);
    if (emergencyStep === 0) {
      setEmergencyStep(1);
      // Reset after 3 seconds if not confirmed
      setTimeout(() => setEmergencyStep(0), 3000);
    } else if (emergencyStep === 1) {
      // Temporarily disabled automatic calling for debugging
      console.log('Emergency call would be triggered here - currently disabled for debugging');
      // TODO: Re-enable after fixing the automatic trigger issue
      // if (family?.guardians) {
      //   family.guardians.forEach(guardian => {
      //     handleVoiceCall(guardian.id);
      //   });
      // }
      setEmergencyStep(0);
    }
  };
  
  // Handle incoming call
  const handleAnswerCall = async () => {
    try {
      await answerCall();
      // Navigate to call page
      navigate(`/call/${incomingCall?.callType}/${family?.id}`);
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  };

  const handleRejectCall = () => {
    // TODO: Send rejection through Pusher
    setIncomingCall(null);
  };

  // Handle send love
  const handleSendLove = () => {
    setShowLove(true);
    setTimeout(() => setShowLove(false), 2000);
  };
  
  // Handle messages
  const handleMessages = () => {
    navigate(`/messages/${family?.id}`);
  };
  
  if (!family || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--theme-background)' }}>
        <LoadingSpinner size="large" text="Loading your family..." />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: 'var(--theme-background)' }}>
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{ 
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-20 -right-20 w-40 h-40 bg-white bg-opacity-10 rounded-full"
        />
        <motion.div
          animate={{ 
            rotate: -360,
            scale: [1, 0.9, 1],
          }}
          transition={{ 
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -bottom-20 -left-20 w-32 h-32 bg-white bg-opacity-10 rounded-full"
        />
        <motion.div
          animate={{ 
            y: [0, -20, 0],
            x: [0, 10, 0],
          }}
          transition={{ 
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/4 left-1/4 w-8 h-8 bg-white bg-opacity-20 rounded-full"
        />
        <motion.div
          animate={{ 
            y: [0, 15, 0],
            x: [0, -10, 0],
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-3/4 right-1/4 w-6 h-6 bg-white bg-opacity-20 rounded-full"
        />
      </div>
      
      {/* Main Content Container */}
      <div className="flex-1 flex flex-col justify-center px-4 py-8">
        {/* Header */}
        <header className="relative z-10 text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-theme mb-4">
              Hi {currentUser.name}! 👋
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-theme-secondary">
              Who would you like to call today?
            </p>
          </motion.div>
        </header>
        
        {/* Parents Grid */}
        <section className="relative z-10 flex-1 flex items-center justify-center">
          <div className="w-full max-w-6xl mx-auto">
            {family.guardians.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl sm:text-7xl md:text-8xl mb-6">👨‍👩‍👧‍👦</div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4 text-shadow">
                  No parents in your family yet
                </h3>
                <p className="text-lg sm:text-xl text-white text-opacity-75 text-shadow">
                  Ask your parents to join your family! Only family members can call each other.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 justify-items-center">
                {family.guardians.map((guardian, index) => (
                  <motion.div
                    key={guardian.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="w-full max-w-sm card-kids hover:scale-105 transition-transform duration-300"
                  >
                    {/* Parent Avatar and Name */}
                    <div className="text-center mb-6">
                      <motion.div
                        animate={{ 
                          scale: [1, 1.05, 1],
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        className="text-6xl sm:text-7xl md:text-8xl mb-4"
                      >
                        {guardian.avatar || '👨‍💼'}
                      </motion.div>
                      <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 text-shadow">
                        {guardian.name}
                      </h3>
                      <div className="flex items-center justify-center space-x-3 mb-2">
                        <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${
                          guardian.isOnline ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-gray-400'
                        }`} />
                        <span className={`text-sm sm:text-base font-medium text-shadow ${
                          guardian.isOnline ? 'text-green-300' : 'text-gray-300'
                        }`}>
                          {guardian.isOnline ? 'Available' : 'Not available'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Call Buttons */}
                    <div className="space-y-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleVoiceCall(guardian.id)}
                        disabled={!guardian.isOnline || isCallActive}
                        className="w-full btn-kids bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      >
                        <PhoneIcon className="w-6 h-6 sm:w-8 sm:h-8 inline-block mr-3" />
                        <span className="text-lg sm:text-xl font-bold">Call {guardian.name}</span>
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleVideoCall(guardian.id)}
                        disabled={!guardian.isOnline || isCallActive}
                        className="w-full btn-kids bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      >
                        <VideoCameraIcon className="w-6 h-6 sm:w-8 sm:h-8 inline-block mr-3" />
                        <span className="text-lg sm:text-xl font-bold">Video {guardian.name}</span>
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      
      {/* Action Buttons */}
      <section className="relative z-10 px-4 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {/* Send Love Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSendLove}
            className="card-kids text-center py-4 sm:py-6"
          >
            <HeartIcon className="w-8 h-8 sm:w-12 sm:h-12 text-pink-400 mx-auto mb-2 sm:mb-3" />
            <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2 text-shadow">
              Send Love
            </h3>
            <p className="text-sm sm:text-base text-white text-opacity-75 text-shadow">
              Send a love message
            </p>
          </motion.button>
          
          {/* Messages Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleMessages}
            className="card-kids text-center py-4 sm:py-6"
          >
            <SparklesIcon className="w-8 h-8 sm:w-12 sm:h-12 text-purple-400 mx-auto mb-2 sm:mb-3" />
            <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2 text-shadow">
              Messages
            </h3>
            <p className="text-sm sm:text-base text-white text-opacity-75 text-shadow">
              Chat with family
            </p>
          </motion.button>
          
          {/* Emergency Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleEmergency}
            className={`card-kids text-center py-4 sm:py-6 ${
              emergencyStep === 1 ? 'bg-red-500' : 'bg-red-400'
            }`}
          >
            <ExclamationTriangleIcon className="w-8 h-8 sm:w-12 sm:h-12 text-white mx-auto mb-2 sm:mb-3" />
            <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2 text-shadow">
              {emergencyStep === 0 ? 'Emergency' : 'Calling All Parents!'}
            </h3>
            <p className="text-xs sm:text-base text-white text-opacity-75 text-shadow">
              {emergencyStep === 0 ? 'Tap twice to call all parents' : 'Tap again to confirm'}
            </p>
          </motion.button>
        </div>
      </section>
      
      {/* Love Animation */}
      {showLove && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        >
          <div className="text-8xl">💕</div>
        </motion.div>
      )}
      
      {/* Call Status Overlay */}
      {(isCallActive || isRinging || isConnecting) && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{ 
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="text-8xl mb-6"
            >
              📞
            </motion.div>
            <h2 className="text-4xl font-bold text-white mb-6 text-shadow">
              {isRinging && 'Ringing...'}
              {isConnecting && 'Connecting...'}
              {isCallActive && 'Talking to Parent!'}
            </h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={endCall}
              className="btn-kids bg-red-500 text-white hover:bg-red-600"
            >
              Hang Up
            </motion.button>
          </motion.div>
        </div>
      )}

      {/* Permission Helper Modal */}
      {showPermissionHelper && (
        <PermissionHelper
          onClose={() => setShowPermissionHelper(false)}
          onRetry={() => {
            setShowPermissionHelper(false);
            // Retry the last action
            window.location.reload();
          }}
        />
      )}

      {/* Incoming Call Overlay */}
      {hasIncomingCall && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center p-8 rounded-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{ 
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="text-8xl mb-6"
            >
              📞
            </motion.div>
            <h2 className="text-4xl font-bold text-white mb-4 text-shadow">
              Incoming Call!
            </h2>
            <p className="text-xl text-white text-opacity-75 mb-8 text-shadow">
              {incomingCall?.callType === 'video' ? 'Video Call' : 'Voice Call'}
            </p>
            <div className="flex space-x-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAnswerCall}
                className="btn-kids bg-green-500 text-white hover:bg-green-600 px-8 py-4"
              >
                Answer
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRejectCall}
                className="btn-kids bg-red-500 text-white hover:bg-red-600 px-8 py-4"
              >
                Decline
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Development Helper Modal */}
      {showDevelopmentHelper && (
        <DevelopmentHelper />
      )}
    </div>
  );
};

export default KidsDashboard;
