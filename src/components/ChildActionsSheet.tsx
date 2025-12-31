// src/components/ChildActionsSheet.tsx
// Purpose: Bottom sheet for child actions (login code, copy, QR, print, remove)

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Copy, ExternalLink, Eye, EyeOff, Printer, QrCode, Trash2 } from "lucide-react";
import { useState } from "react";

interface Child {
  id: string;
  name: string;
  login_code: string;
  avatar_color: string;
}

interface ChildActionsSheetProps {
  child: Child | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullLoginCode: string;
  onCopyCode: (code: string) => void;
  onCopyMagicLink: (child: Child) => void;
  onViewQR: (child: Child) => void;
  onPrintCode: (child: Child) => void;
  onDelete: (child: Child) => void;
}

export const ChildActionsSheet = ({
  child,
  open,
  onOpenChange,
  fullLoginCode,
  onCopyCode,
  onCopyMagicLink,
  onViewQR,
  onPrintCode,
  onDelete,
}: ChildActionsSheetProps) => {
  const [showCode, setShowCode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!child) return null;

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    onOpenChange(false);
    onDelete(child);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{child.name}'s Actions</SheetTitle>
            <SheetDescription>
              Manage login code and child settings
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Login Code Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Login Code
              </label>
              <div className="bg-muted p-4 rounded-lg relative">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xl font-mono font-bold tracking-wider flex-1 break-all">
                    {showCode ? fullLoginCode : "••••-••••-••••"}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => setShowCode(!showCode)}
                  >
                    {showCode ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  onCopyCode(fullLoginCode);
                }}
                variant="outline"
                className="w-full"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Code
              </Button>
              <Button
                onClick={() => {
                  onCopyMagicLink(child);
                }}
                variant="outline"
                className="w-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button
                onClick={() => {
                  onViewQR(child);
                  onOpenChange(false);
                }}
                variant="outline"
                className="w-full"
              >
                <QrCode className="mr-2 h-4 w-4" />
                View QR
              </Button>
              <Button
                onClick={() => {
                  onPrintCode(child);
                  onOpenChange(false);
                }}
                variant="outline"
                className="w-full"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>

            {/* Danger Zone */}
            <div className="pt-4 border-t">
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove Child
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Child</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {child.name}? This action cannot
              be undone and will delete all associated data including messages
              and call history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

