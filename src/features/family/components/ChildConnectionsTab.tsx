// src/features/family/components/ChildConnectionsTab.tsx
// Tab component for managing child-to-child connection requests and approvals

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { approveChildConnection, requestChildConnection } from "@/utils/family-communication";
import type { ChildConnection } from "@/types/family-communication";

interface ConnectionRequest extends ChildConnection {
  requester_child_name?: string;
  target_child_name?: string;
  requested_by_name?: string;
}

interface ChildConnectionsTabProps {
  children: Array<{ id: string; name: string }>;
}

export const ChildConnectionsTab: React.FC<ChildConnectionsTabProps> = ({ children }) => {
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [approved, setApproved] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchConnections = async () => {
    try {
      setLoading(true);
      // Get current user's family ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adultProfile } = await supabase
        .from("adult_profiles")
        .select("family_id")
        .eq("user_id", user.id)
        .eq("role", "parent")
        .single();

      if (!adultProfile) return;

      // Fetch all connection requests involving children in this family
      const { data: connections, error } = await supabase
        .from("child_connections")
        .select("*")
        .or(`requester_family_id.eq.${adultProfile.family_id},target_family_id.eq.${adultProfile.family_id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch child names for display
      const childIds = new Set<string>();
      connections?.forEach(conn => {
        childIds.add(conn.requester_child_id);
        childIds.add(conn.target_child_id);
      });

      const { data: childProfiles } = await supabase
        .from("child_profiles")
        .select("id, name")
        .in("id", Array.from(childIds));

      const childNameMap = new Map(childProfiles?.map(cp => [cp.id, cp.name]) || []);

      const enrichedConnections: ConnectionRequest[] = (connections || []).map(conn => ({
        ...conn,
        requester_child_name: childNameMap.get(conn.requester_child_id) || "Unknown",
        target_child_name: childNameMap.get(conn.target_child_id) || "Unknown",
      }));

      setRequests(enrichedConnections.filter(c => c.status === "pending"));
      setApproved(enrichedConnections.filter(c => c.status === "approved"));
    } catch (error) {
      console.error("Error fetching connections:", error);
      toast({
        title: "Error",
        description: "Failed to load connection requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleApprove = async (connectionId: string) => {
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

      const success = await approveChildConnection(connectionId, adultProfile.id);
      if (success) {
        toast({
          title: "Connection approved",
          description: "The children can now communicate",
        });
        fetchConnections();
      } else {
        throw new Error("Failed to approve connection");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve connection",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from("child_connections")
        .update({ status: "rejected" })
        .eq("id", connectionId);

      if (error) throw error;

      toast({
        title: "Connection rejected",
        description: "The connection request has been rejected",
      });
      fetchConnections();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject connection",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-4">Loading connections...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Pending Connection Requests</h2>
        {requests.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground">
            No pending connection requests
          </Card>
        ) : (
          <div className="space-y-2">
            {requests.map(request => (
              <Card key={request.id} className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">
                      {request.requester_child_name} wants to connect with {request.target_child_name}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Requested {request.requested_by_child ? "by child" : "by parent"} - {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleReject(request.id)}>
                      Reject
                    </Button>
                    <Button onClick={() => handleApprove(request.id)}>
                      Approve
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Approved Connections */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Approved Connections</h2>
        {approved.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground">
            No approved connections yet
          </Card>
        ) : (
          <div className="space-y-2">
            {approved.map(connection => (
              <Card key={connection.id} className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">
                      {connection.requester_child_name} ↔ {connection.target_child_name}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Approved {connection.approved_at ? new Date(connection.approved_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

