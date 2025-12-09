// src/features/safety/components/BlockAndReportButton.tsx
// Component for children to block contacts and report inappropriate behavior

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Ban, Flag, AlertTriangle } from "lucide-react";
import { blockContact, createReport } from "@/utils/family-communication";
import type { ReportType } from "@/types/family-communication";
import { useToast } from "@/hooks/use-toast";

interface BlockAndReportButtonProps {
  childId: string;
  blockedAdultProfileId?: string;
  blockedChildProfileId?: string;
  contactName: string;
  onBlocked?: () => void;
}

export function BlockAndReportButton({
  childId,
  blockedAdultProfileId,
  blockedChildProfileId,
  contactName,
  onBlocked,
}: BlockAndReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"block" | "report" | null>(null);
  const [reportType, setReportType] = useState<ReportType>("other");
  const [reportMessage, setReportMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleBlock = async () => {
    setLoading(true);
    try {
      const result = await blockContact({
        blocker_child_id: childId,
        blocked_adult_profile_id: blockedAdultProfileId,
        blocked_child_profile_id: blockedChildProfileId,
      });

      if (result) {
        toast({
          title: "Contact blocked",
          description: `${contactName} has been blocked. Your parent has been notified.`,
        });
        setOpen(false);
        onBlocked?.();
      } else {
        toast({
          title: "Error",
          description: "Failed to block contact. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error blocking contact:", error);
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async () => {
    if (!reportType) {
      toast({
        title: "Required field",
        description: "Please select a report type.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await createReport({
        reporter_child_id: childId,
        reported_adult_profile_id: blockedAdultProfileId,
        reported_child_profile_id: blockedChildProfileId,
        report_type: reportType,
        report_message: reportMessage || null,
      });

      if (result) {
        toast({
          title: "Report submitted",
          description: "Your report has been submitted. Your parent has been notified.",
        });
        setOpen(false);
        setReportMessage("");
        setReportType("other");
      } else {
        toast({
          title: "Error",
          description: "Failed to submit report. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating report:", error);
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Ban className="h-4 w-4" />
          Block & Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block & Report {contactName}</DialogTitle>
          <DialogDescription>
            You can block this contact and/or report inappropriate behavior. Your parent will be
            notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Button
              variant={action === "block" ? "default" : "outline"}
              onClick={() => setAction("block")}
              className="flex-1"
            >
              <Ban className="h-4 w-4 mr-2" />
              Block Contact
            </Button>
            <Button
              variant={action === "report" ? "default" : "outline"}
              onClick={() => setAction("report")}
              className="flex-1"
            >
              <Flag className="h-4 w-4 mr-2" />
              Report
            </Button>
          </div>

          {action === "block" && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold">Blocking will:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Immediately prevent this contact from calling or messaging you</li>
                    <li>Notify your parent</li>
                    <li>Allow your parent to review and unblock if needed</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {action === "report" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="report-type">What would you like to report?</Label>
                <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                  <SelectTrigger id="report-type" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inappropriate_content">Inappropriate Content</SelectItem>
                    <SelectItem value="harassment">Harassment</SelectItem>
                    <SelectItem value="bullying">Bullying</SelectItem>
                    <SelectItem value="threat">Threat</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="report-message">Tell us what happened (optional)</Label>
                <Textarea
                  id="report-message"
                  placeholder="Describe what happened..."
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  className="mt-2"
                  rows={4}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          {action === "block" && (
            <Button onClick={handleBlock} disabled={loading}>
              {loading ? "Blocking..." : "Block Contact"}
            </Button>
          )}
          {action === "report" && (
            <Button onClick={handleReport} disabled={loading || !reportType}>
              {loading ? "Submitting..." : "Submit Report"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

