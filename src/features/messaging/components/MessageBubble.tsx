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
      className={`flex w-full mb-1 ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`px-3 py-1.5 rounded-lg max-w-[75%] sm:max-w-[65%] text-sm shadow-sm ${
          isMine
            ? "rounded-br-none"
            : "bg-white text-foreground rounded-bl-none"
        }`}
        style={
          isMine
            ? {
                backgroundColor: "hsl(142, 75%, 35%)", // Darker green for better contrast (WCAG AA compliant)
                color: "#ffffff",
              }
            : undefined
        }
      >
        <div className="flex flex-col">
          <p className={`whitespace-pre-wrap break-words leading-relaxed ${isMine ? "text-white" : ""}`}>
            {message.content}
          </p>
          <span
            className={`text-[11px] mt-1 ${
              isMine 
                ? "text-white/90 font-medium" 
                : "text-gray-600"
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














