// src/utils/iosCompatibility.ts
// iOS browser compatibility utilities for WebRTC calls
// Handles differences between Safari, Chrome, and other iOS browsers

/**
 * Detect if running on iOS
 */
export const isIOS = (): boolean => {
  if (typeof window === "undefined") return false;
  
  // Check for iOS-specific properties
  const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad on iOS 13+ reports as Mac
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  return isIOSDevice;
};

/**
 * Detect if running in Safari (not Chrome/Firefox on iOS)
 */
export const isIOSSafari = (): boolean => {
  if (!isIOS()) return false;
  
  const ua = navigator.userAgent;
  // Safari on iOS doesn't include "CriOS" (Chrome) or "FxiOS" (Firefox)
  return !ua.includes('CriOS') && !ua.includes('FxiOS') && ua.includes('Safari');
};

/**
 * Detect if running in Chrome on iOS
 */
export const isIOSChrome = (): boolean => {
  if (!isIOS()) return false;
  return navigator.userAgent.includes('CriOS');
};

/**
 * Pre-warm media for iOS
 * iOS requires getUserMedia to be called in direct response to user gesture
 * This should be called immediately when user taps the answer button
 */
export const preWarmIOSMedia = async (): Promise<MediaStream | null> => {
  if (!isIOS()) return null;
  
  try {
    console.warn("📱 [iOS] Pre-warming media on user gesture");
    
    // Request media immediately - this must happen in direct response to user gesture
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: "user" }
    });
    
    console.warn("✅ [iOS] Media pre-warmed successfully", {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length
    });
    
    return stream;
  } catch (error) {
    console.error("❌ [iOS] Failed to pre-warm media:", error);
    return null;
  }
};

/**
 * Resume AudioContext on iOS
 * Must be called in direct response to user gesture
 */
export const resumeIOSAudioContext = async (audioContext?: AudioContext): Promise<void> => {
  if (!isIOS()) return;
  
  try {
    // Create or resume AudioContext
    const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
      console.warn("✅ [iOS] AudioContext resumed");
    }
    
    // Play a silent sound to fully unlock audio on iOS
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0; // Silent
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.001);
    
    console.warn("✅ [iOS] Audio unlocked with silent sound");
  } catch (error) {
    console.error("❌ [iOS] Failed to resume AudioContext:", error);
  }
};

/**
 * iOS-safe button handler
 * Wraps onClick to ensure it works on both Safari and Chrome on iOS
 * Handles the 300ms delay and touch event issues
 */
export const createIOSSafeClickHandler = (
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
    
    // Reset after a short delay to allow re-clicking if needed
    setTimeout(() => { hasTriggered = false; }, 500);
    
    // Prevent default to avoid any iOS quirks
    e.preventDefault();
    e.stopPropagation();
    
    // iOS-specific pre-warming (must happen immediately on user gesture)
    if (isIOS()) {
      console.warn("📱 [iOS] Button tapped, preparing media/audio...");
      
      // Resume audio context immediately
      if (options?.resumeAudio !== false) {
        resumeIOSAudioContext();
      }
      
      // Pre-warm media if requested
      if (options?.preWarmMedia) {
        // Don't await - let it run in parallel with the handler
        preWarmIOSMedia().catch(console.error);
      }
    }
    
    // Execute the actual handler
    try {
      await handler();
    } catch (error) {
      console.error("Error in click handler:", error);
    }
  };
  
  return {
    onClick: executeHandler,
    onTouchEnd: (e: React.TouchEvent) => {
      // On iOS, touchEnd is more reliable than click in some cases
      if (isIOS()) {
        executeHandler(e);
      }
    },
  };
};

/**
 * Check if WebRTC is fully supported on this iOS browser
 */
export const checkIOSWebRTCSupport = (): {
  supported: boolean;
  issues: string[];
  recommendations: string[];
} => {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  if (!isIOS()) {
    return { supported: true, issues: [], recommendations: [] };
  }
  
  // Check getUserMedia
  if (!navigator.mediaDevices?.getUserMedia) {
    issues.push("Camera/microphone access not available");
    recommendations.push("Please use Safari on iOS for the best experience");
  }
  
  // Check RTCPeerConnection
  if (!window.RTCPeerConnection) {
    issues.push("WebRTC not supported");
    recommendations.push("Please update to the latest iOS version");
  }
  
  // Check if HTTPS (required for getUserMedia on iOS)
  if (window.location.protocol !== 'https:' && 
      !window.location.hostname.includes('localhost')) {
    issues.push("Secure connection required");
    recommendations.push("Video calls require HTTPS on iOS");
  }
  
  // iOS Chrome has some WebRTC limitations
  if (isIOSChrome()) {
    recommendations.push("For best results on iOS, use Safari browser");
  }
  
  return {
    supported: issues.length === 0,
    issues,
    recommendations
  };
};

/**
 * Log iOS diagnostic info
 */
export const logIOSDiagnostics = (): void => {
  if (!isIOS()) return;
  
  console.warn("📱 [iOS Diagnostics]", {
    isIOS: isIOS(),
    isIOSSafari: isIOSSafari(),
    isIOSChrome: isIOSChrome(),
    userAgent: navigator.userAgent,
    protocol: window.location.protocol,
    hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
    hasRTCPeerConnection: !!window.RTCPeerConnection,
    ...checkIOSWebRTCSupport()
  });
};

