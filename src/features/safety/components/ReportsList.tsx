// src/features/safety/components/ReportsList.tsx
// Component for displaying and managing safety reports

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Report, ReportStatus } from "@/types/family-communication";

interface ReportWithNames extends Report {
  child_name?: string;
  contact_name?: string;
}

const StatusBadge: React.FC<{ status: ReportStatus }> = ({ status }) => {
  const colors = {
    pending: "bg-yellow-100 text-yellow-800",
    reviewed: "bg-blue-100 text-blue-800",
    resolved: "bg-green-100 text-green-800",
    dismissed: "bg-gray-100 text-gray-800",
  };

  return (
    <Badge className={colors[status] || colors.pending}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

export const ReportsList: React.FC = () => {
  const [reports, setReports] = useState<ReportWithNames[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchReports = async () => {
    try {
      setLoading(true);
      // Get current user's family
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adultProfile } = await supabase
        .from("adult_profiles")
        .select("family_id")
        .eq("user_id", user.id)
        .eq("role", "parent")
        .single();

      if (!adultProfile) return;

      // Get children in this family
      const { data: childMemberships } = await supabase
        .from("child_family_memberships")
        .select("child_profile_id")
        .eq("family_id", adultProfile.family_id);

      if (!childMemberships) return;

      const childIds = childMemberships.map(cm => cm.child_profile_id);

      // Fetch reports from these children
      const { data: reportsData, error } = await supabase
        .from("reports")
        .select("*")
        .in("reporter_child_id", childIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch names
      const childProfileIds = new Set(reportsData?.map(r => r.reporter_child_id) || []);
      const adultProfileIds = reportsData?.filter(r => r.reported_adult_profile_id).map(r => r.reported_adult_profile_id!) || [];
      const reportedChildIds = reportsData?.filter(r => r.reported_child_profile_id).map(r => r.reported_child_profile_id!) || [];

      const [childProfiles, adultProfiles, reportedChildProfiles] = await Promise.all([
        supabase.from("child_profiles").select("id, name").in("id", Array.from(childProfileIds)),
        adultProfileIds.length > 0 ? supabase.from("adult_profiles").select("id, name").in("id", adultProfileIds) : { data: [] },
        reportedChildIds.length > 0 ? supabase.from("child_profiles").select("id, name").in("id", reportedChildIds) : { data: [] },
      ]);

      const childNameMap = new Map(childProfiles.data?.map(cp => [cp.id, cp.name]) || []);
      const adultNameMap = new Map(adultProfiles.data?.map(ap => [ap.id, ap.name]) || []);
      const reportedChildNameMap = new Map(reportedChildProfiles.data?.map(cp => [cp.id, cp.name]) || []);

      const enriched: ReportWithNames[] = (reportsData || []).map(r => ({
        ...r,
        child_name: childNameMap.get(r.reporter_child_id) || "Unknown",
        contact_name: r.reported_adult_profile_id
          ? adultNameMap.get(r.reported_adult_profile_id) || "Unknown"
          : reportedChildNameMap.get(r.reported_child_profile_id!) || "Unknown",
      }));

      setReports(enriched);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleReview = async (reportId: string) => {
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

      const { error } = await supabase
        .from("reports")
        .update({
          status: "reviewed",
          reviewed_by_parent_id: adultProfile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      if (error) throw error;

      toast({
        title: "Report reviewed",
        description: "The report has been marked as reviewed",
      });
      fetchReports();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to review report",
        variant: "destructive",
      });
    }
  };

  const handleResolve = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from("reports")
        .update({ status: "resolved" })
        .eq("id", reportId);

      if (error) throw error;

      toast({
        title: "Report resolved",
        description: "The report has been marked as resolved",
      });
      fetchReports();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resolve report",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from("reports")
        .update({ status: "dismissed" })
        .eq("id", reportId);

      if (error) throw error;

      toast({
        title: "Report dismissed",
        description: "The report has been dismissed",
      });
      fetchReports();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to dismiss report",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-4">Loading reports...</div>;
  }

  if (reports.length === 0) {
    return (
      <Card className="p-4 text-center text-muted-foreground">
        No reports
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {reports.map(report => (
        <Card key={report.id} className="p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="font-medium">
                  {report.child_name} reported {report.contact_name}
                </p>
                <StatusBadge status={report.status} />
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Type: {report.report_type.replace("_", " ")}
              </p>
              {report.report_message && (
                <p className="text-sm mt-2 p-2 bg-gray-50 rounded">
                  "{report.report_message}"
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {new Date(report.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={() => handleReview(report.id)}>
                Review
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleResolve(report.id)}>
                Resolve
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDismiss(report.id)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

