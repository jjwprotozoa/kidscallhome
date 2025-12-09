// src/components/PermissionErrorDialog.tsx
// Dialog component for displaying permission errors when communication is not allowed

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface PermissionErrorDialogProps {
  open: boolean;
  onClose: () => void;
  reason: string;
}

export const PermissionErrorDialog: React.FC<PermissionErrorDialogProps> = ({
  open,
  onClose,
  reason,
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <DialogTitle>Cannot Make Call</DialogTitle>
          </div>
          <DialogDescription className="pt-2">{reason}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

