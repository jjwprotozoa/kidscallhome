# Solution: Fix Video and Audio Not Working After Call Connects

## Problem Identified
The call connects (ICE state shows "connected") but video/audio doesn't appear. This happens because:
1. The video element's `srcObject` is set but the video isn't playing
2. Browser autoplay policies may block video playback without user interaction
3. The `playRemoteVideo` function in `useWebRTC` hook isn't being called after the connection is established

## THE FIX

### Step 1: Update `VideoCallUI.tsx` to force play video when stream is available

Replace the current `VideoCallUI.tsx` with this updated version that aggressively tries to play the video:

```typescript
// src/components/call/VideoCallUI.tsx
// Video call UI layout component

import { useEffect, useRef } from "react";
import { CallControls } from "./CallControls";

interface VideoCallUIProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  remoteStream: MediaStream | null;
  isConnecting: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

export const VideoCallUI = ({
  localVideoRef,
  remoteVideoRef,
  remoteStream,
  isConnecting,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
}: VideoCallUIProps) => {
  const playAttemptedRef = useRef(false);

  // CRITICAL FIX: Aggressively try to play video when remote stream changes
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      const video = remoteVideoRef.current;
      
      // Ensure srcObject is set
      if (video.srcObject !== remoteStream) {
        console.log("🎬 [VIDEO UI] Setting remote stream to video element");
        video.srcObject = remoteStream;
      }

      // Function to attempt play
      const attemptPlay = async () => {
        if (video.paused) {
          try {
            console.log("🎬 [VIDEO UI] Attempting to play remote video");
            await video.play();
            console.log("✅ [VIDEO UI] Remote video started playing successfully");
            playAttemptedRef.current = true;
          } catch (error: any) {
            if (error.name === 'NotAllowedError') {
              console.log("⏳ [VIDEO UI] Autoplay blocked, waiting for user interaction");
              // Don't set playAttemptedRef to true so we can retry on click
            } else if (error.name !== 'AbortError') {
              console.error("❌ [VIDEO UI] Error playing video:", error);
              // Retry after a delay
              setTimeout(attemptPlay, 500);
            }
          }
        }
      };

      // Try to play immediately
      attemptPlay();

      // Also set up event listeners to try again when ready
      const handleCanPlay = () => attemptPlay();
      const handleLoadedMetadata = () => attemptPlay();
      
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);

      // Monitor track unmute events
      const tracks = remoteStream.getTracks();
      tracks.forEach(track => {
        const handleUnmute = () => {
          console.log("✅ [VIDEO UI] Track unmuted:", track.kind);
          attemptPlay();
        };
        track.addEventListener('unmute', handleUnmute);
      });

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [remoteStream, remoteVideoRef]);

  const handleVideoClick = () => {
    // User interaction - try to play video if it's not playing
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      if (remoteVideoRef.current.paused) {
        console.log("🎬 [VIDEO UI] User clicked - attempting to play video");
        remoteVideoRef.current.play()
          .then(() => {
            console.log("✅ [VIDEO UI] Video started playing after user click");
            playAttemptedRef.current = true;
          })
          .catch((error) => {
            console.error("❌ [VIDEO UI] Error playing video on click:", error);
          });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black" onClick={handleVideoClick}>
      <div className="relative h-full w-full">
        {/* Remote video (full screen) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={false}
          volume={1.0}
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#000' }}
        />

        {/* Connection status - show if no stream OR if video is paused (autoplay blocked) */}
        {(!remoteStream || (remoteVideoRef.current?.paused && !playAttemptedRef.current)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center space-y-4">
              <div className="text-6xl">📞</div>
              <p className="text-white text-2xl">
                {isConnecting ? "Connecting..." : 
                 remoteStream && remoteVideoRef.current?.paused ? "Click to start video" :
                 "Waiting for other person..."}
              </p>
              {remoteStream && remoteVideoRef.current?.paused && !playAttemptedRef.current && (
                <p className="text-white text-lg opacity-75">
                  Browser requires user interaction to play video
                </p>
              )}
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        <div className="absolute top-4 right-4 w-48 h-36 rounded-2xl overflow-hidden shadow-xl border-2 border-white">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Controls */}
        <CallControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleMute={onToggleMute}
          onToggleVideo={onToggleVideo}
          onEndCall={onEndCall}
        />
      </div>
    </div>
  );
};
```

### Step 2: Call `playRemoteVideo` when answering calls

If you have a component that handles answering calls, make sure to call `playRemoteVideo()` after the user clicks "Answer". For example, in your parent or child dashboard:

```typescript
const handleAnswer = async () => {
  // ... existing answer logic ...
  
  // After successfully answering, try to play the video
  // This provides the user interaction needed for autoplay
  setTimeout(() => {
    playRemoteVideo(); // Call this from useWebRTC hook
  }, 100);
};
```

### Step 3: Verify TURN servers are working

The current TURN servers in your code are public test servers. For production, you should use reliable TURN servers. Update in `useWebRTC.ts`:

```typescript
const pc = new RTCPeerConnection({
  iceServers: [
    // Google STUN servers (these are fine)
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    
    // Add more reliable TURN servers
    // Option 1: Metered TURN (get your own credentials at https://www.metered.ca/stun-turn)
    {
      urls: "turn:a.relay.metered.ca:80",
      username: "YOUR_USERNAME",
      credential: "YOUR_CREDENTIAL",
    },
    {
      urls: "turn:a.relay.metered.ca:443",
      username: "YOUR_USERNAME", 
      credential: "YOUR_CREDENTIAL",
    },
    
    // Option 2: Twillio (paid service)
    // Get credentials from https://www.twilio.com/stun-turn
  ],
  iceCandidatePoolSize: 10,
});
```

## Testing Instructions

1. **Open browser console** on both devices
2. **Initiate a call** from either parent or child
3. **Look for these console logs**:
   - `✅ [VIDEO UI] Remote video started playing successfully` - Video is playing
   - `⏳ [VIDEO UI] Autoplay blocked, waiting for user interaction` - Click the screen
   - `✅ [REMOTE TRACK] Track unmuted - MEDIA IS FLOWING!` - Media is being received

4. **If video doesn't start automatically**:
   - Click anywhere on the screen (this provides user interaction for autoplay)
   - The overlay will show "Click to start video" if autoplay is blocked

## Quick Test

1. Replace `VideoCallUI.tsx` with the code above
2. Test a call between two devices
3. If video doesn't start, click the screen on the receiving device

## Additional Debugging

If the issue persists, check:

1. **Network**: Are both devices on the same network? If not, TURN servers are required
2. **Firewall**: Corporate/school networks may block WebRTC
3. **Browser permissions**: Camera/microphone must be allowed
4. **HTTPS**: iOS requires HTTPS for camera access (use ngrok for testing)

## Console Commands for Debugging

Run these in the browser console to check the connection state:

```javascript
// Check if peer connection exists and its state
if (window.pc) {
  console.log('Connection State:', window.pc.connectionState);
  console.log('ICE State:', window.pc.iceConnectionState);
  console.log('Signaling State:', window.pc.signalingState);
  
  // Check remote streams
  const receivers = window.pc.getReceivers();
  receivers.forEach(r => {
    if (r.track) {
      console.log('Track:', r.track.kind, 'Muted:', r.track.muted, 'Enabled:', r.track.enabled);
    }
  });
}

// Force play video
const video = document.querySelector('video:not([muted])');
if (video && video.paused) {
  video.play().then(() => console.log('Video playing')).catch(e => console.error('Play failed:', e));
}
```

This should fix your video/audio issues. The main problem is that the video element needs to be explicitly told to play, and browser autoplay policies may require user interaction.
