// src/utils/androidCompatibility.ts
// Android browser compatibility utilities for WebRTC calls
// Handles differences between Chrome, Samsung Internet, Firefox, and other Android browsers

/**
 * Detect if running on Android
 */
export const isAndroid = (): boolean => {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
};

/**
 * Detect if running in Chrome on Android
 */
export const isAndroidChrome = (): boolean => {
  if (!isAndroid()) return false;
  return /Chrome/i.test(navigator.userAgent) && !/Edge|Edg/i.test(navigator.userAgent);
};

/**
 * Detect if running in Samsung Internet
 */
export const isSamsungInternet = (): boolean => {
  if (!isAndroid()) return false;
  return /SamsungBrowser/i.test(navigator.userAgent);
};

/**
 * Detect if running in Firefox on Android
 */
export const isAndroidFirefox = (): boolean => {
  if (!isAndroid()) return false;
  return /Firefox/i.test(navigator.userAgent);
};

/**
 * Detect if running in Android WebView (embedded browser)
 */
export const isAndroidWebView = (): boolean => {
  if (!isAndroid()) return false;
  const ua = navigator.userAgent;
  // WebView indicators
  return ua.includes('wv') || 
         (ua.includes('Android') && ua.includes('Version/') && !ua.includes('Chrome'));
};

/**
 * Get Android version number
 */
export const getAndroidVersion = (): number | null => {
  if (!isAndroid()) return null;
  
  const match = navigator.userAgent.match(/Android\s+(\d+(\.\d+)?)/i);
  if (match && match[1]) {
    return parseFloat(match[1]);
  }
  return null;
};

/**
 * Pre-warm media for Android
 * Some Android browsers benefit from requesting permissions early
 */
export const preWarmAndroidMedia = async (): Promise<MediaStream | null> => {
  if (!isAndroid()) return null;
  
  try {
    console.warn("🤖 [Android] Pre-warming media on user gesture");
    
    // Request media - Android is generally more lenient than iOS
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { 
        facingMode: "user",
        // Android often works better with explicit constraints
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    });
    
    console.warn("✅ [Android] Media pre-warmed successfully", {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length
    });
    
    return stream;
  } catch (error) {
    console.error("❌ [Android] Failed to pre-warm media:", error);
    return null;
  }
};

/**
 * Resume AudioContext on Android
 * Android Chrome requires user gesture for AudioContext
 */
export const resumeAndroidAudioContext = async (audioContext?: AudioContext): Promise<AudioContext | null> => {
  if (!isAndroid()) return null;
  
  try {
    // Create or use existing AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = audioContext || new AudioContextClass();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
      console.warn("✅ [Android] AudioContext resumed, state:", ctx.state);
    }
    
    return ctx;
  } catch (error) {
    console.error("❌ [Android] Failed to resume AudioContext:", error);
    return null;
  }
};

/**
 * Check if WebRTC is fully supported on this Android browser
 */
export const checkAndroidWebRTCSupport = (): {
  supported: boolean;
  issues: string[];
  recommendations: string[];
  browserInfo: {
    isChrome: boolean;
    isSamsung: boolean;
    isFirefox: boolean;
    isWebView: boolean;
    version: number | null;
  };
} => {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  const browserInfo = {
    isChrome: isAndroidChrome(),
    isSamsung: isSamsungInternet(),
    isFirefox: isAndroidFirefox(),
    isWebView: isAndroidWebView(),
    version: getAndroidVersion()
  };
  
  if (!isAndroid()) {
    return { supported: true, issues: [], recommendations: [], browserInfo };
  }
  
  // Check getUserMedia
  if (!navigator.mediaDevices?.getUserMedia) {
    issues.push("Camera/microphone access not available");
    recommendations.push("Please use Chrome browser for the best experience");
  }
  
  // Check RTCPeerConnection
  if (!window.RTCPeerConnection) {
    issues.push("WebRTC not supported");
    recommendations.push("Please update your browser to the latest version");
  }
  
  // Check Android version (WebRTC works best on Android 5+)
  const version = getAndroidVersion();
  if (version && version < 5) {
    issues.push("Android version may not fully support video calls");
    recommendations.push("Consider updating to Android 5 or later for best results");
  }
  
  // WebView has limited WebRTC support
  if (isAndroidWebView()) {
    recommendations.push("For best results, open this link in Chrome or your default browser");
  }
  
  // Samsung Internet specific
  if (isSamsungInternet()) {
    recommendations.push("Samsung Internet works well, but Chrome may provide better compatibility");
  }
  
  return {
    supported: issues.length === 0,
    issues,
    recommendations,
    browserInfo
  };
};

/**
 * Android-safe button handler
 * Handles touch events properly for various Android browsers
 */
export const createAndroidSafeClickHandler = (
  handler: () => void | Promise<void>,
  options?: {
    preWarmMedia?: boolean;
    resumeAudio?: boolean;
  }
) => {
  let hasTriggered = false;
  
  const executeHandler = async (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent double-triggering
    if (hasTriggered) return;
    hasTriggered = true;
    
    // Reset after a short delay
    setTimeout(() => { hasTriggered = false; }, 500);
    
    // Prevent default
    e.preventDefault();
    e.stopPropagation();
    
    // Android-specific pre-warming
    if (isAndroid()) {
      console.warn("🤖 [Android] Button tapped, preparing media/audio...");
      
      // Resume audio context
      if (options?.resumeAudio !== false) {
        resumeAndroidAudioContext();
      }
      
      // Pre-warm media if requested
      if (options?.preWarmMedia) {
        preWarmAndroidMedia().catch(console.error);
      }
    }
    
    // Execute handler
    try {
      await handler();
    } catch (error) {
      console.error("Error in click handler:", error);
    }
  };
  
  return {
    onClick: executeHandler,
    onTouchEnd: (e: React.TouchEvent) => {
      // Some Android browsers work better with touchEnd
      if (isAndroid()) {
        executeHandler(e);
      }
    },
  };
};

/**
 * Fix common Android WebRTC issues
 * Call this when initializing a call on Android
 */
export const applyAndroidWebRTCFixes = (peerConnection: RTCPeerConnection): void => {
  if (!isAndroid()) return;
  
  console.warn("🤖 [Android] Applying WebRTC fixes...");
  
  // Some Android devices need explicit DTLS role
  // This is handled by the browser usually, but can help on older devices
  
  // Log ICE candidate gathering for debugging
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.warn(`🤖 [Android] ICE gathering state: ${peerConnection.iceGatheringState}`);
  });
  
  // Handle connection state changes
  peerConnection.addEventListener('connectionstatechange', () => {
    console.warn(`🤖 [Android] Connection state: ${peerConnection.connectionState}`);
    
    // On Android, sometimes the connection gets stuck - provide feedback
    if (peerConnection.connectionState === 'failed') {
      console.error("🤖 [Android] Connection failed - may need to retry");
    }
  });
};

/**
 * Get optimal video constraints for Android device
 */
export const getAndroidVideoConstraints = (): MediaTrackConstraints => {
  if (!isAndroid()) {
    return { facingMode: "user" };
  }
  
  const version = getAndroidVersion();
  
  // Older Android devices work better with lower resolution
  if (version && version < 8) {
    return {
      facingMode: "user",
      width: { ideal: 480, max: 640 },
      height: { ideal: 360, max: 480 },
      frameRate: { ideal: 15, max: 24 }
    };
  }
  
  // Modern Android devices can handle higher quality
  return {
    facingMode: "user",
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 24, max: 30 }
  };
};

/**
 * Log Android diagnostic info
 */
export const logAndroidDiagnostics = (): void => {
  if (!isAndroid()) return;
  
  const support = checkAndroidWebRTCSupport();
  
  console.warn("🤖 [Android Diagnostics]", {
    isAndroid: isAndroid(),
    isChrome: isAndroidChrome(),
    isSamsung: isSamsungInternet(),
    isFirefox: isAndroidFirefox(),
    isWebView: isAndroidWebView(),
    androidVersion: getAndroidVersion(),
    userAgent: navigator.userAgent,
    protocol: window.location.protocol,
    hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
    hasRTCPeerConnection: !!window.RTCPeerConnection,
    ...support
  });
};



