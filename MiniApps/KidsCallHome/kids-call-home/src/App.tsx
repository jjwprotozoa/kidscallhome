/**
 * ============================================================================
 * KIDS CALL HOME - Main App Component
 * ============================================================================
 * 
 * Purpose: Root application component with routing and theme management
 * Interface: Shared - provides routing for both guardian and kids interfaces
 * Dependencies: react-router-dom, zustand, tailwindcss
 * 
 * V1 Features:
 * - React Router setup with all main routes
 * - Theme detection and management
 * - Global error boundary
 * - PWA installation prompts
 * - Responsive layout wrapper
 * 
 * V2 Ready:
 * - Advanced routing with protected routes
 * - Multi-language support
 * - Enhanced PWA features
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import { useEffect } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import websocketService from './services/websocketService';
import { useAppStore } from './stores/useAppStore';

// Import pages
import GuardianDashboard from './pages/GuardianDashboard';
import IncomingCallPage from './pages/IncomingCallPage';
import KidsDashboard from './pages/KidsDashboard';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import MessagesPage from './pages/MessagesPage';
import SetupPage from './pages/SetupPage';
import VideoCallPage from './pages/VideoCallPage';
import VoiceCallPage from './pages/VoiceCallPage';

// Import components
import ErrorBoundary from './components/shared/ErrorBoundary';
import LoadingSpinner from './components/shared/LoadingSpinner';
import PWAInstallPrompt from './components/shared/PWAInstallPrompt';

/**
 * AuthGuard - Handles automatic redirection for existing users
 * 
 * Checks if user has existing family data and redirects them to the
 * appropriate dashboard based on their user type.
 */
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentFamily, currentUser, userType } = useAppStore();
  const location = useLocation();
  
  // If user has existing family data and is not already on a dashboard page
  if (currentFamily && currentUser && userType) {
    const isOnLanding = location.pathname === '/';
    const isOnSetup = location.pathname === '/setup';
    const isOnLogin = location.pathname === '/login';
    const isOnDashboard = location.pathname === '/guardian' || location.pathname === '/kids';
    const isOnCallPage = location.pathname.startsWith('/call/');
    const isOnMessagesPage = location.pathname.startsWith('/messages/');
    
    // Allow access to landing, setup, and login pages even if user is logged in
    if (!isOnLanding && !isOnSetup && !isOnLogin && !isOnDashboard && !isOnCallPage && !isOnMessagesPage) {
      // Redirect to appropriate dashboard
      return <Navigate to={userType === 'guardian' ? '/guardian' : '/kids'} replace />;
    }
  }
  
  return <>{children}</>;
};

/**
 * App - Main application component
 * 
 * Provides routing, theme management, and global error handling for the
 * Kids Call Home family communication application.
 */
function App() {
  const { 
    theme, 
    isLoading, 
    error, 
    currentFamily,
    currentUser,
    userType: _userType,
    initializeApp,
    setTheme: _setTheme 
  } = useAppStore();

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
    
    // Request notification permission for incoming calls
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [initializeApp]);

  // Initialize WebSocket connection when user is logged in
  useEffect(() => {
    if (currentFamily && currentUser) {
      websocketService.connect(currentFamily.id, currentUser.id);
      
      // Cleanup on unmount or when dependencies change
      return () => {
        websocketService.disconnect();
      };
    } else {
      // Disconnect if no user is logged in
      websocketService.disconnect();
    }
  }, [currentFamily?.id, currentUser?.id]); // Only depend on IDs to prevent unnecessary reconnections

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'guardian') {
      root.classList.remove('kids-theme');
      root.classList.add('guardian-theme');
    } else if (theme === 'kids') {
      root.classList.remove('guardian-theme');
      root.classList.add('kids-theme');
    } else {
      // Auto theme - detect based on user agent or stored preference
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        root.classList.remove('guardian-theme');
        root.classList.add('kids-theme');
      } else {
        root.classList.remove('kids-theme');
        root.classList.add('guardian-theme');
      }
    }
  }, [theme]);

  // Show loading spinner during initialization
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--theme-background)' }}>
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Show error state if initialization failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-guardian-surface-secondary">
        <div className="text-center p-8 bg-guardian-surface rounded-large shadow-lg max-w-md mx-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-title2 font-bold text-error mb-4">
            Something went wrong
          </h1>
          <p className="text-body text-guardian-text-secondary mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen" style={{ background: 'var(--theme-background)' }}>
          {/* PWA Install Prompt */}
          <PWAInstallPrompt />
          
          {/* Auth Guard for automatic redirection */}
          <AuthGuard>
            {/* Main Application Routes */}
            <Routes>
              {/* Landing Page */}
              <Route path="/" element={<LandingPage />} />
              
              {/* Family Setup */}
              <Route path="/setup" element={<SetupPage />} />
              
              {/* Login */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Guardian Interface */}
              <Route path="/guardian" element={<GuardianDashboard />} />
              
              {/* Kids Interface */}
              <Route path="/kids" element={<KidsDashboard />} />
              
              {/* Calling Pages */}
              <Route path="/call/incoming/:familyId" element={<IncomingCallPage />} />
              <Route path="/call/voice/:familyId" element={<VoiceCallPage />} />
              <Route path="/call/video/:familyId" element={<VideoCallPage />} />
              
              {/* Messaging */}
              <Route path="/messages/:familyId" element={<MessagesPage />} />
              
              {/* Catch all - redirect to landing */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthGuard>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
