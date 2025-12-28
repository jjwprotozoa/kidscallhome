// src/features/messaging/components/ChatHeader.tsx
// Chat header component showing recipient info and back button

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface ChatHeaderProps {
  recipientName: string;
  recipientAvatar?: {
    color?: string;
    initial?: string;
  };
  onBack: () => void;
}

export const ChatHeader = ({
  recipientName,
  recipientAvatar,
  onBack,
}: ChatHeaderProps) => {
  return (
    <div 
      className="flex items-center gap-4 fixed top-0 left-0 right-0 z-10 shadow-md"
      style={{
        backgroundColor: "hsl(142, 75%, 35%)", // Darker green for better contrast (WCAG AA compliant)
        color: "#ffffff",
        borderBottom: "1px solid rgba(0, 0, 0, 0.1)", // Subtle border for definition
        paddingTop: "calc(1rem + var(--safe-area-inset-top))",
        paddingBottom: "1rem",
        paddingLeft: "1rem",
        paddingRight: "1rem",
      }}
    >
      <Button
        onClick={onBack}
        variant="ghost"
        size="sm"
        className="text-white font-semibold hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
      </Button>
      <div className="flex items-center gap-3">
        {recipientAvatar && (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm border-2 border-white/30"
            style={{
              backgroundColor: recipientAvatar.color || "#3B82F6",
            }}
          >
            {recipientAvatar.initial || recipientName[0]}
          </div>
        )}
        <h1 className="text-xl font-bold text-white drop-shadow-sm">{recipientName}</h1>
      </div>
    </div>
  );
};














