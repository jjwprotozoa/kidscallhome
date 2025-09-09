/**
 * ============================================================================
 * KIDS CALL HOME - Guardian Dashboard
 * ============================================================================
 * 
 * Purpose: Professional dashboard for guardians to manage and call children
 * Interface: Guardian - professional blue/purple theme with technical details
 * Dependencies: React, zustand, useWebRTC, tailwindcss
 * 
 * V1 Features:
 * - Child cards with status and calling controls
 * - Voice and video calling buttons
 * - "Ring All" emergency functionality
 * - Family settings and message center
 * - Professional glassmorphism design
 * 
 * V2 Ready:
 * - Advanced child management
 * - Call history and analytics
 * - Multi-device support
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import {
    ChatBubbleLeftRightIcon,
    ClockIcon,
    Cog6ToothIcon,
    ExclamationTriangleIcon,
    PhoneIcon,
    VideoCameraIcon,
    WifiIcon
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
 * GuardianDashboard - Professional interface for guardians
 * 
 * Provides comprehensive child management with calling controls, status
 * monitoring, and family settings in a professional glassmorphism design.
 */
const GuardianDashboard: React.FC = () => {
  const navigate = useNavigate();
  const family = useFamily();
  const currentUser = useCurrentUser();
  const { setTheme, setIncomingCall } = useAppStore();
  
  const [isRingAllActive, setIsRingAllActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPermissionHelper, setShowPermissionHelper] = useState(false);
  const [showDevelopmentHelper, setShowDevelopmentHelper] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
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
  
  // Mock network quality for now
  const connectionQuality = 'good';
  
  // Set guardian theme
  React.useEffect(() => {
    setTheme('guardian');
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
  const handleVoiceCall = async (childId: string) => {
    if (!(await checkBrowserCompatibility())) return;
    
    try {
      await initiateCall(childId, 'voice');
      // Navigate to voice call page
      navigate(`/call/voice/${family?.id}`);
    } catch (error) {
      console.error('Failed to initiate voice call:', error);
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unable to start voice call. Please check your microphone permissions and try again.';
      alert(errorMessage);
    }
  };
  
  // Handle video call
  const handleVideoCall = async (childId: string) => {
    if (!(await checkBrowserCompatibility())) return;
    
    try {
      await initiateCall(childId, 'video');
      // Navigate to video call page
      navigate(`/call/video/${family?.id}`);
    } catch (error) {
      console.error('Failed to initiate video call:', error);
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unable to start video call. Please check your camera and microphone permissions and try again.';
      alert(errorMessage);
    }
  };
  
  // Handle ring all emergency
  const handleRingAll = async () => {
    if (!family?.children) return;
    
    setIsRingAllActive(true);
    
    // Ring all online children
    const onlineChildren = family.children.filter(child => child.isOnline);
    
    for (const child of onlineChildren) {
      try {
        await initiateCall(child.id, 'voice');
        // Small delay between calls
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to ring ${child.name}:`, error);
      }
    }
    
    setTimeout(() => setIsRingAllActive(false), 10000); // Stop after 10 seconds
  };

  // Handle copy family code
  const handleCopyFamilyCode = async () => {
    try {
      await navigator.clipboard.writeText(family?.code || '');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy family code:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = family?.code || '';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };
  
  // Handle settings
  const handleSettings = () => {
    setShowSettings(!showSettings);
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

  // Handle messages
  const handleMessages = (_childId: string) => {
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
    <div className="min-h-screen p-4" style={{ background: 'var(--theme-background)' }}>
      {/* Header */}
      <header className="container-responsive py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-title1 font-bold text-theme">
              {family.name}
            </h1>
            <p className="text-body text-theme-secondary">
              Welcome back, {currentUser.name}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Network Status */}
            <div className="card-surface p-3">
              <div className="flex items-center space-x-2">
                <WifiIcon className="w-5 h-5 text-theme-primary" />
                <span className="text-footnote font-medium text-theme">
                  {connectionQuality}
                </span>
              </div>
            </div>
            
            {/* Settings */}
            <button
              onClick={handleSettings}
              className="card-surface p-3 transition-apple hover:bg-theme-surface-secondary"
            >
              <Cog6ToothIcon className="w-6 h-6 text-theme" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Emergency Ring All */}
      <section className="container-responsive mb-8">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRingAll}
          disabled={isRingAllActive || isCallActive}
          className="w-full p-6 rounded-2xl text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: 'var(--theme-text)'
          }}
        >
          <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-white mb-2 text-shadow">
            {isRingAllActive ? 'Ringing All Children...' : 'Ring All Children'}
          </h2>
          <p className="text-white text-opacity-75 text-shadow">
            Emergency call to all online children
          </p>
        </motion.button>
      </section>
      
      {/* Children Grid */}
      <section className="container-responsive">
        <h2 className="text-2xl font-bold text-white mb-6 text-shadow">
          Your Children
        </h2>
        
        {family.children.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👶</div>
            <h3 className="text-xl font-semibold text-white mb-2 text-shadow">
              No children added yet
            </h3>
            <p className="text-white text-opacity-75 text-shadow">
              Add children to your family to start calling them.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {family.children.map((child) => (
              <motion.div
                key={child.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="card hover:scale-105 transition-transform duration-200"
              >
                {/* Child Header */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-2xl">
                    {child.avatar || '👶'}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">
                      {child.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        child.isOnline ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <span className="text-sm text-gray-600">
                        {child.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Last Seen */}
                <div className="mb-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <ClockIcon className="w-4 h-4" />
                    <span>
                      Last seen: {new Date(child.lastSeen).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                
                {/* Call Buttons */}
                <div className="space-y-3">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleVoiceCall(child.id)}
                      disabled={!child.isOnline || isCallActive}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <PhoneIcon className="w-5 h-5" />
                      <span>Call</span>
                    </button>
                    
                    <button
                      onClick={() => handleVideoCall(child.id)}
                      disabled={!child.isOnline || isCallActive}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <VideoCameraIcon className="w-5 h-5" />
                      <span>Video</span>
                    </button>
                  </div>
                  
                  <button
                    onClick={() => handleMessages(child.id)}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-all"
                    style={{
                      background: 'var(--theme-glass)',
                      backdropFilter: 'blur(var(--glass-blur))',
                      WebkitBackdropFilter: 'blur(var(--glass-blur))',
                      border: '1px solid var(--theme-border)',
                      color: '#374151'
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
                    <ChatBubbleLeftRightIcon className="w-5 h-5" />
                    <span>Message</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
      
      {/* Settings Panel */}
      {showSettings && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="p-8 rounded-2xl max-w-md w-full"
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'var(--theme-text)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-white mb-6 text-shadow">
              Family Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white font-semibold mb-2">
                  Family Code
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={family.code}
                    readOnly
                    className="flex-1 px-4 py-3 bg-white bg-opacity-20 text-white rounded-lg font-mono"
                  />
                  <button 
                    onClick={handleCopyFamilyCode}
                    className={`px-4 py-3 rounded-lg transition-colors ${
                      copySuccess 
                        ? 'bg-green-500 text-white' 
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-white font-semibold mb-2">
                  Family Name
                </label>
                <input
                  type="text"
                  value={family.name}
                  className="w-full px-4 py-3 bg-white bg-opacity-20 text-white rounded-lg"
                />
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button className="flex-1 px-4 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100">
                  Save Changes
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 px-4 py-3 text-white rounded-lg transition-all"
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
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Call Status Overlay */}
      {(isCallActive || isRinging || isConnecting) && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-6xl mb-4">📞</div>
            <h2 className="text-3xl font-bold text-white mb-4 text-shadow">
              {isRinging && 'Ringing...'}
              {isConnecting && 'Connecting...'}
              {isCallActive && 'Call Active'}
            </h2>
            <button
              onClick={endCall}
              className="px-8 py-4 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xl font-semibold"
            >
              End Call
            </button>
          </div>
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
            className="text-center p-8 rounded-2xl max-w-md w-full"
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
              className="text-6xl mb-6"
            >
              📞
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-4 text-shadow">
              Incoming Call
            </h2>
            <p className="text-lg text-white text-opacity-75 mb-8 text-shadow">
              {incomingCall?.callType === 'video' ? 'Video Call' : 'Voice Call'}
            </p>
            <div className="flex space-x-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAnswerCall}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold"
              >
                Answer
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRejectCall}
                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold"
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

export default GuardianDashboard;
