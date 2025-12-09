// src/components/FamilyMemberCard.tsx
// Purpose: Card component to display family member information

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  Copy,
  Link,
  Mail,
  MoreVertical,
  Phone,
  UserCheck,
  UserX,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FamilyMember {
  id: string | null;
  name: string;
  email: string;
  relationship: string;
  status: "pending" | "active" | "suspended";
  invitation_token?: string | null;
  invitation_sent_at: string | null;
  invitation_accepted_at: string | null;
  created_at: string;
  blockedByChildren?: string[];
  reportCount?: number;
}

interface FamilyMemberCardProps {
  familyMember: FamilyMember;
  onCall?: (familyMemberId: string) => void;
  onSuspend?: (familyMemberId: string) => void;
  onActivate?: (familyMemberId: string) => void;
  onResendInvitation?: (familyMemberId: string, email: string) => void;
  onRemove?: (familyMemberId: string) => void;
}

const relationshipLabels: Record<string, string> = {
  grandparent: "Grandparent",
  aunt: "Aunt",
  uncle: "Uncle",
  cousin: "Cousin",
  other: "Other",
};

const statusColors: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  active: "default",
  suspended: "destructive",
};

export const FamilyMemberCard = ({
  familyMember,
  onCall,
  onSuspend,
  onActivate,
  onResendInvitation,
  onRemove,
}: FamilyMemberCardProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getInvitationStatus = () => {
    if (familyMember.status === "active") {
      return "Active";
    }
    if (familyMember.status === "pending") {
      if (familyMember.invitation_sent_at) {
        const sentDate = new Date(familyMember.invitation_sent_at);
        return `Invited ${formatDistanceToNow(sentDate, { addSuffix: true })}`;
      }
      return "Pending";
    }
    if (familyMember.status === "suspended") {
      return "Suspended";
    }
    return "Unknown";
  };

  const getInvitationLink = () => {
    if (!familyMember.invitation_token) return null;
    return `${window.location.origin}/family-member/invite/${familyMember.invitation_token}`;
  };

  const handleCopyInvitationLink = async () => {
    const link = getInvitationLink();
    if (!link) {
      toast({
        title: "Error",
        description: "Invitation link not available",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "Copied!",
        description: "Invitation link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
              {getInitials(familyMember.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg truncate">
                {familyMember.name}
              </h3>
              <Badge variant={statusColors[familyMember.status] || "default"}>
                {getStatusLabel(familyMember.status)}
              </Badge>
              <Badge className="bg-indigo-500 text-white">
                {relationshipLabels[familyMember.relationship] ||
                  familyMember.relationship}
              </Badge>
            </div>

            {/* Blocked by children indicator */}
            {familyMember.blockedByChildren && familyMember.blockedByChildren.length > 0 && (
              <p className="text-sm text-red-600 mb-1">
                🚫 Blocked by: {familyMember.blockedByChildren.join(", ")}
              </p>
            )}

            {/* Report count link */}
            {familyMember.reportCount && familyMember.reportCount > 0 && (
              <button
                onClick={() => navigate("/parent/dashboard?tab=safety")}
                className="text-sm text-blue-600 hover:underline mb-1"
              >
                {familyMember.reportCount} pending report{familyMember.reportCount > 1 ? "s" : ""} - View reports
              </button>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate">{familyMember.email}</span>
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              {getInvitationStatus()}
            </p>

            {/* Show invitation link for pending members */}
            {familyMember.status === "pending" &&
              familyMember.invitation_token && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-start gap-2">
                    <Link className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground break-all font-mono">
                        {getInvitationLink()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 flex-shrink-0"
                      onClick={handleCopyInvitationLink}
                      title="Copy invitation link"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {familyMember.status === "active" && familyMember.id && onCall && (
              <DropdownMenuItem onClick={() => onCall(familyMember.id!)}>
                <Phone className="mr-2 h-4 w-4" />
                Call
              </DropdownMenuItem>
            )}
            {familyMember.status === "pending" && onResendInvitation && (
              <DropdownMenuItem
                onClick={() =>
                  onResendInvitation(
                    familyMember.id || familyMember.email,
                    familyMember.email
                  )
                }
              >
                <Mail className="mr-2 h-4 w-4" />
                Resend Invitation
              </DropdownMenuItem>
            )}
            {familyMember.status === "active" && onSuspend && (
              <DropdownMenuItem
                onClick={() => onSuspend(familyMember.id || "")}
              >
                <UserX className="mr-2 h-4 w-4" />
                Suspend
              </DropdownMenuItem>
            )}
            {familyMember.status === "suspended" && onActivate && (
              <DropdownMenuItem
                onClick={() => onActivate(familyMember.id || "")}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Activate
              </DropdownMenuItem>
            )}
            {onRemove && (
              <DropdownMenuItem
                onClick={() => onRemove(familyMember.id || familyMember.email)}
                className="text-destructive"
              >
                <UserX className="mr-2 h-4 w-4" />
                Remove
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
};
