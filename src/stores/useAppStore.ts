/**
 * ============================================================================
 * KIDS CALL HOME - Main App Store
 * ============================================================================
 * 
 * Purpose: Centralized state management using Zustand for family communication
 * Interface: Shared across all components
 * Dependencies: zustand, types
 * 
 * V1 Features:
 * - Family and user state management
 * - Calling state and history
 * - Real-time messaging state
 * - UI preferences and theme management
 * - Device and network information
 * 
 * V2 Ready:
 * - Multi-family support architecture
 * - Advanced calling features state
 * - Enhanced offline capabilities
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import FamilyDataService from '../services/familyDataService';
import type {
    AppState,
    CallState,
    Child,
    DeviceInfo,
    Family,
    Guardian,
    Message,
    NetworkInfo
} from '../types';

interface AppStore extends AppState {
  // Family and authentication actions
  setCurrentFamily: (family: Family | null) => void;
  setCurrentUser: (user: Guardian | Child | null) => void;
  setUserType: (type: 'guardian' | 'child' | null) => void;
  
  // Calling actions
  setActiveCall: (call: CallState | null) => void;
  setIncomingCall: (call: CallState | null) => void;
  addCallToHistory: (call: CallState) => void;
  clearCallHistory: () => void;
  
  // Messaging actions
  addMessage: (message: Message) => void;
  markMessageAsRead: (messageId: string) => void;
  setUnreadCount: (count: number) => void;
  clearMessages: () => void;
  
  // UI actions
  setTheme: (theme: 'guardian' | 'kids' | 'auto') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Device and network actions
  setDeviceInfo: (device: DeviceInfo | null) => void;
  setNetworkInfo: (network: NetworkInfo | null) => void;
  setOnlineStatus: (online: boolean) => void;
  
  // Pusher connection actions
  setPusherConnected: (connected: boolean) => void;
  setLastHeartbeat: (timestamp: Date | null) => void;
  
  // Family member status actions
  updateFamilyMemberStatus: (userId: string, isOnline: boolean, lastSeen: Date) => void;
  
  // Utility actions
  reset: () => void;
  logout: () => void;
  initializeApp: () => Promise<void>;
}

const initialState: AppState = {
  // Family and authentication
  currentFamily: null,
  currentUser: null,
  userType: null,
  
  // Calling state
  activeCall: null,
  incomingCall: null,
  callHistory: [],
  
  // Messaging
  messages: [],
  unreadCount: 0,
  
  // UI state
  theme: 'auto',
  isLoading: false,
  error: null,
  
  // Device and network
  deviceInfo: null,
  networkInfo: null,
  isOnline: true,
  
  // Pusher connection
  pusherConnected: false,
  lastHeartbeat: null,
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        // Family and authentication actions
        setCurrentFamily: (family) => 
          set({ currentFamily: family }, false, 'setCurrentFamily'),
        
        setCurrentUser: (user) => 
          set({ currentUser: user }, false, 'setCurrentUser'),
        
        setUserType: (type) => 
          set({ userType: type }, false, 'setUserType'),
        
        // Calling actions
        setActiveCall: (call) => 
          set({ activeCall: call }, false, 'setActiveCall'),
        
        setIncomingCall: (call) => 
          set({ incomingCall: call }, false, 'setIncomingCall'),
        
        addCallToHistory: (call) => 
          set((state) => ({
            callHistory: [call, ...state.callHistory].slice(0, 50) // Keep last 50 calls
          }), false, 'addCallToHistory'),
        
        clearCallHistory: () => 
          set({ callHistory: [] }, false, 'clearCallHistory'),
        
        // Messaging actions
        addMessage: (message) => 
          set((state) => ({
            messages: [message, ...state.messages].slice(0, 1000), // Keep last 1000 messages
            unreadCount: state.unreadCount + 1
          }), false, 'addMessage'),
        
        markMessageAsRead: (messageId) => 
          set((state) => ({
            messages: state.messages.map(msg => 
              msg.id === messageId ? { ...msg, read: true } : msg
            ),
            unreadCount: Math.max(0, state.unreadCount - 1)
          }), false, 'markMessageAsRead'),
        
        setUnreadCount: (count) => 
          set({ unreadCount: count }, false, 'setUnreadCount'),
        
        clearMessages: () => 
          set({ messages: [], unreadCount: 0 }, false, 'clearMessages'),
        
        // UI actions
        setTheme: (theme) => 
          set({ theme }, false, 'setTheme'),
        
        setLoading: (loading) => 
          set({ isLoading: loading }, false, 'setLoading'),
        
        setError: (error) => 
          set({ error }, false, 'setError'),
        
        // Device and network actions
        setDeviceInfo: (device) => 
          set({ deviceInfo: device }, false, 'setDeviceInfo'),
        
        setNetworkInfo: (network) => 
          set({ networkInfo: network }, false, 'setNetworkInfo'),
        
        setOnlineStatus: (online) => 
          set({ isOnline: online }, false, 'setOnlineStatus'),
        
        // Pusher connection actions
        setPusherConnected: (connected) => 
          set({ pusherConnected: connected }, false, 'setPusherConnected'),
        
        setLastHeartbeat: (timestamp) => 
          set({ lastHeartbeat: timestamp }, false, 'setLastHeartbeat'),
        
        // Family member status actions
        updateFamilyMemberStatus: (userId, isOnline, lastSeen) => 
          set((state) => {
            if (!state.currentFamily) {
              console.warn('Cannot update family member status: no current family');
              return state;
            }
            
            console.log('Updating family member status:', {
              userId,
              isOnline,
              lastSeen,
              familyId: state.currentFamily.id
            });
            
            const updatedFamily = { ...state.currentFamily };
            let memberFound = false;
            
            // Update guardian status (match by deviceId since that's what's sent in status updates)
            console.log('🔍 Checking guardians for deviceId:', userId);
            console.log('🔍 Available guardian deviceIds:', updatedFamily.guardians.map(g => g.deviceId));
            updatedFamily.guardians = updatedFamily.guardians.map(guardian => {
              if (guardian.deviceId === userId) {
                memberFound = true;
                console.log('✅ Updated guardian status:', guardian.name, 'to', isOnline ? 'online' : 'offline');
                return { ...guardian, isOnline, lastSeen };
              }
              return guardian;
            });
            
            // Update child status (match by deviceId since that's what's sent in status updates)
            console.log('🔍 Checking children for deviceId:', userId);
            console.log('🔍 Available child deviceIds:', updatedFamily.children.map(c => c.deviceId));
            updatedFamily.children = updatedFamily.children.map(child => {
              if (child.deviceId === userId) {
                memberFound = true;
                console.log('✅ Updated child status:', child.name, 'to', isOnline ? 'online' : 'offline');
                return { ...child, isOnline, lastSeen };
              }
              return child;
            });
            
            if (!memberFound) {
              console.warn('Family member not found for status update:', userId);
            }
            
            return { currentFamily: updatedFamily };
          }, false, 'updateFamilyMemberStatus'),
        
        // Utility actions
        reset: () => 
          set(initialState, false, 'reset'),
        
        logout: () => {
          const state = get();
          // Update user's offline status before logging out
          if (state.currentUser) {
            const { updateFamilyMemberStatus } = get();
            updateFamilyMemberStatus(state.currentUser.deviceId, false, new Date());
          }
          
          set({
            currentFamily: null,
            currentUser: null,
            userType: null,
            activeCall: null,
            callHistory: [],
            messages: [],
            unreadCount: 0,
            error: null,
            pusherConnected: false,
            lastHeartbeat: null,
          }, false, 'logout');
        },
        
        initializeApp: async () => {
          set({ isLoading: true }, false, 'initializeApp/start');
          
          try {
            // TODO: Initialize device detection
            // TODO: Initialize network monitoring
            // TODO: Connect to WebSocket
            
            // Check for existing family data and redirect if found
            const state = get();
            if (state.currentFamily && state.currentUser && state.userType) {
              // User has existing family data, they should be redirected to their dashboard
              // This will be handled by the App component's routing logic
              console.log('Existing family data found, user should be redirected to dashboard');
              
              // Update user's online status when app initializes
              const { updateFamilyMemberStatus } = get();
              updateFamilyMemberStatus(state.currentUser.deviceId, true, new Date());
              
              // Also update the family data service to persist the online status
              FamilyDataService.updateFamilyMemberStatus(
                state.currentFamily.id, 
                state.currentUser.deviceId, 
                true
              );
            }
            
            set({ isLoading: false }, false, 'initializeApp/success');
          } catch (error) {
            set({ 
              isLoading: false, 
              error: error instanceof Error ? error.message : 'Failed to initialize app'
            }, false, 'initializeApp/error');
          }
        },
      }),
      {
        name: 'kids-call-home-storage',
        // Only persist essential data, not real-time state
        partialize: (state) => ({
          currentFamily: state.currentFamily,
          currentUser: state.currentUser,
          userType: state.userType,
          theme: state.theme,
          deviceInfo: state.deviceInfo,
        }),
      }
    ),
    {
      name: 'kids-call-home-store',
    }
  )
);

// Selector hooks for better performance
export const useFamily = () => useAppStore((state) => state.currentFamily);
export const useCurrentUser = () => useAppStore((state) => state.currentUser);
export const useUserType = () => useAppStore((state) => state.userType);
export const useActiveCall = () => useAppStore((state) => state.activeCall);
export const useCallHistory = () => useAppStore((state) => state.callHistory);
export const useMessages = () => useAppStore((state) => state.messages);
export const useUnreadCount = () => useAppStore((state) => state.unreadCount);
export const useTheme = () => useAppStore((state) => state.theme);
export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useError = () => useAppStore((state) => state.error);
export const useDeviceInfo = () => useAppStore((state) => state.deviceInfo);
export const useNetworkInfo = () => useAppStore((state) => state.networkInfo);
export const useIsOnline = () => useAppStore((state) => state.isOnline);
export const usePusherConnected = () => useAppStore((state) => state.pusherConnected);
