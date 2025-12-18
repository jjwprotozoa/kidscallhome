// src/components/IncomingCallDialog.tsx
// Purpose: Full-screen incoming call dialog for parents - mobile-friendly design

import { Phone, PhoneOff, PhoneIncoming } from "lucide-react";
import { useEffect, useState } from "react";

interface IncomingCall {
  id: string;
  child_id: string;
  child_name: string;
  child_avatar_color: string;
}

interface IncomingCallDialogProps {
  incomingCall: IncomingCall | null;
  isAnsweringRef: React.MutableRefObject<boolean>;
  onAnswer: () => void;
  onDecline: () => void;
  onOpenChange: (open: boolean) => void;
}

export const IncomingCallDialog = ({
  incomingCall,
  isAnsweringRef,
  onAnswer,
  onDecline,
  onOpenChange,
}: IncomingCallDialogProps) => {
  // Don't render if no incoming call
  if (!incomingCall) return null;

  return (
    <IncomingCallScreen
      incomingCall={incomingCall}
      isAnsweringRef={isAnsweringRef}
      onAnswer={onAnswer}
      onDecline={onDecline}
      onOpenChange={onOpenChange}
    />
  );
};

// Separate component to use hooks properly
const IncomingCallScreen = ({
  incomingCall,
  isAnsweringRef,
  onAnswer,
  onDecline,
  onOpenChange,
}: {
  incomingCall: IncomingCall;
  isAnsweringRef: React.MutableRefObject<boolean>;
  onAnswer: () => void;
  onDecline: () => void;
  onOpenChange: (open: boolean) => void;
}) => {
  // Pulse animation state for the avatar
  const [pulseScale, setPulseScale] = useState(1);
  
  // Create pulsing animation for the avatar ring
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseScale((prev) => (prev === 1 ? 1.15 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAnswer = () => {
    if (isAnsweringRef.current) return;
    isAnsweringRef.current = true;
    onOpenChange(true); // Keep open during answer
    onAnswer();
  };

  const handleDecline = () => {
    if (isAnsweringRef.current) return;
    onDecline();
    onOpenChange(false);
  };

  // Get caller info
  const callerName = incomingCall.child_name || "Someone";
  const callerInitial = callerName[0]?.toUpperCase() || "?";
  const avatarColor = incomingCall.child_avatar_color || "#3B82F6";

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
      <div className="relative h-full flex flex-col items-center justify-between py-16 px-6 safe-area-inset">
        {/* Top section - Caller info */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          {/* Animated avatar with pulsing ring */}
          <div className="relative">
            {/* Outer pulsing ring */}
            <div 
              className="absolute inset-0 rounded-full transition-transform duration-1000 ease-in-out"
              style={{
                backgroundColor: avatarColor,
                opacity: 0.2,
                transform: `scale(${pulseScale * 1.3})`,
              }}
            />
            {/* Inner pulsing ring */}
            <div 
              className="absolute inset-0 rounded-full transition-transform duration-1000 ease-in-out"
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
          {/* Answer button - large and prominent */}
          <button
            onClick={handleAnswer}
            className="w-full py-5 px-8 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white rounded-2xl shadow-lg shadow-green-500/30 flex items-center justify-center gap-4 transition-all duration-200 active:scale-95 hover:scale-[1.02]"
          >
            <div className="bg-white/20 rounded-full p-3">
              <Phone className="w-7 h-7" />
            </div>
            <span className="text-xl font-semibold">Answer</span>
          </button>

          {/* Decline button */}
          <button
            onClick={handleDecline}
            className="w-full py-5 px-8 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white rounded-2xl shadow-lg shadow-red-500/30 flex items-center justify-center gap-4 transition-all duration-200 active:scale-95 hover:scale-[1.02]"
          >
            <div className="bg-white/20 rounded-full p-3">
              <PhoneOff className="w-7 h-7" />
            </div>
            <span className="text-xl font-semibold">Decline</span>
          </button>

          {/* Swipe hint for mobile - subtle text */}
          <p className="text-center text-white/40 text-sm pt-4">
            Tap to answer or decline
          </p>
        </div>
      </div>
    </div>
  );
};
