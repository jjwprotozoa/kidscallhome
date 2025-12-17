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
    <div className="bg-chat-accent p-4 flex items-center gap-4 fixed top-0 left-0 right-0 z-10">
      <Button
        onClick={onBack}
        variant="ghost"
        size="sm"
        className="text-white"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-3">
        {recipientAvatar && (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
            style={{
              backgroundColor: recipientAvatar.color || "#3B82F6",
            }}
          >
            {recipientAvatar.initial || recipientName[0]}
          </div>
        )}
        <h1 className="text-xl font-bold text-white">{recipientName}</h1>
      </div>
    </div>
  );
};











