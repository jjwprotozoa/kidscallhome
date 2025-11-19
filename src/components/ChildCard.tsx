// src/components/ChildCard.tsx
// Purpose: Reusable card component for displaying a child's information and actions

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChildCallButton, ChildChatButton } from "@/components/ChildActionButtons";
import { StatusIndicator } from "@/features/presence/StatusIndicator";
import { Copy, Edit, ExternalLink, Printer, QrCode, Trash2 } from "lucide-react";

interface Child {
  id: string;
  name: string;
  login_code: string;
  avatar_color: string;
}

interface ChildCardProps {
  child: Child;
  index: number;
  isOnline: boolean;
  fullLoginCode: string;
  onEditCode: () => void;
  onCopyCode: () => void;
  onCopyMagicLink: () => void;
  onPrintCode: () => void;
  onViewQR: () => void;
  onCall: () => void;
  onChat: () => void;
  onDelete: () => void;
}

export const ChildCard = ({
  child,
  index,
  isOnline,
  fullLoginCode,
  onEditCode,
  onCopyCode,
  onCopyMagicLink,
  onPrintCode,
  onViewQR,
  onCall,
  onChat,
  onDelete,
}: ChildCardProps) => {
  return (
    <Card
      className="p-6 space-y-4 min-h-[220px]"
      style={{
        borderLeft: `4px solid ${child.avatar_color}`,
      }}
    >
      <div className="space-y-2">
        <div
          className="flex items-center gap-2"
          data-tour={index === 0 ? "parent-child-name-status" : undefined}
        >
          <h3 className="text-2xl sm:text-3xl font-bold">{child.name}</h3>
          <StatusIndicator
            isOnline={isOnline}
            size="md"
            showPulse={isOnline}
          />
        </div>
        <div
          className="bg-muted p-3 rounded-lg relative"
          data-tour={index === 0 ? "parent-login-code" : undefined}
        >
          <p className="text-xs text-muted-foreground mb-1">Login Code</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xl sm:text-2xl font-mono font-bold tracking-wider flex-1">
              {fullLoginCode}
            </p>
            <Button
              onClick={onEditCode}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Generate new login code"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={onCopyCode}
            variant="outline"
            size="sm"
            className="flex-1"
            data-tour={index === 0 ? "parent-copy-code" : undefined}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Code
          </Button>
          <Button
            onClick={onCopyMagicLink}
            variant="outline"
            size="sm"
            className="flex-1"
            data-tour={index === 0 ? "parent-copy-link" : undefined}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Copy Link
          </Button>
          <Button
            onClick={onPrintCode}
            variant="outline"
            size="sm"
            className="flex-1"
            data-tour={index === 0 ? "parent-print-code" : undefined}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            onClick={onViewQR}
            variant="outline"
            size="sm"
            className="flex-1"
            data-tour={index === 0 ? "parent-view-qr" : undefined}
          >
            <QrCode className="mr-2 h-4 w-4" />
            View QR
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <ChildCallButton childId={child.id} onCall={onCall} />
        <ChildChatButton childId={child.id} onChat={onChat} />
        <Button
          onClick={onDelete}
          variant="destructive"
          size="icon"
          data-tour={index === 0 ? "parent-delete-child" : undefined}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};

