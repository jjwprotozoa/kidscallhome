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
      className="flex-1 overflow-y-auto p-4 space-y-4"
      style={{ paddingTop: "80px", paddingBottom: "100px" }}
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



