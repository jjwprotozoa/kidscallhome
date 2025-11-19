// src/components/ChildActionButtons.tsx
// Purpose: Reusable buttons for child actions (Call and Chat) with badge support

import { Button } from "@/components/ui/button";
import {
  useMissedBadgeForChild,
  useUnreadBadgeForChild,
} from "@/stores/badgeStore";
import { MessageCircle, Video } from "lucide-react";

// CLS: Badges reserve space with invisible class when count is 0 to prevent button width changes
// Component for Call button with missed call badge
export const ChildCallButton = ({
  childId,
  onCall,
}: {
  childId: string;
  onCall: () => void;
}) => {
  const missedCallCount = useMissedBadgeForChild(childId);

  return (
    <Button
      onClick={onCall}
      className="flex-1 relative"
      variant="secondary"
      data-tour="parent-call-button"
    >
      <Video className="mr-2 h-4 w-4" />
      Call
      {/* CLS: Reserve space for badge to prevent layout shift */}
      <span
        className={`ml-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
          missedCallCount === 0 ? "invisible" : ""
        }`}
      >
        {missedCallCount > 99 ? "99+" : missedCallCount}
      </span>
    </Button>
  );
};

// Component for Chat button with unread message badge
export const ChildChatButton = ({
  childId,
  onChat,
}: {
  childId: string;
  onChat: () => void;
}) => {
  const unreadMessageCount = useUnreadBadgeForChild(childId);

  return (
    <Button
      onClick={onChat}
      className="flex-1 relative bg-chat-accent text-chat-accent-foreground hover:bg-chat-accent/90"
      variant="default"
      data-tour="parent-messages"
    >
      <MessageCircle className="mr-2 h-4 w-4" />
      Chat
      {/* CLS: Reserve space for badge to prevent layout shift */}
      <span
        className={`ml-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
          unreadMessageCount === 0 ? "invisible" : ""
        }`}
      >
        {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
      </span>
    </Button>
  );
};

