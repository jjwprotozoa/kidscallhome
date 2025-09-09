/**
 * ============================================================================
 * KIDS CALL HOME - Incoming Call Notification Component
 * ============================================================================
 * 
 * Purpose: Shows incoming call notification overlay when someone is calling
 * Interface: Both guardian and kids interfaces supported
 * Dependencies: React, Framer Motion, Zustand
 * 
 * V1 Features:
 * - Overlay notification for incoming calls
 * - Answer/decline buttons
 * - Caller information display
 * - Auto-dismiss after timeout
 * 
 * V2 Ready:
 * - Call preview with video
 * - Multiple call handling
 * - Custom notification sounds
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import {
    CheckIcon,
    PhoneIcon,
    VideoCameraIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useFamily } from '../../stores/useAppStore';

interface IncomingCallNotificationProps {
  callId: string;
  callerName: string;
  callType: 'voice' | 'video';
  targetId: string;
  familyId: string;
  onAnswer: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}

const IncomingCallNotification: React.FC<IncomingCallNotificationProps> = ({
  callId,
  callerName,
  callType,
  targetId,
  familyId,
  onAnswer,
  onDecline,
  onDismiss: _onDismiss
}) => {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const family = useFamily();
  const [timeLeft, setTimeLeft] = useState(30);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDecline]);

  // Get caller info
  const getCallerInfo = () => {
    if (!family) return null;
    
    const caller = family.guardians.find((g: any) => g.name === callerName) ||
                   family.children.find((c: any) => c.name === callerName);
    
    return caller || {
      name: callerName,
      avatar: callType === 'video' ? '📹' : '📞',
      isOnline: true
    };
  };

  const callerInfo = getCallerInfo();
  const isKidsInterface = currentUser && 'age' in currentUser;

  const handleAnswer = () => {
    onAnswer();
    navigate(`/call/incoming/${familyId}?callId=${callId}&callerName=${encodeURIComponent(callerName)}&callType=${callType}&targetId=${targetId}`);
  };

  const handleDecline = () => {
    onDecline();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -100 }}
        className="fixed top-4 left-4 right-4 z-50 max-w-sm mx-auto"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className={`p-6 rounded-2xl shadow-2xl ${
            isKidsInterface 
              ? 'bg-gradient-to-r from-pink-500 to-purple-600' 
              : 'bg-gradient-to-r from-blue-500 to-purple-600'
          }`}
        >
          {/* Caller Avatar */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <div className="text-3xl">
                  {callerInfo?.avatar || (callType === 'video' ? '📹' : '📞')}
                </div>
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-2 border-white border-t-transparent rounded-full"
              />
            </div>
            
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white">
                {callerInfo?.name || callerName}
              </h3>
              <p className="text-white text-opacity-75">
                {callType === 'video' ? 'Video Call' : 'Voice Call'}
              </p>
              <p className="text-white text-opacity-60 text-sm">
                {timeLeft}s remaining
              </p>
            </div>
            
            {/* Call type indicator */}
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              {callType === 'video' ? (
                <VideoCameraIcon className="w-5 h-5 text-white" />
              ) : (
                <PhoneIcon className="w-5 h-5 text-white" />
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDecline}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
              <span>Decline</span>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAnswer}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
            >
              <CheckIcon className="w-5 h-5" />
              <span>Answer</span>
            </motion.button>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="w-full bg-white bg-opacity-20 rounded-full h-1">
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 30, ease: "linear" }}
                className="h-1 bg-white rounded-full"
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default IncomingCallNotification;
