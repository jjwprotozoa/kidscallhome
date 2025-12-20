/**
 * ============================================================================
 * KIDS CALL HOME - Error Boundary Component
 * ============================================================================
 * 
 * Purpose: Catches JavaScript errors anywhere in the component tree
 * Interface: Shared - provides error handling for all interfaces
 * Dependencies: React ErrorBoundary, zustand
 * 
 * V1 Features:
 * - Catches and displays React errors gracefully
 * - Provides user-friendly error messages
 * - Includes error reporting and recovery options
 * - Different error UI for guardian vs kids interfaces
 * 
 * V2 Ready:
 * - Advanced error analytics and reporting
 * - Automatic error recovery mechanisms
 * - Enhanced debugging information
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react';
import { useAppStore } from '../../stores/useAppStore';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Catches and handles React errors gracefully
 * 
 * Provides different error experiences for guardian and kids interfaces,
 * with appropriate language and visual design for each user type.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Send error to analytics service
    // TODO: Report error to monitoring service
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback 
        error={this.state.error} 
        onRetry={this.handleRetry}
        onReload={this.handleReload}
      />;
    }

    return this.props.children;
  }
}

/**
 * ErrorFallback - Displays error UI based on user type
 * 
 * Shows appropriate error messages and recovery options for both
 * guardian (technical) and kids (simple) interfaces.
 */
const ErrorFallback: React.FC<{
  error: Error | null;
  onRetry: () => void;
  onReload: () => void;
}> = ({ error, onRetry, onReload }) => {
  const { userType, theme } = useAppStore();
  
  const isKidsInterface = userType === 'child' || theme === 'kids';
  
  if (isKidsInterface) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 to-pink-500 p-4">
        <div className="text-center max-w-md">
          {/* Kids-friendly error UI */}
          <div className="text-8xl mb-6">😅</div>
          <h1 className="text-4xl font-bold text-white mb-4 text-shadow-lg">
            Oops!
          </h1>
          <p className="text-2xl text-white mb-8 text-shadow">
            Something went wrong, but don't worry! 
            <br />
            Let's try again.
          </p>
          <div className="space-y-4">
            <button
              onClick={onRetry}
              className="btn-kids bg-white text-orange-500 hover:bg-orange-50"
            >
              Try Again
            </button>
            <button
              onClick={onReload}
              className="btn-kids text-white"
              style={{
                background: 'var(--theme-glass)',
                backdropFilter: 'blur(var(--glass-blur))',
                WebkitBackdropFilter: 'blur(var(--glass-blur))',
                border: '1px solid var(--theme-border)'
              }}
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Guardian interface error UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="text-center max-w-2xl">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-3xl font-bold text-white mb-4 text-shadow-lg">
          Application Error
        </h1>
        <p className="text-lg text-white mb-6 text-shadow">
          An unexpected error occurred. We're working to fix this issue.
        </p>
        
        {error && (
          <details className="text-left bg-black bg-opacity-20 rounded-lg p-4 mb-6">
            <summary className="cursor-pointer text-white font-semibold mb-2">
              Technical Details
            </summary>
            <div className="text-sm text-gray-200 font-mono">
              <p><strong>Error:</strong> {error.message}</p>
              <p><strong>Stack:</strong></p>
              <pre className="whitespace-pre-wrap text-xs mt-2">
                {error.stack}
              </pre>
            </div>
          </details>
        )}
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onRetry}
            className="btn-primary"
          >
            Try Again
          </button>
          <button
            onClick={onReload}
            className="btn-secondary"
          >
            Reload Page
          </button>
        </div>
        
        <p className="text-sm text-white text-opacity-75 mt-6">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  );
};

export default ErrorBoundary;
