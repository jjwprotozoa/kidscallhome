// src/features/family/components/FamilyLinkDialog.tsx
// Dialog for linking two families (co-parents)

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface FamilyLinkDialogProps {
  open: boolean;
  onClose: () => void;
  onLink: (email: string) => Promise<void>;
}

export const FamilyLinkDialog: React.FC<FamilyLinkDialogProps> = ({
  open,
  onClose,
  onLink,
}) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await onLink(email);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send link request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link with Co-Parent</DialogTitle>
          <DialogDescription>
            Enter the email address of your co-parent. They will receive a request
            to link families for metadata sharing (call logs and approved contacts only).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Important:</p>
              <p>This does NOT give them control over your family. Either of you can unlink at any time.</p>
            </div>
          </div>

          <div>
            <Label htmlFor="email">Co-Parent Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coparent@example.com"
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!email || loading}>
            {loading ? "Sending..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

