// src/features/safety/components/BlockedContactsList.tsx
// Component for displaying and managing blocked contacts

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { unblockContact } from "@/utils/family-communication";
import type { BlockedContact } from "@/types/family-communication";

interface BlockedContactWithNames extends BlockedContact {
  child_name?: string;
  contact_name?: string;
}

export const BlockedContactsList: React.FC = () => {
  const [blockedContacts, setBlockedContacts] = useState<BlockedContactWithNames[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBlockedContacts = async () => {
    try {
      setLoading(true);
      // Get current user and family in parallel
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adultProfile } = await supabase
        .from("adult_profiles")
        .select("family_id")
        .eq("user_id", user.id)
        .eq("role", "parent")
        .single();

      if (!adultProfile) return;

      // Fetch child memberships and blocked contacts in parallel
      const [childMembershipsResponse, blockedResponse] = await Promise.all([
        supabase
          .from("child_family_memberships")
          .select("child_profile_id")
          .eq("family_id", adultProfile.family_id),
        // Pre-fetch blocked contacts (will filter by childIds after)
        Promise.resolve(null),
      ]);

      const childMemberships = childMembershipsResponse.data;
      if (!childMemberships || childMemberships.length === 0) {
        setBlockedContacts([]);
        return;
      }

      const childIds = childMemberships.map(cm => cm.child_profile_id);

      // Fetch blocked contacts
      const { data: blocked, error } = await supabase
        .from("blocked_contacts")
        .select("*")
        .in("blocker_child_id", childIds)
        .is("unblocked_at", null)
        .order("blocked_at", { ascending: false });

      if (error) throw error;

      if (!blocked || blocked.length === 0) {
        setBlockedContacts([]);
        return;
      }

      // Fetch all names in parallel
      const childProfileIds = new Set(blocked.map(b => b.blocker_child_id));
      const adultProfileIds = blocked.filter(b => b.blocked_adult_profile_id).map(b => b.blocked_adult_profile_id!);
      const blockedChildIds = blocked.filter(b => b.blocked_child_profile_id).map(b => b.blocked_child_profile_id!);

      const [childProfiles, adultProfiles, blockedChildProfiles] = await Promise.all([
        childProfileIds.size > 0
          ? supabase.from("child_profiles").select("id, name").in("id", Array.from(childProfileIds))
          : Promise.resolve({ data: [] }),
        adultProfileIds.length > 0
          ? supabase.from("adult_profiles").select("id, name").in("id", adultProfileIds)
          : Promise.resolve({ data: [] }),
        blockedChildIds.length > 0
          ? supabase.from("child_profiles").select("id, name").in("id", blockedChildIds)
          : Promise.resolve({ data: [] }),
      ]);

      const childNameMap = new Map(childProfiles.data?.map(cp => [cp.id, cp.name]) || []);
      const adultNameMap = new Map(adultProfiles.data?.map(ap => [ap.id, ap.name]) || []);
      const blockedChildNameMap = new Map(blockedChildProfiles.data?.map(cp => [cp.id, cp.name]) || []);

      const enriched: BlockedContactWithNames[] = blocked.map(b => ({
        ...b,
        child_name: childNameMap.get(b.blocker_child_id) || "Unknown",
        contact_name: b.blocked_adult_profile_id
          ? adultNameMap.get(b.blocked_adult_profile_id) || "Unknown"
          : blockedChildNameMap.get(b.blocked_child_profile_id!) || "Unknown",
      }));

      setBlockedContacts(enriched);
    } catch (error) {
      console.error("Error fetching blocked contacts:", error);
      toast({
        title: "Error",
        description: "Failed to load blocked contacts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedContacts();
  }, []);

  const handleUnblock = async (blockedContactId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adultProfile } = await supabase
        .from("adult_profiles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "parent")
        .single();

      if (!adultProfile) return;

      const success = await unblockContact(blockedContactId, adultProfile.id);
      if (success) {
        toast({
          title: "Contact unblocked",
          description: "The contact has been unblocked",
        });
        fetchBlockedContacts();
      } else {
        throw new Error("Failed to unblock contact");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unblock contact",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="h-9 w-20 bg-gray-200 rounded"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (blockedContacts.length === 0) {
    return (
      <Card className="p-4 text-center text-muted-foreground">
        No blocked contacts
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {blockedContacts.map(contact => (
        <Card key={contact.id} className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">
                {contact.child_name} blocked {contact.contact_name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(contact.blocked_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleUnblock(contact.id)}>
                Unblock
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

