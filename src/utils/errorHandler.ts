/**
 * ============================================================================
 * KIDS CALL HOME - Error Handler Utility
 * ============================================================================
 * 
 * Purpose: Centralized error handling and logging for the application
 * Interface: Shared across all components
 * Dependencies: None
 * 
 * V1 Features:
 * - Global error handling and logging
 * - MutationObserver error suppression
 * - Error reporting and analytics
 * - Development vs production error handling
 * 
 * V2 Ready:
 * - Advanced error analytics and reporting
 * - Error recovery mechanisms
 * - User-friendly error messages
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

// Error types that should be suppressed (non-critical)
const SUPPRESSED_ERRORS = [
  'Failed to execute \'observe\' on \'MutationObserver\'',
  'parameter 1 is not of type \'Node\'',
  'ResizeObserver loop limit exceeded',
];

// Check if an error should be suppressed
export const shouldSuppressError = (error: Error | string): boolean => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  return SUPPRESSED_ERRORS.some(suppressedError => 
    errorMessage.includes(suppressedError)
  );
};

// Enhanced error handler
export const handleError = (error: Error | string, context?: string) => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  // Suppress non-critical errors
  if (shouldSuppressError(error)) {
    console.warn(`Suppressed error${context ? ` in ${context}` : ''}:`, errorMessage);
    return;
  }
  
  // Log critical errors
  console.error(`Error${context ? ` in ${context}` : ''}:`, error);
  
  // TODO: Send to error reporting service in production
  if (import.meta.env.PROD) {
    // Send to error reporting service
  }
};

// Global error handler setup
export const setupGlobalErrorHandling = () => {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    handleError(event.error, 'Global Error Handler');
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason, 'Unhandled Promise Rejection');
  });
  
  // Handle console errors
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const errorMessage = args.join(' ');
    if (shouldSuppressError(errorMessage)) {
      console.warn('Suppressed console error:', ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
};

// MutationObserver error suppression
export const createSafeMutationObserver = (callback: MutationCallback) => {
  return new MutationObserver((mutations, observer) => {
    try {
      callback(mutations, observer);
    } catch (error) {
      handleError(error as Error, 'MutationObserver');
    }
  });
};

// Safe DOM element observer
export const safeObserve = (
  observer: MutationObserver | ResizeObserver,
  target: Node | Element | null,
  options?: MutationObserverInit | ResizeObserverOptions
) => {
  if (!target) {
    console.warn('Cannot observe null or undefined target');
    return;
  }
  
  try {
    if (observer instanceof MutationObserver) {
      observer.observe(target as Node, options as MutationObserverInit);
    } else if (observer instanceof ResizeObserver) {
      observer.observe(target as Element, options as ResizeObserverOptions);
    }
  } catch (error) {
    handleError(error as Error, 'Observer');
  }
};
