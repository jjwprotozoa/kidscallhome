// src/pages/ChildDashboard/IncomingCallDialog.tsx
// Purpose: Full-screen incoming call dialog for children - fun and kid-friendly design

import { Phone, PhoneOff, PhoneIncoming } from "lucide-react";
import { IncomingCall, ChildSession } from "./types";
import { useEffect, useState } from "react";

interface IncomingCallDialogProps {
  incomingCall: IncomingCall | null;
  child: ChildSession | null;
  parentName: string;
  isAnsweringRef: React.MutableRefObject<boolean>;
  onAnswer: () => void;
  onDecline: () => void;
}

export const IncomingCallDialog = ({
  incomingCall,
  child,
  parentName,
  isAnsweringRef,
  onAnswer,
  onDecline,
}: IncomingCallDialogProps) => {
  // Don't render if no incoming call
  if (!incomingCall) return null;

  return (
    <IncomingCallScreen
      parentName={parentName}
      avatarColor={child?.avatar_color || "#8B5CF6"}
      isAnsweringRef={isAnsweringRef}
      onAnswer={onAnswer}
      onDecline={onDecline}
    />
  );
};

// Separate component to avoid hooks issues with conditional rendering
const IncomingCallScreen = ({
  parentName,
  avatarColor,
  isAnsweringRef,
  onAnswer,
  onDecline,
}: {
  parentName: string;
  avatarColor: string;
  isAnsweringRef: React.MutableRefObject<boolean>;
  onAnswer: () => void;
  onDecline: () => void;
}) => {
  // Fun bouncing animation for the phone icon
  const [bounce, setBounce] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setBounce((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleAnswer = () => {
    if (isAnsweringRef.current) return;
    isAnsweringRef.current = true;
    try {
      onAnswer();
    } catch (error) {
      console.error("Error in handleAnswer:", error);
      isAnsweringRef.current = false;
    }
  };

  const handleDecline = () => {
    // CRITICAL: Don't block decline if answer was attempted - user should always be able to decline
    onDecline();
  };

  // Get caller initial
  const callerInitial = parentName[0]?.toUpperCase() || "👋";

  return (
    <div 
      className="fixed inset-0 z-[100] bg-gradient-to-b from-violet-900 via-purple-800 to-indigo-900"
      role="alertdialog"
      aria-labelledby="incoming-call-title"
      aria-describedby="incoming-call-desc"
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
      <div className="relative h-full flex flex-col items-center justify-between py-12 px-6 safe-area-layout">
        {/* Top section - Caller info */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          {/* Big phone icon - bouncing */}
          <div 
            className="text-6xl transition-transform duration-300"
            style={{ transform: bounce ? "translateY(-10px) rotate(-10deg)" : "translateY(0) rotate(10deg)" }}
          >
            📞
          </div>

          {/* Caller avatar */}
          <div className="relative">
            {/* Glowing ring - pointer-events-none to prevent blocking button clicks */}
            <div 
              className="absolute inset-0 rounded-full animate-pulse pointer-events-none"
              style={{
                backgroundColor: avatarColor,
                opacity: 0.4,
                transform: "scale(1.2)",
                filter: "blur(15px)",
              }}
            />
            {/* Avatar */}
            <div
              className="relative w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl border-4 border-white/30"
              style={{ backgroundColor: avatarColor }}
            >
              {callerInitial}
            </div>
            {/* Phone badge */}
            <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-2 shadow-lg">
              <PhoneIncoming className="w-5 h-5 text-white animate-bounce" />
            </div>
          </div>

          {/* Caller name and status */}
          <div className="text-center space-y-3">
            <h1 
              id="incoming-call-title"
              className="text-4xl font-bold text-white tracking-tight drop-shadow-lg"
            >
              {parentName}
            </h1>
            <p 
              id="incoming-call-desc"
              className="text-xl text-white/80 flex items-center justify-center gap-3"
            >
              <span className="inline-block w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              is calling you!
            </p>
          </div>

          {/* Fun emoji decoration */}
          <div className="flex gap-4 text-3xl">
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>🎉</span>
            <span className="animate-bounce" style={{ animationDelay: "150ms" }}>✨</span>
            <span className="animate-bounce" style={{ animationDelay: "300ms" }}>💜</span>
          </div>
        </div>

        {/* Bottom section - Action buttons */}
        <div className="w-full max-w-sm space-y-4">
          {/* Answer button - big and green */}
          <button
            type="button"
            onClick={handleAnswer}
            className="w-full py-6 px-8 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-300 hover:to-emerald-400 text-white rounded-3xl shadow-lg shadow-green-500/40 flex items-center justify-center gap-4 transition-all duration-200 active:scale-95 hover:scale-[1.02] border-2 border-white/20"
            style={{ touchAction: "manipulation" }}
          >
            <div className="bg-white/30 rounded-full p-3">
              <Phone className="w-8 h-8" />
            </div>
            <span className="text-2xl font-bold">Answer</span>
          </button>

          {/* Decline button */}
          <button
            type="button"
            onClick={handleDecline}
            className="w-full py-5 px-8 bg-gradient-to-r from-red-400 to-rose-500 hover:from-red-300 hover:to-rose-400 text-white rounded-3xl shadow-lg shadow-red-500/40 flex items-center justify-center gap-4 transition-all duration-200 active:scale-95 hover:scale-[1.02] border-2 border-white/20"
            style={{ touchAction: "manipulation" }}
          >
            <div className="bg-white/30 rounded-full p-3">
              <PhoneOff className="w-7 h-7" />
            </div>
            <span className="text-xl font-bold">Not now</span>
          </button>

          {/* Hint text */}
          <p className="text-center text-white/50 text-sm pt-2">
            Tap the green button to talk!
          </p>
        </div>
      </div>
    </div>
  );
};
