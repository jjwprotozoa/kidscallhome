// src/features/messaging/components/MessageInput.tsx
// Message input component for sending messages

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { FormEvent } from "react";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const MessageInput = ({
  value,
  onChange,
  onSubmit,
  loading,
  disabled = false,
  placeholder = "Type a message...",
}: MessageInputProps) => {
  return (
    <form
      onSubmit={onSubmit}
      className="p-4 bg-card border-t fixed bottom-0 left-0 right-0 z-10"
    >
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={loading || disabled}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={loading || !value.trim() || disabled}
          className="bg-chat-accent text-chat-accent-foreground hover:bg-chat-accent/90"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};



