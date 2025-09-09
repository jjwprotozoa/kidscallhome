/**
 * ============================================================================
 * KIDS CALL HOME - Incoming Call Page
 * ============================================================================
 * 
 * Purpose: Shows incoming call interface when someone is calling
 * Interface: Both guardian and kids interfaces supported
 * Dependencies: React, React Router, Zustand, WebRTC hook
 * 
 * V1 Features:
 * - Incoming call notification with caller info
 * - Answer/decline call buttons
 * - Call type indication (voice/video)
 * - Animated call interface
 * 
 * V2 Ready:
 * - Call preview with video
 * - Multiple incoming calls handling
 * - Call history integration
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import {
    CheckIcon,
    MicrophoneIcon,
    PhoneIcon,
    SpeakerWaveIcon,
    VideoCameraIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import { useCurrentUser, useFamily } from '../stores/useAppStore';

interface IncomingCallData {
  callId: string;
  callerName: string;
  callType: 'voice' | 'video';
  targetId: string;
}

const IncomingCallPage: React.FC = () => {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const family = useFamily();
  
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  
  // WebRTC hook
  const {
    answerCall,
    endCall,
    isCallActive: _isCallActive,
    isRinging: _isRinging,
    isConnecting: _isConnecting,
  } = useWebRTC({
    familyId: familyId || '',
    deviceId: 'current-device',
  });

  // Get incoming call data from URL params or store
  useEffect(() => {
    // Try to get call data from URL params first
    const urlParams = new URLSearchParams(window.location.search);
    const callId = urlParams.get('callId');
    const callerName = urlParams.get('callerName');
    const callType = urlParams.get('callType') as 'voice' | 'video';
    const targetId = urlParams.get('targetId');

    if (callId && callerName && callType && targetId) {
      setIncomingCall({
        callId,
        callerName,
        callType,
        targetId
      });
    } else {
      // Fallback: try to get from store or show mock data
      setIncomingCall({
        callId: 'mock-call-' + Date.now(),
        callerName: 'Family Member',
        callType: 'voice',
        targetId: 'mock-target'
      });
    }
  }, []);

  // Auto-answer after 30 seconds if not answered
  useEffect(() => {
    if (!incomingCall) return;

    const timeout = setTimeout(() => {
      handleDeclineCall();
    }, 30000); // 30 seconds timeout

    return () => clearTimeout(timeout);
  }, [incomingCall]);

  // Handle answering the call
  const handleAnswerCall = async () => {
    if (!incomingCall) return;
    
    setIsAnswering(true);
    
    try {
      await answerCall();
      
      // Navigate to appropriate call page
      const callPage = incomingCall.callType === 'video' ? 'video' : 'voice';
      navigate(`/call/${callPage}/${familyId}`);
    } catch (error) {
      console.error('Failed to answer call:', error);
      setIsAnswering(false);
    }
  };

  // Handle declining the call
  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    
    setIsDeclining(true);
    
    try {
      await endCall();
      
      // Go back to dashboard
      const dashboard = currentUser && 'age' in currentUser ? '/kids' : '/guardian';
      navigate(dashboard);
    } catch (error) {
      console.error('Failed to decline call:', error);
      setIsDeclining(false);
    }
  };

  // Get caller info
  const getCallerInfo = () => {
    if (!incomingCall || !family) return null;
    
    // Try to find caller in family members
    const caller = family.guardians.find(g => g.name === incomingCall.callerName) ||
                   family.children.find(c => c.name === incomingCall.callerName);
    
    return caller || {
      name: incomingCall.callerName,
      avatar: incomingCall.callType === 'video' ? '📹' : '📞',
      isOnline: true
    };
  };

  const callerInfo = getCallerInfo();
    // const _isKidsInterface = currentUser && 'age' in currentUser;

  if (!incomingCall) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">No Incoming Call</h1>
          <p className="mb-4">Redirecting to dashboard...</p>
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="max-w-md w-full"
      >
        {/* Caller Avatar */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="relative mb-8"
        >
          <div className="w-32 h-32 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-4 border-white border-t-transparent rounded-full"
            />
            <div className="text-6xl">
              {callerInfo?.avatar || (incomingCall.callType === 'video' ? '📹' : '📞')}
            </div>
          </div>
          
          {/* Call type indicator */}
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            {incomingCall.callType === 'video' ? (
              <VideoCameraIcon className="w-6 h-6 text-white" />
            ) : (
              <PhoneIcon className="w-6 h-6 text-white" />
            )}
          </div>
        </motion.div>

        {/* Caller Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2 text-shadow">
            {callerInfo?.name || incomingCall.callerName}
          </h1>
          <p className="text-xl text-white text-opacity-75 text-shadow">
            {incomingCall.callType === 'video' ? 'Video Call' : 'Voice Call'}
          </p>
          <p className="text-lg text-white text-opacity-60 text-shadow mt-2">
            {isAnswering ? 'Answering...' : isDeclining ? 'Declining...' : 'Incoming Call'}
          </p>
        </motion.div>

        {/* Call Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center space-x-8"
        >
          {/* Decline Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleDeclineCall}
            disabled={isAnswering || isDeclining}
            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XMarkIcon className="w-8 h-8 text-white" />
          </motion.button>

          {/* Answer Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleAnswerCall}
            disabled={isAnswering || isDeclining}
            className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnswering ? (
              <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <CheckIcon className="w-8 h-8 text-white" />
            )}
          </motion.button>
        </motion.div>

        {/* Call Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 flex justify-center space-x-6"
        >
          <div className="flex items-center space-x-2 text-white text-opacity-75">
            <MicrophoneIcon className="w-5 h-5" />
            <span className="text-sm">Microphone</span>
          </div>
          
          {incomingCall.callType === 'video' && (
            <div className="flex items-center space-x-2 text-white text-opacity-75">
              <VideoCameraIcon className="w-5 h-5" />
              <span className="text-sm">Camera</span>
            </div>
          )}
          
          <div className="flex items-center space-x-2 text-white text-opacity-75">
            <SpeakerWaveIcon className="w-5 h-5" />
            <span className="text-sm">Speaker</span>
          </div>
        </motion.div>

        {/* Auto-decline timer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-6 text-center"
        >
          <p className="text-white text-opacity-60 text-sm">
            Call will auto-decline in 30 seconds
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default IncomingCallPage;
