/**
 * ============================================================================
 * KIDS CALL HOME - WebSocket Service
 * ============================================================================
 * 
 * Purpose: Real-time communication for family status updates and calling
 * Interface: Shared across all components
 * Dependencies: WebSocket API, zustand store
 * 
 * V1 Features:
 * - Real-time online/offline status updates
 * - Call signaling and notifications
 * - Message delivery and read receipts
 * - Heartbeat and connection management
 * 
 * V2 Ready:
 * - End-to-end encryption
 * - Advanced presence features
 * - Multi-device synchronization
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import { useAppStore } from '../stores/useAppStore';

interface WebSocketMessage {
  type: 'status_update' | 'call_signal' | 'message' | 'heartbeat' | 'error';
  data: any;
  timestamp: Date;
  from: string;
  to?: string;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;

  constructor() {
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.updateUserStatus = this.updateUserStatus.bind(this);
    
    // In development mode, set socket as connected since we use Pusher
    if (import.meta.env.DEV) {
      useAppStore.getState().setSocketConnected(true);
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect(familyId: string, userId: string) {
    // Skip WebSocket connection in development since we're using Pusher
    if (import.meta.env.DEV) {
      console.log('WebSocket disabled in development - using Pusher instead');
      return;
    }

    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    
    try {
      // TODO: Replace with actual WebSocket server URL
      const wsUrl = `ws://localhost:8080/ws?familyId=${familyId}&userId=${userId}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Update store
        useAppStore.getState().setSocketConnected(true);
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Send initial status update
        this.updateUserStatus(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        
        // Update store
        useAppStore.getState().setSocketConnected(false);
        
        // Stop heartbeat
        this.stopHeartbeat();
        
        // Attempt to reconnect
        this.attemptReconnect(familyId, userId);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.isConnecting = false;
      this.attemptReconnect(familyId, userId);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    // Skip WebSocket operations in development
    if (import.meta.env.DEV) {
      console.log('WebSocket disconnect skipped in development - using Pusher instead');
      return;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.stopHeartbeat();
    this.reconnectAttempts = 0;
    useAppStore.getState().setSocketConnected(false);
  }

  /**
   * Send message through WebSocket
   */
  sendMessage(type: WebSocketMessage['type'], data: any, to?: string) {
    // Skip WebSocket operations in development
    if (import.meta.env.DEV) {
      console.log('WebSocket sendMessage skipped in development - using Pusher instead');
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date(),
      from: useAppStore.getState().currentUser?.id || '',
      to,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Update user online status
   */
  updateUserStatus(isOnline: boolean) {
    // Skip WebSocket operations in development
    if (import.meta.env.DEV) {
      console.log('WebSocket updateUserStatus skipped in development - using Pusher instead');
      return;
    }
    
    this.sendMessage('status_update', { isOnline });
  }

  /**
   * Send call signal
   */
  sendCallSignal(callData: any, targetUserId: string) {
    this.sendMessage('call_signal', callData, targetUserId);
  }

  /**
   * Send message
   */
  sendChatMessage(messageData: any, targetUserId?: string) {
    this.sendMessage('message', messageData, targetUserId);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage) {
    const { setCurrentFamily: _setCurrentFamily, setLastHeartbeat } = useAppStore.getState();

    switch (message.type) {
      case 'status_update':
        this.handleStatusUpdate(message.data);
        break;
      
      case 'call_signal':
        this.handleCallSignal(message.data);
        break;
      
      case 'message':
        this.handleChatMessage(message.data);
        break;
      
      case 'heartbeat':
        setLastHeartbeat(new Date());
        break;
      
      case 'error':
        console.error('WebSocket server error:', message.data);
        break;
      
      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  /**
   * Handle status update from other family members
   */
  private handleStatusUpdate(data: { userId: string; isOnline: boolean; lastSeen: Date }) {
    const { currentFamily, setCurrentFamily } = useAppStore.getState();
    
    if (!currentFamily) return;

    // Update guardian status
    const updatedGuardians = currentFamily.guardians.map(guardian => 
      guardian.id === data.userId 
        ? { ...guardian, isOnline: data.isOnline, lastSeen: new Date(data.lastSeen) }
        : guardian
    );

    // Update child status
    const updatedChildren = currentFamily.children.map(child => 
      child.id === data.userId 
        ? { ...child, isOnline: data.isOnline, lastSeen: new Date(data.lastSeen) }
        : child
    );

    // Update family in store
    setCurrentFamily({
      ...currentFamily,
      guardians: updatedGuardians,
      children: updatedChildren,
    });
  }

  /**
   * Handle incoming call signal
   */
  private handleCallSignal(data: any) {
    // TODO: Implement call signaling
    console.log('Received call signal:', data);
  }

  /**
   * Handle incoming chat message
   */
  private handleChatMessage(data: any) {
    // TODO: Implement message handling
    console.log('Received message:', data);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage('heartbeat', { timestamp: new Date() });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(familyId: string, userId: string) {
    // Skip reconnection in development mode
    if (import.meta.env.DEV) {
      console.log('WebSocket reconnection disabled in development - using Pusher instead');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect(familyId, userId);
    }, delay);
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;
