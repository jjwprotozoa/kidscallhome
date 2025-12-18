// src/utils/mobileCompatibility.ts
// Unified mobile browser compatibility utilities for WebRTC calls
// Combines iOS and Android handling for seamless cross-platform support

import { 
  isIOS, 
  isIOSSafari, 
  isIOSChrome, 
  resumeIOSAudioContext, 
  preWarmIOSMedia,
  checkIOSWebRTCSupport,
  logIOSDiagnostics 
} from './iosCompatibility';

import { 
  isAndroid, 
  isAndroidChrome, 
  isSamsungInternet, 
  isAndroidFirefox,
  isAndroidWebView,
  getAndroidVersion,
  resumeAndroidAudioContext, 
  preWarmAndroidMedia,
  checkAndroidWebRTCSupport,
  getAndroidVideoConstraints,
  logAndroidDiagnostics 
} from './androidCompatibility';

// Re-export individual platform utilities
export * from './iosCompatibility';
export * from './androidCompatibility';

/**
 * Detect if running on any mobile device
 */
export const isMobile = (): boolean => {
  return isIOS() || isAndroid();
};

/**
 * Get current platform type
 */
export type PlatformType = 'ios' | 'android' | 'desktop';
export const getPlatformType = (): PlatformType => {
  if (isIOS()) return 'ios';
  if (isAndroid()) return 'android';
  return 'desktop';
};

/**
 * Get browser info for current platform
 */
export interface BrowserInfo {
  platform: PlatformType;
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  browser: string;
  version: number | null;
  isWebView: boolean;
  userAgent: string;
}

export const getBrowserInfo = (): BrowserInfo => {
  const platform = getPlatformType();
  
  let browser = 'Unknown';
  let version: number | null = null;
  let isWebView = false;
  
  if (isIOS()) {
    if (isIOSSafari()) browser = 'Safari';
    else if (isIOSChrome()) browser = 'Chrome';
    else browser = 'Other iOS Browser';
    
    // Extract iOS version
    const match = navigator.userAgent.match(/OS (\d+)/);
    if (match) version = parseInt(match[1], 10);
  } else if (isAndroid()) {
    if (isAndroidChrome()) browser = 'Chrome';
    else if (isSamsungInternet()) browser = 'Samsung Internet';
    else if (isAndroidFirefox()) browser = 'Firefox';
    else browser = 'Other Android Browser';
    
    version = getAndroidVersion();
    isWebView = isAndroidWebView();
  } else {
    // Desktop browser detection
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
  }
  
  return {
    platform,
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isMobile: isMobile(),
    browser,
    version,
    isWebView,
    userAgent: navigator.userAgent
  };
};

/**
 * Resume AudioContext for current platform
 * Must be called in direct response to user gesture
 */
export const resumeAudioContext = async (audioContext?: AudioContext): Promise<AudioContext | null> => {
  if (isIOS()) {
    await resumeIOSAudioContext(audioContext);
    return audioContext || null;
  }
  
  if (isAndroid()) {
    return resumeAndroidAudioContext(audioContext);
  }
  
  // Desktop - just resume if suspended
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
    return audioContext;
  }
  
  return audioContext || null;
};

/**
 * Pre-warm media for current platform
 * Should be called immediately on user gesture for best results
 */
export const preWarmMedia = async (): Promise<MediaStream | null> => {
  if (isIOS()) {
    return preWarmIOSMedia();
  }
  
  if (isAndroid()) {
    return preWarmAndroidMedia();
  }
  
  // Desktop doesn't need pre-warming
  return null;
};

/**
 * Check WebRTC support for current platform
 */
export interface WebRTCSupport {
  supported: boolean;
  issues: string[];
  recommendations: string[];
  platform: PlatformType;
  browserInfo: BrowserInfo;
}

export const checkWebRTCSupport = (): WebRTCSupport => {
  const browserInfo = getBrowserInfo();
  const platform = getPlatformType();
  
  let platformSupport: { supported: boolean; issues: string[]; recommendations: string[] };
  
  if (isIOS()) {
    platformSupport = checkIOSWebRTCSupport();
  } else if (isAndroid()) {
    const support = checkAndroidWebRTCSupport();
    platformSupport = {
      supported: support.supported,
      issues: support.issues,
      recommendations: support.recommendations
    };
  } else {
    // Desktop - check basic WebRTC support
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (!navigator.mediaDevices?.getUserMedia) {
      issues.push("Camera/microphone access not available");
      recommendations.push("Please use a modern browser like Chrome, Firefox, or Edge");
    }
    
    if (!window.RTCPeerConnection) {
      issues.push("WebRTC not supported");
      recommendations.push("Please update your browser");
    }
    
    platformSupport = {
      supported: issues.length === 0,
      issues,
      recommendations
    };
  }
  
  return {
    ...platformSupport,
    platform,
    browserInfo
  };
};

/**
 * Get optimal video constraints for current platform
 */
export const getOptimalVideoConstraints = (): MediaTrackConstraints => {
  if (isAndroid()) {
    return getAndroidVideoConstraints();
  }
  
  if (isIOS()) {
    // iOS generally works well with standard constraints
    return {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 }
    };
  }
  
  // Desktop - can handle higher quality
  return {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 }
  };
};

/**
 * Universal mobile-safe button handler
 * Handles touch events properly for iOS and Android
 */
export const createMobileSafeClickHandler = (
  handler: () => void | Promise<void>,
  options?: {
    preWarmMedia?: boolean;
    resumeAudio?: boolean;
    preventDoubleClick?: boolean;
  }
) => {
  let hasTriggered = false;
  const preventDoubleClick = options?.preventDoubleClick !== false;
  
  const executeHandler = async (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent double-triggering
    if (preventDoubleClick && hasTriggered) return;
    hasTriggered = true;
    
    // Reset after delay
    setTimeout(() => { hasTriggered = false; }, 500);
    
    // Prevent default
    e.preventDefault();
    e.stopPropagation();
    
    const platform = getPlatformType();
    
    // Platform-specific pre-warming
    if (isMobile()) {
      console.warn(`📱 [${platform.toUpperCase()}] Button tapped, preparing media/audio...`);
      
      // Resume audio context
      if (options?.resumeAudio !== false) {
        await resumeAudioContext();
      }
      
      // Pre-warm media if requested
      if (options?.preWarmMedia) {
        preWarmMedia().catch(console.error);
      }
    }
    
    // Execute handler
    try {
      await handler();
    } catch (error) {
      console.error("Error in click handler:", error);
    }
  };
  
  // Return both onClick and onTouchEnd for maximum compatibility
  return {
    onClick: executeHandler,
    onTouchEnd: isMobile() ? executeHandler : undefined,
  };
};

/**
 * Log comprehensive diagnostics for current platform
 */
export const logMobileDiagnostics = (): void => {
  const browserInfo = getBrowserInfo();
  const support = checkWebRTCSupport();
  
  console.warn("📱 [Mobile Diagnostics]", {
    ...browserInfo,
    webRTCSupported: support.supported,
    issues: support.issues,
    recommendations: support.recommendations
  });
  
  // Also log platform-specific diagnostics
  if (isIOS()) {
    logIOSDiagnostics();
  } else if (isAndroid()) {
    logAndroidDiagnostics();
  }
};

/**
 * Show user-friendly error message for WebRTC issues
 */
export const getWebRTCErrorMessage = (error: Error): string => {
  const browserInfo = getBrowserInfo();
  const errorName = error.name || '';
  const errorMessage = error.message || '';
  
  // Permission denied
  if (errorName === 'NotAllowedError' || errorMessage.includes('Permission denied')) {
    if (isIOS()) {
      return 'Camera/microphone access was denied. Please go to Settings > Safari > Camera & Microphone and allow access for this website.';
    }
    if (isAndroid()) {
      return 'Camera/microphone access was denied. Please tap the lock icon in the address bar and allow camera and microphone permissions.';
    }
    return 'Camera/microphone access was denied. Please allow permissions when prompted.';
  }
  
  // Device not found
  if (errorName === 'NotFoundError' || errorMessage.includes('not found')) {
    return 'No camera or microphone found. Please connect a camera and microphone to make video calls.';
  }
  
  // Device in use
  if (errorName === 'NotReadableError' || errorMessage.includes('in use')) {
    return 'Your camera or microphone is being used by another app. Please close other apps that might be using the camera.';
  }
  
  // Overconstrained (device can't meet requirements)
  if (errorName === 'OverconstrainedError') {
    return 'Your camera doesn\'t support the required video quality. We\'ll try with lower quality settings.';
  }
  
  // HTTPS required
  if (errorMessage.includes('HTTPS') || errorMessage.includes('secure')) {
    return 'Video calls require a secure connection (HTTPS). Please access this page using https://';
  }
  
  // Generic error with platform-specific advice
  if (browserInfo.isIOS) {
    return `Unable to access camera/microphone. On iOS, please use Safari for the best experience. Error: ${errorMessage}`;
  }
  
  if (browserInfo.isAndroid) {
    return `Unable to access camera/microphone. Please make sure you've granted permissions. Error: ${errorMessage}`;
  }
  
  return `Unable to access camera/microphone: ${errorMessage}`;
};

