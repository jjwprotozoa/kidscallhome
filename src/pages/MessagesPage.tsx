/**
 * ============================================================================
 * KIDS CALL HOME - Messages Page
 * ============================================================================
 * 
 * Purpose: Real-time messaging interface for family communication
 * Interface: Shared - adapts styling based on user type
 * Dependencies: React, zustand, socket.io-client, tailwindcss
 * 
 * V1 Features:
 * - Real-time text messaging
 * - Voice note recording
 * - Emoji reactions
 * - Different UI for guardian vs kids interfaces
 * - Message history and status
 * 
 * V2 Ready:
 * - File sharing capabilities
 * - Message encryption
 * - Advanced emoji picker
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import {
    ArrowLeftIcon,
    FaceSmileIcon,
    PaperAirplaneIcon,
    PhoneIcon,
    VideoCameraIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMessages, useTheme, useUserType } from '../stores/useAppStore';

/**
 * MessagesPage - Family messaging interface
 * 
 * Provides real-time messaging with different interfaces for guardian
 * (efficient chat) and kids (simple, playful messaging).
 */
const MessagesPage: React.FC = () => {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const userType = useUserType();
  const theme = useTheme();
  const messages = useMessages();
  
  const [newMessage, setNewMessage] = useState('');
  const [_isRecording, _setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    // TODO: Send message via WebSocket
    console.log('Sending message:', newMessage);
    setNewMessage('');
  };
  
  // Handle voice recording
  // const _handleVoiceRecord = () => {
  //   setIsRecording(!isRecording);
  //   // TODO: Implement voice recording
  // };
  
  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };
  
  // Handle call
  const handleCall = (type: 'voice' | 'video') => {
    navigate(`/call/${type}/${familyId}`);
  };
  
  const isKidsInterface = userType === 'child' || theme === 'kids';
  
  // Common emojis for quick selection
  const commonEmojis = ['😊', '❤️', '👍', '👎', '😢', '😄', '🎉', '🔥', '💕', '🌟'];
  
  if (isKidsInterface) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 to-pink-500 flex flex-col">
        {/* Header */}
        <header className="p-4 glass-strong">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="w-12 h-12 bg-white bg-opacity-30 rounded-full flex items-center justify-center"
            >
              <ArrowLeftIcon className="w-6 h-6 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white text-shadow">
                Family Chat
              </h1>
              <p className="text-white text-opacity-75 text-shadow">
                Talk to your family
              </p>
            </div>
          </div>
        </header>
        
        {/* Messages */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-2xl font-bold text-white mb-2 text-shadow">
                No messages yet
              </h3>
              <p className="text-white text-opacity-75 text-shadow">
                Start a conversation with your family!
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.from.type === 'child' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs px-4 py-3 rounded-2xl ${
                  message.from.type === 'child' 
                    ? 'bg-white text-gray-900' 
                    : 'bg-white bg-opacity-20 text-gray-800'
                }`}>
                  <p className="text-lg">{message.content.text}</p>
                  <p className="text-xs opacity-75 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </motion.div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Quick Actions */}
        <div className="p-4 space-y-4">
          {/* Call Buttons */}
          <div className="flex space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleCall('voice')}
              className="flex-1 btn-kids bg-green-500 text-white hover:bg-green-600"
            >
              <PhoneIcon className="w-6 h-6 inline-block mr-2" />
              Call Family
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleCall('video')}
              className="flex-1 btn-kids bg-blue-500 text-white hover:bg-blue-600"
            >
              <VideoCameraIcon className="w-6 h-6 inline-block mr-2" />
              Video Call
            </motion.button>
          </div>
          
          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full px-4 py-4 text-lg rounded-2xl border-0 focus:ring-2 focus:ring-white focus:ring-opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                <FaceSmileIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={!newMessage.trim()}
              className="w-16 h-16 bg-white text-orange-500 rounded-2xl flex items-center justify-center disabled:opacity-50"
            >
              <PaperAirplaneIcon className="w-6 h-6" />
            </motion.button>
          </form>
          
          {/* Emoji Picker */}
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass p-4 rounded-2xl"
            >
              <div className="grid grid-cols-5 gap-2">
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiSelect(emoji)}
                    className="w-12 h-12 text-2xl hover:bg-white hover:bg-opacity-20 rounded-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }
  
  // Guardian interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex flex-col">
      {/* Header */}
      <header className="p-4 glass-strong">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
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
              <ArrowLeftIcon className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white text-shadow">
                Family Messages
              </h1>
              <p className="text-white text-opacity-75 text-shadow text-sm">
                {messages.length} messages
              </p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => handleCall('voice')}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
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
              <PhoneIcon className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => handleCall('video')}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
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
              <VideoCameraIcon className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Messages */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-lg font-semibold text-white mb-2 text-shadow">
              No messages yet
            </h3>
            <p className="text-white text-opacity-75 text-shadow">
              Start a conversation with your family.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.from.type === 'guardian' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-md px-4 py-3 rounded-lg ${
                message.from.type === 'guardian' 
                  ? 'bg-white text-gray-900' 
                  : 'bg-white bg-opacity-20 text-gray-800'
              }`}>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-semibold text-sm">{message.from.name}</span>
                  <span className="text-xs opacity-75">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p>{message.content.text}</p>
              </div>
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message Input */}
      <div className="p-4 glass-strong">
        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full px-4 py-3 rounded-lg border-0 focus:ring-2 focus:ring-white focus:ring-opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <FaceSmileIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-4 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Send
          </button>
        </form>
        
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 glass p-3 rounded-lg"
          >
            <div className="grid grid-cols-8 gap-1">
              {commonEmojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="w-8 h-8 text-lg hover:bg-white hover:bg-opacity-20 rounded"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
