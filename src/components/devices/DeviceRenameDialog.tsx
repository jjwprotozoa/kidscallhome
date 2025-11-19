// src/components/devices/DeviceRenameDialog.tsx
// Purpose: Dialog for renaming devices

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Device } from "./DeviceCard";

interface DeviceRenameDialogProps {
  device: Device | null;
  newDeviceName: string;
  onDeviceNameChange: (name: string) => void;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
}

export const DeviceRenameDialog = ({
  device,
  newDeviceName,
  onDeviceNameChange,
  onOpenChange,
  onRename,
}: DeviceRenameDialogProps) => {
  return (
    <Dialog open={!!device} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Device</DialogTitle>
          <DialogDescription>
            Give this device a friendly name to easily identify it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Device name"
            value={newDeviceName}
            onChange={(e) => onDeviceNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newDeviceName.trim()) {
                onRename();
              }
            }}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onRename} disabled={!newDeviceName.trim()}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

