// src/components/GlobalIncomingCall/IncomingCallUI.tsx
// Purpose: Full-screen incoming call notification - mobile-friendly design
// Matches the video call theme for a seamless experience

import { Phone, PhoneOff, PhoneIncoming } from "lucide-react";
import { IncomingCall } from "./types";
import { useEffect, useState } from "react";

interface IncomingCallUIProps {
  incomingCall: IncomingCall;
  isAnsweringRef: React.MutableRefObject<boolean>;
  onAnswer: () => void;
  onDecline: () => void;
}

export const IncomingCallUI = ({
  incomingCall,
  isAnsweringRef,
  onAnswer,
  onDecline,
}: IncomingCallUIProps) => {
  // Pulse animation state for the avatar
  const [pulseScale, setPulseScale] = useState(1);
  
  // Create pulsing animation for the avatar ring
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseScale((prev) => (prev === 1 ? 1.15 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get caller name and initial
  const callerName = incomingCall.child_name || incomingCall.parent_name || "Someone";
  const callerInitial = callerName[0]?.toUpperCase() || "?";
  const avatarColor = incomingCall.child_avatar_color || "#3B82F6";

  const handleAnswer = () => {
    // Don't check/set isAnsweringRef here - let GlobalIncomingCall.handleAnswerCall handle it
    // to avoid race condition where we set it true before the parent checks it
    onAnswer();
  };

  const handleDecline = () => {
    // CRITICAL: Don't block decline if answer was attempted - user should always be able to decline
    // Only block if we're actively processing a decline
    onDecline();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900"
      role="alertdialog"
      aria-labelledby="incoming-call-title"
      aria-describedby="incoming-call-desc"
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
      <div className="relative z-10 h-full flex flex-col items-center justify-between py-8 sm:py-16 px-6 safe-area-layout">
        {/* Top section - Caller info */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          {/* Animated avatar with pulsing ring */}
          <div className="relative">
            {/* Outer pulsing ring - pointer-events-none to prevent blocking button clicks */}
            <div 
              className="absolute inset-0 rounded-full transition-transform duration-1000 ease-in-out pointer-events-none"
              style={{
                backgroundColor: avatarColor,
                opacity: 0.2,
                transform: `scale(${pulseScale * 1.3})`,
              }}
            />
            {/* Inner pulsing ring - pointer-events-none to prevent blocking button clicks */}
            <div 
              className="absolute inset-0 rounded-full transition-transform duration-1000 ease-in-out pointer-events-none"
              style={{
                backgroundColor: avatarColor,
                opacity: 0.3,
                transform: `scale(${pulseScale * 1.15})`,
              }}
            />
            {/* Avatar */}
            <div
              className="relative w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl border-4 border-white/20"
              style={{ backgroundColor: avatarColor }}
            >
              {callerInitial}
            </div>
            {/* Phone icon badge */}
            <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 shadow-lg animate-bounce">
              <PhoneIncoming className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Caller name and status */}
          <div className="text-center space-y-2">
            <h1 
              id="incoming-call-title"
              className="text-3xl font-bold text-white tracking-tight"
            >
              {callerName}
            </h1>
            <p 
              id="incoming-call-desc"
              className="text-lg text-white/70 flex items-center justify-center gap-2"
            >
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Incoming video call...
            </p>
          </div>
        </div>

        {/* Bottom section - Action buttons */}
        <div className="w-full max-w-sm space-y-4">
          {/* Answer button - big and green (matches working child UI) */}
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
            <span className="text-xl font-bold">Decline</span>
          </button>

          {/* Hint text */}
          <p className="text-center text-white/40 text-sm pt-2">
            Tap to answer or decline
          </p>
        </div>
      </div>
    </div>
  );
};
