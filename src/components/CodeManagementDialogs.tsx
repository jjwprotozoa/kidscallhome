// src/components/CodeManagementDialogs.tsx
// Purpose: Dialogs for managing child login codes (view, edit, delete, print)

import { Button } from "@/components/ui/button";
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
import { Copy, ExternalLink, Printer, X } from "lucide-react";

interface Child {
  id: string;
  name: string;
  login_code: string;
  avatar_color: string;
}

interface CodeManagementDialogsProps {
  // Code View Dialog
  showCodeDialog: { child: Child } | null;
  onCloseCodeDialog: () => void;
  getFullLoginCode: (child: Child) => string;
  onCopyCode: (code: string) => void;
  onCopyMagicLink: (child: Child) => void;
  onPrintCode: (child: Child) => void;

  // Edit Code Dialog
  childToEditCode: Child | null;
  onCloseEditCode: () => void;
  onUpdateLoginCode: () => void;
  isUpdatingCode: boolean;

  // Delete Child Dialog
  childToDelete: Child | null;
  onCloseDelete: () => void;
  onDeleteChild: () => void;

  // Print View Dialog
  printViewChild: Child | null;
  onClosePrintView: () => void;
  onPrintFromModal: () => void;
}

export const CodeManagementDialogs = ({
  showCodeDialog,
  onCloseCodeDialog,
  getFullLoginCode,
  onCopyCode,
  onCopyMagicLink,
  onPrintCode,
  childToEditCode,
  onCloseEditCode,
  onUpdateLoginCode,
  isUpdatingCode,
  childToDelete,
  onCloseDelete,
  onDeleteChild,
  printViewChild,
  onClosePrintView,
  onPrintFromModal,
}: CodeManagementDialogsProps) => {
  return (
    <>
      {/* Code View Dialog */}
      {showCodeDialog && (
        <AlertDialog
          open={!!showCodeDialog}
          onOpenChange={(open) => !open && onCloseCodeDialog()}
        >
          <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
            <button
              onClick={onCloseCodeDialog}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg sm:text-xl">
                {showCodeDialog.child.name}'s Login Code
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                Share this code or QR code with your child to log in
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-muted p-3 sm:p-4 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  Login Code
                </p>
                <p className="text-2xl sm:text-3xl font-mono font-bold break-all">
                  {getFullLoginCode(showCodeDialog.child)}
                </p>
              </div>
              <div className="flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    `${
                      window.location.origin
                    }/child/login?code=${encodeURIComponent(
                      getFullLoginCode(showCodeDialog.child)
                    )}`
                  )}`}
                  alt="QR Code"
                  className="border-2 border-muted rounded-lg w-[200px] h-[200px] sm:w-[250px] sm:h-[250px] object-contain"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() =>
                    onCopyCode(getFullLoginCode(showCodeDialog.child))
                  }
                  variant="outline"
                  className="flex-1 w-full sm:w-auto"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Code
                </Button>
                <Button
                  onClick={() => onCopyMagicLink(showCodeDialog.child)}
                  variant="outline"
                  className="flex-1 w-full sm:w-auto"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button
                  onClick={() => onPrintCode(showCodeDialog.child)}
                  variant="outline"
                  className="flex-1 w-full sm:w-auto"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Edit Login Code Confirmation Dialog */}
      <AlertDialog
        open={!!childToEditCode}
        onOpenChange={(open) => !open && onCloseEditCode()}
      >
        <AlertDialogContent>
          <button
            onClick={onCloseEditCode}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            disabled={isUpdatingCode}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate New Login Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to generate a new login code for{" "}
              {childToEditCode?.name}? The current code (
              {childToEditCode?.login_code}) will no longer work. Make sure to
              share the new code with your child.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingCode}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onUpdateLoginCode}
              disabled={isUpdatingCode}
            >
              {isUpdatingCode ? "Generating..." : "Generate New Code"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Child Confirmation Dialog */}
      <AlertDialog
        open={!!childToDelete}
        onOpenChange={(open) => !open && onCloseDelete()}
      >
        <AlertDialogContent>
          <button
            onClick={onCloseDelete}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Child</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {childToDelete?.name}? This
              action cannot be undone and will delete all associated data
              including messages and call history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteChild}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print View Modal (Mobile) */}
      {printViewChild && (
        <AlertDialog
          open={!!printViewChild}
          onOpenChange={(open) => !open && onClosePrintView()}
        >
          <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md print:hidden">
            <button
              onClick={onClosePrintView}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none print:hidden"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg sm:text-xl">
                {printViewChild.name}'s Login Code
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                Print or share this code with your child
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-muted p-3 sm:p-4 rounded-lg text-center print:border-2 print:border-gray-800">
                <p className="text-xs text-muted-foreground mb-2 print:text-gray-600">
                  Login Code
                </p>
                <p className="text-2xl sm:text-3xl font-mono font-bold break-all print:text-3xl">
                  {getFullLoginCode(printViewChild)}
                </p>
              </div>
              <div className="flex justify-center print:my-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                    `${
                      window.location.origin
                    }/child/login?code=${encodeURIComponent(
                      getFullLoginCode(printViewChild)
                    )}`
                  )}`}
                  alt="QR Code"
                  className="border-2 border-muted rounded-lg w-[250px] h-[250px] sm:w-[300px] sm:h-[300px] object-contain print:border-gray-800"
                />
              </div>
              <div className="instructions print:mt-4 print:text-sm print:text-gray-600">
                <p>Scan the QR code or use the code above to log in</p>
                <p>Visit: {window.location.origin}/child/login</p>
              </div>
            </div>
            <AlertDialogFooter className="print:hidden">
              <Button
                onClick={onPrintFromModal}
                variant="default"
                className="flex-1"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
};

