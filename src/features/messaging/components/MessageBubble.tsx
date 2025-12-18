// src/features/messaging/components/MessageBubble.tsx
// Message bubble component for displaying individual messages in chat

interface Message {
  id: string;
  sender_type: "parent" | "child" | "family_member";
  sender_id?: string;
  content: string;
  created_at: string;
}

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
}

export const MessageBubble = ({ message, isMine }: MessageBubbleProps) => {
  return (
    <div
      className={`flex w-full mb-2 ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`px-3 py-2 rounded-2xl max-w-[80%] text-sm shadow-sm ${
          isMine
            ? "bg-chat-accent text-chat-accent-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        <div className="flex items-end gap-1.5">
          <p className="whitespace-pre-wrap break-words flex-1">
            {message.content}
          </p>
          <span
            className={`text-[10px] opacity-70 flex-shrink-0 ${
              isMine ? "text-white/70" : "text-muted-foreground"
            }`}
          >
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
};












