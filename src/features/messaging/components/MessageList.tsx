// src/features/messaging/components/MessageList.tsx
// Message list component for displaying all messages

import { MessageBubble } from "./MessageBubble";
import { useEffect, useRef } from "react";

interface Message {
  id: string;
  sender_type: "parent" | "child" | "family_member";
  sender_id?: string;
  content: string;
  created_at: string;
}

interface MessageListProps {
  messages: Message[];
  currentSenderType: "parent" | "child" | "family_member" | null;
  currentSenderId: string | null;
}

export const MessageList = ({
  messages,
  currentSenderType,
  currentSenderId,
}: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="flex-1 overflow-y-auto px-2 sm:px-4 py-2"
      style={{ 
        paddingTop: "calc(80px + var(--safe-area-inset-top))", 
        paddingBottom: "100px",
        backgroundImage: "radial-gradient(circle at 20% 50%, rgba(0,0,0,0.02) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.02) 0%, transparent 50%)",
      }}
    >
      {messages.map((message) => {
        // Determine if this message is from the current user
        const isMine =
          currentSenderType !== null &&
          currentSenderId !== null &&
          message.sender_type === currentSenderType &&
          message.sender_id === currentSenderId;

        return (
          <MessageBubble key={message.id} message={message} isMine={isMine} />
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};














