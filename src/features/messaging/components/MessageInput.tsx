// src/features/messaging/components/MessageInput.tsx
// Message input component for sending messages

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { checkBlockedWords } from "@/lib/wordFilter";
import { Send, Smile, AlertTriangle } from "lucide-react";
import { FormEvent, useState, useEffect } from "react";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
  disabled?: boolean;
  placeholder?: string;
  customKeywords?: string[]; // Optional custom keywords from safety settings
}

// Common emojis for quick selection
const commonEmojis = [
  "😊", "❤️", "👍", "👎", "😢", "😄", "🎉", "🔥",
  "💕", "🌟", "😍", "🤔", "😂", "😭", "🙌", "👏",
  "🎊", "🎈", "🎁", "💯", "✨", "⭐", "💖", "💝",
  "😎", "🤗", "😘", "🥰", "😋", "🤩", "😇", "🙏",
];

export const MessageInput = ({
  value,
  onChange,
  onSubmit,
  loading,
  disabled = false,
  placeholder = "Type a message...",
  customKeywords = [],
}: MessageInputProps) => {
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleEmojiSelect = (emoji: string) => {
    onChange(value + emoji);
    setIsEmojiOpen(false);
  };

  // Check for blocked words as user types (done locally, no server calls)
  useEffect(() => {
    if (value.trim()) {
      const { isBlocked, matchedWords } = checkBlockedWords(value, customKeywords);
      if (isBlocked) {
        setBlockedMessage(
          `Please remove inappropriate words: ${matchedWords.join(", ")}`
        );
      } else {
        setBlockedMessage(null);
      }
    } else {
      setBlockedMessage(null);
    }
  }, [value, customKeywords]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Final check before submitting
    const { isBlocked, matchedWords } = checkBlockedWords(value, customKeywords);
    
    if (isBlocked) {
      toast({
        title: "Message blocked",
        description: `Your message contains inappropriate words. Please remove: ${matchedWords.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    onSubmit(e);
  };

  const isBlocked = blockedMessage !== null;

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="bg-white fixed bottom-0 left-0 right-0 z-10"
        style={{
          backgroundColor: "#ffffff",
          borderTop: "1px solid #e5e7eb",
          paddingTop: "1rem",
          paddingBottom: "calc(1rem + var(--safe-area-inset-bottom))",
          paddingLeft: "1rem",
          paddingRight: "1rem",
        }}
      >
        {blockedMessage && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{blockedMessage}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="flex-shrink-0 bg-gray-50 border-gray-200 hover:bg-gray-100"
                aria-label="Add emoji"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-80 p-3 mb-2" 
              side="top"
              align="start"
              sideOffset={8}
            >
              <div className="grid grid-cols-8 gap-1">
                {commonEmojis.map((emoji, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleEmojiSelect(emoji)}
                    className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                    aria-label={`Select emoji ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={loading || disabled}
            className={`flex-1 bg-gray-50 border-gray-200 ${isBlocked ? "border-red-300" : ""}`}
          />
          <Button
            type="submit"
            disabled={loading || !value.trim() || disabled || isBlocked}
            style={{
              backgroundColor: isBlocked 
                ? "#9ca3af" 
                : "hsl(142, 75%, 35%)", // Darker green for better contrast (WCAG AA compliant)
              color: "#ffffff",
            }}
            className="hover:opacity-90 font-semibold shadow-sm"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </>
  );
};



