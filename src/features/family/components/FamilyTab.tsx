// src/features/family/components/FamilyTab.tsx
// Family members tab component for ParentDashboard - memoized to prevent re-renders on tab switch

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FamilyMemberCard } from "@/components/FamilyMemberCard";
import { FamilyCodeCard } from "./FamilyCodeCard";
import { UserPlus, Users } from "lucide-react";
import React from "react";

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
}

interface FamilyTabProps {
  familyMembers: FamilyMember[];
  loading: boolean;
  onAddFamilyMember: () => void;
  onSuspend: (familyMemberId: string) => void;
  onActivate: (familyMemberId: string) => void;
  onResendInvitation: (familyMemberId: string, email: string) => void;
  onRemove: (familyMemberIdOrEmail: string) => void;
}

export const FamilyTab = React.memo(({
  familyMembers,
  loading,
  onAddFamilyMember,
  onSuspend,
  onActivate,
  onResendInvitation,
  onRemove,
}: FamilyTabProps) => {
  return (
    <div className="space-y-6 min-h-[400px]">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Family Members
          </h2>
          <p className="text-muted-foreground mt-1">
            Invite grandparents, aunts, uncles, and other family members to
            connect with your children
          </p>
        </div>
        <Button
          onClick={onAddFamilyMember}
          variant="outline"
          size="lg"
        >
          <UserPlus className="mr-2 h-5 w-5" />
          Invite Family Member
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : familyMembers.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">
            No family members invited yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Click "Invite Family Member" above to send an invitation.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-tour="parent-family-members">
          {familyMembers.map((member) => (
            <FamilyMemberCard
              key={member.id || member.email}
              familyMember={member}
              onSuspend={onSuspend}
              onActivate={onActivate}
              onResendInvitation={onResendInvitation}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
});

FamilyTab.displayName = "FamilyTab";







