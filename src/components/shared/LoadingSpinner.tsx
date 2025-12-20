/**
 * ============================================================================
 * KIDS CALL HOME - Loading Spinner Component
 * ============================================================================
 * 
 * Purpose: Displays loading states with appropriate styling for each interface
 * Interface: Shared - provides loading UI for all components
 * Dependencies: React, tailwindcss
 * 
 * V1 Features:
 * - Multiple spinner sizes (small, medium, large)
 * - Different styles for guardian vs kids interfaces
 * - Smooth animations and transitions
 * - Accessible loading indicators
 * 
 * V2 Ready:
 * - Custom loading animations
 * - Progress indicators
 * - Skeleton loading states
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

import React from 'react';
import { useAppStore } from '../../stores/useAppStore';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  className?: string;
}

/**
 * LoadingSpinner - Displays loading state with appropriate styling
 * 
 * Provides different visual styles for guardian (professional) and kids
 * (playful) interfaces, with multiple sizes and optional text.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  text,
  className = '',
}) => {
  const { userType, theme } = useAppStore();
  
  const isKidsInterface = userType === 'child' || theme === 'kids';
  
  // Size classes
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  };
  
  // Text size classes
  const textSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };
  
  if (isKidsInterface) {
    return (
      <div className={`flex flex-col items-center justify-center space-y-4 ${className}`}>
        {/* Kids-friendly loading animation */}
        <div className="relative">
          <div className={`${sizeClasses[size]} spinner`} />
        </div>
        
        {text && (
          <p className={`text-theme font-semibold ${textSizeClasses[size]}`}>
            {text}
          </p>
        )}
        
        {/* Apple-style loading dots */}
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-kids-primary rounded-full animate-bounce-subtle" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-kids-secondary rounded-full animate-bounce-subtle" style={{ animationDelay: '200ms' }} />
          <div className="w-2 h-2 bg-kids-accent rounded-full animate-bounce-subtle" style={{ animationDelay: '400ms' }} />
        </div>
      </div>
    );
  }
  
  // Guardian interface loading spinner
  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      {/* Apple-style loading spinner */}
      <div className={`${sizeClasses[size]} spinner`} />
      
      {text && (
        <p className={`text-theme font-medium ${textSizeClasses[size]}`}>
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
