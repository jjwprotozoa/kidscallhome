// src/features/calls/components/OutgoingCallUI.tsx
// Full-screen outgoing call UI - matches the incoming call and video call theme

import { PhoneOff, Phone } from "lucide-react";
import { useEffect, useState } from "react";

interface OutgoingCallUIProps {
  calleeName: string;
  calleeAvatarColor?: string;
  onEndCall: () => void;
}

export const OutgoingCallUI = ({
  calleeName,
  calleeAvatarColor = "#3B82F6",
  onEndCall,
}: OutgoingCallUIProps) => {
  // Pulse animation state for the avatar
  const [pulseScale, setPulseScale] = useState(1);
  const [dotIndex, setDotIndex] = useState(0);
  
  // Create pulsing animation for the avatar ring
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseScale((prev) => (prev === 1 ? 1.15 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Animated dots for "Calling..."
  useEffect(() => {
    const interval = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const dots = ".".repeat(dotIndex);

  // Get caller initial
  const calleeInitial = calleeName[0]?.toUpperCase() || "?";

  return (
    <div 
      className="fixed inset-0 z-[100] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900"
      role="status"
      aria-label={`Calling ${calleeName}`}
    >
      {/* Animated background rings */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div 
          className="absolute w-[400px] h-[400px] rounded-full border border-white/5 animate-ping"
          style={{ animationDuration: "3s" }}
        />
        <div 
          className="absolute w-[300px] h-[300px] rounded-full border border-white/10 animate-ping"
          style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
        />
        <div 
          className="absolute w-[200px] h-[200px] rounded-full border border-white/15 animate-ping"
          style={{ animationDuration: "2s", animationDelay: "1s" }}
        />
      </div>

      {/* Main content - centered */}
      <div className="relative h-full flex flex-col items-center justify-between py-16 px-6 safe-area-inset">
        {/* Top section - Callee info */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          {/* Animated avatar with pulsing ring */}
          <div className="relative">
            {/* Outer pulsing ring */}
            <div 
              className="absolute inset-0 rounded-full transition-transform duration-1000 ease-in-out"
              style={{
                backgroundColor: calleeAvatarColor,
                opacity: 0.2,
                transform: `scale(${pulseScale * 1.3})`,
              }}
            />
            {/* Inner pulsing ring */}
            <div 
              className="absolute inset-0 rounded-full transition-transform duration-1000 ease-in-out"
              style={{
                backgroundColor: calleeAvatarColor,
                opacity: 0.3,
                transform: `scale(${pulseScale * 1.15})`,
              }}
            />
            {/* Avatar */}
            <div
              className="relative w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl border-4 border-white/20"
              style={{ backgroundColor: calleeAvatarColor }}
            >
              {calleeInitial}
            </div>
            {/* Phone icon badge - ringing animation */}
            <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 shadow-lg">
              <Phone 
                className="w-5 h-5 text-white" 
                style={{ 
                  animation: "ring 1s ease-in-out infinite",
                }}
              />
            </div>
          </div>

          {/* Callee name and status */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {calleeName}
            </h1>
            <p className="text-lg text-white/70 flex items-center justify-center gap-2">
              <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="min-w-[140px]">Calling{dots}</span>
            </p>
          </div>

          {/* Ringing indicator - animated sound waves */}
          <div className="flex items-center justify-center gap-1 h-12">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-1.5 bg-blue-400/60 rounded-full"
                style={{
                  height: "100%",
                  animation: "soundWave 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>

          {/* Status text */}
          <p className="text-white/50 text-sm">
            Waiting for answer...
          </p>
        </div>

        {/* Bottom section - End call button */}
        <div className="w-full max-w-sm">
          {/* End Call button */}
          <button
            onClick={onEndCall}
            className="w-full py-5 px-8 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white rounded-2xl shadow-lg shadow-red-500/30 flex items-center justify-center gap-4 transition-all duration-200 active:scale-95 hover:scale-[1.02]"
          >
            <div className="bg-white/20 rounded-full p-3">
              <PhoneOff className="w-7 h-7" />
            </div>
            <span className="text-xl font-semibold">End Call</span>
          </button>

          {/* Hint text */}
          <p className="text-center text-white/40 text-sm pt-4">
            Tap to cancel the call
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes ring {
          0%, 100% { transform: rotate(-15deg); }
          50% { transform: rotate(15deg); }
        }
        @keyframes soundWave {
          0%, 100% { transform: scaleY(0.3); opacity: 0.4; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default OutgoingCallUI;

