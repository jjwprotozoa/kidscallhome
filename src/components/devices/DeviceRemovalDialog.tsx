// src/components/devices/DeviceRemovalDialog.tsx
// Purpose: Dialog for removing devices with password confirmation

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import type { Device } from "./DeviceCard";

interface DeviceRemovalDialogProps {
  device: Device | null;
  requireAuth: boolean;
  authPassword: string;
  onAuthPasswordChange: (password: string) => void;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
}

export const DeviceRemovalDialog = ({
  device,
  requireAuth,
  authPassword,
  onAuthPasswordChange,
  onOpenChange,
  onRemove,
}: DeviceRemovalDialogProps) => {
  return (
    <AlertDialog
      open={!!device}
      onOpenChange={(open) => {
        if (!open) {
          onOpenChange(false);
        }
      }}
    >
      <AlertDialogContent key={requireAuth ? "password" : "confirm"}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {requireAuth ? "Confirm Password" : "Remove Device?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {requireAuth ? (
              <>
                For security, please enter your password to remove{" "}
                <strong>{device?.device_name}</strong>. This device will need to
                be re-authorized on next login.
              </>
            ) : (
              <>
                Removing <strong>{device?.device_name}</strong> will revoke its
                access. You'll need to re-authorize this device the next time
                someone tries to log in from it. This action requires password
                confirmation.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requireAuth && (
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Enter your password"
              value={authPassword}
              onChange={(e) => onAuthPasswordChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onRemove();
                }
              }}
              autoFocus
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              // If we're not requiring auth yet, trigger onRemove which will show warning toast
              if (!requireAuth) {
                e.preventDefault();
                onRemove();
                return;
              }
              // Otherwise, proceed with device removal
              await onRemove();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {requireAuth ? "Remove Device" : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

