/**
 * ============================================================================
 * KIDS CALL HOME - PWA Install Prompt Component
 * ============================================================================
 * 
 * Purpose: Prompts users to install the app as a PWA on their device
 * Interface: Shared - provides PWA installation for all interfaces
 * Dependencies: React, workbox-window, zustand
 * 
 * V1 Features:
 * - Detects PWA installation capability
 * - Shows appropriate prompts for different devices
 * - Different styling for guardian vs kids interfaces
 * - Handles installation success/failure states
 * 
 * V2 Ready:
 * - Advanced PWA features (background sync, push notifications)
 * - Installation analytics and tracking
 * - Custom installation flows
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWAInstallPrompt - Handles PWA installation prompts
 * 
 * Detects when the app can be installed as a PWA and shows appropriate
 * prompts for both guardian and kids interfaces with device-specific styling.
 */
const PWAInstallPrompt: React.FC = () => {
  const { userType, theme } = useAppStore();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  
  const isKidsInterface = userType === 'child' || theme === 'kids';
  
  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }
    
    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };
    
    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);
  
  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    setIsInstalling(true);
    
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA installation accepted');
      } else {
        console.log('PWA installation dismissed');
      }
    } catch (error) {
      console.error('PWA installation failed:', error);
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };
  
  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };
  
  // Don't show if already installed or dismissed
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }
  
  // Check if user dismissed in this session
  if (sessionStorage.getItem('pwa-prompt-dismissed')) {
    return null;
  }
  
  if (isKidsInterface) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 pwa-install-prompt">
        <div className="flex items-center space-x-4">
          {/* Kids-friendly icon */}
          <div className="text-4xl">📱</div>
          
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-1">
              Install Kids Call Home!
            </h3>
            <p className="text-white text-opacity-90">
              Add to your home screen for easy access
            </p>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="btn-kids bg-white text-orange-500 hover:bg-orange-50 disabled:opacity-50"
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
            <button
              onClick={handleDismiss}
              className="btn-kids text-white"
              style={{
                background: 'var(--theme-glass)',
                backdropFilter: 'blur(var(--glass-blur))',
                WebkitBackdropFilter: 'blur(var(--glass-blur))',
                border: '1px solid var(--theme-border)'
              }}
            >
              Later
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Guardian interface prompt
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 pwa-install-prompt">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-white">
              Install App
            </h3>
            <p className="text-sm text-white text-opacity-75">
              Install for better performance and offline access
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            {isInstalling ? 'Installing...' : 'Install'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-white rounded-lg font-medium transition-all"
            style={{
              background: 'var(--theme-glass)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--theme-border)'
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
