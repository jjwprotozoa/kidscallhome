// src/features/calls/components/ChildOutgoingCallUI.tsx
// Full-screen outgoing call UI for children - fun and kid-friendly design
// Matches the child incoming call theme with purple gradient and sparkles

import { PhoneOff, Phone } from "lucide-react";
import { useEffect, useState } from "react";

interface ChildOutgoingCallUIProps {
  calleeName: string;
  calleeAvatarColor?: string;
  onEndCall: () => void;
}

export const ChildOutgoingCallUI = ({
  calleeName,
  calleeAvatarColor = "#8B5CF6",
  onEndCall,
}: ChildOutgoingCallUIProps) => {
  // Fun bouncing animation for the phone icon
  const [bounce, setBounce] = useState(false);
  const [dotIndex, setDotIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setBounce((prev) => !prev);
    }, 500);
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

  // Get callee initial
  const calleeInitial = calleeName[0]?.toUpperCase() || "?";

  return (
    <div 
      className="fixed inset-0 z-[100] bg-gradient-to-b from-violet-900 via-purple-800 to-indigo-900"
      role="status"
      aria-label={`Calling ${calleeName}`}
    >
      {/* Animated background stars/sparkles for kids */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated circles */}
        <div 
          className="absolute top-1/4 left-1/4 w-4 h-4 bg-yellow-300 rounded-full animate-ping opacity-60"
          style={{ animationDuration: "2s" }}
        />
        <div 
          className="absolute top-1/3 right-1/4 w-3 h-3 bg-pink-300 rounded-full animate-ping opacity-60"
          style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
        />
        <div 
          className="absolute bottom-1/3 left-1/3 w-5 h-5 bg-cyan-300 rounded-full animate-ping opacity-60"
          style={{ animationDuration: "3s", animationDelay: "1s" }}
        />
        <div 
          className="absolute top-1/2 right-1/3 w-3 h-3 bg-green-300 rounded-full animate-ping opacity-60"
          style={{ animationDuration: "2.2s", animationDelay: "0.3s" }}
        />
        
        {/* Large pulsing rings behind avatar */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="absolute w-[350px] h-[350px] rounded-full border-2 border-white/10 animate-ping"
            style={{ animationDuration: "3s" }}
          />
          <div 
            className="absolute w-[250px] h-[250px] rounded-full border-2 border-white/15 animate-ping"
            style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
          />
        </div>
      </div>

      {/* Main content - centered */}
      <div className="relative h-full flex flex-col items-center justify-between py-12 px-6 safe-area-inset">
        {/* Top section - Callee info */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          {/* Big phone icon - bouncing */}
          <div 
            className="text-6xl transition-transform duration-300"
            style={{ transform: bounce ? "translateY(-10px) rotate(-10deg)" : "translateY(0) rotate(10deg)" }}
          >
            📞
          </div>

          {/* Callee avatar */}
          <div className="relative">
            {/* Glowing ring */}
            <div 
              className="absolute inset-0 rounded-full animate-pulse"
              style={{
                backgroundColor: calleeAvatarColor,
                opacity: 0.4,
                transform: "scale(1.2)",
                filter: "blur(15px)",
              }}
            />
            {/* Avatar */}
            <div
              className="relative w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl border-4 border-white/30"
              style={{ backgroundColor: calleeAvatarColor }}
            >
              {calleeInitial}
            </div>
            {/* Phone badge - ringing */}
            <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-2 shadow-lg">
              <Phone 
                className="w-5 h-5 text-white" 
                style={{ animation: "ring 1s ease-in-out infinite" }}
              />
            </div>
          </div>

          {/* Callee name and status */}
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-lg">
              {calleeName}
            </h1>
            <p className="text-xl text-white/80 flex items-center justify-center gap-3">
              <span className="inline-block w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              <span className="min-w-[120px]">Calling{dots}</span>
            </p>
          </div>

          {/* Fun emoji decoration */}
          <div className="flex gap-4 text-3xl">
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>🎉</span>
            <span className="animate-bounce" style={{ animationDelay: "150ms" }}>✨</span>
            <span className="animate-bounce" style={{ animationDelay: "300ms" }}>💜</span>
          </div>

          {/* Status text */}
          <p className="text-white/60 text-sm">
            Waiting for them to answer...
          </p>
        </div>

        {/* Bottom section - End call button */}
        <div className="w-full max-w-sm space-y-4">
          {/* End Call button */}
          <button
            onClick={onEndCall}
            className="w-full py-5 px-8 bg-gradient-to-r from-red-400 to-rose-500 hover:from-red-300 hover:to-rose-400 text-white rounded-3xl shadow-lg shadow-red-500/40 flex items-center justify-center gap-4 transition-all duration-200 active:scale-95 hover:scale-[1.02] border-2 border-white/20"
          >
            <div className="bg-white/30 rounded-full p-3">
              <PhoneOff className="w-7 h-7" />
            </div>
            <span className="text-xl font-bold">Hang Up</span>
          </button>

          {/* Hint text */}
          <p className="text-center text-white/50 text-sm pt-2">
            Tap if you don't want to call anymore
          </p>
        </div>
      </div>

      {/* CSS Animation for phone ring */}
      <style>{`
        @keyframes ring {
          0%, 100% { transform: rotate(-15deg); }
          50% { transform: rotate(15deg); }
        }
      `}</style>
    </div>
  );
};

export default ChildOutgoingCallUI;

