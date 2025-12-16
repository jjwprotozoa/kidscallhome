// src/pages/ChildDashboard/IncomingCallDialog.tsx
// Purpose: Incoming call dialog component

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
import { Phone } from "lucide-react";
import { IncomingCall, ChildSession } from "./types";

interface IncomingCallDialogProps {
  incomingCall: IncomingCall | null;
  child: ChildSession | null;
  parentName: string;
  isAnsweringRef: React.MutableRefObject<boolean>;
  onAnswer: () => void;
  onDecline: () => void;
}

export const IncomingCallDialog = ({
  incomingCall,
  child,
  parentName,
  isAnsweringRef,
  onAnswer,
  onDecline,
}: IncomingCallDialogProps) => {
  return (
    <AlertDialog
      open={!!incomingCall}
      onOpenChange={(open) => {
        if (!open && incomingCall && !isAnsweringRef.current) {
          onDecline();
        }
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{
                backgroundColor: child?.avatar_color || "#3B82F6",
              }}
            >
              📞
            </div>
            <div>
              <AlertDialogTitle className="text-xl">Incoming Call</AlertDialogTitle>
              <p className="text-base font-normal text-muted-foreground">
                {parentName} is calling...
              </p>
            </div>
          </div>
          <div className="pt-4">
            <AlertDialogDescription className="sr-only">
              Incoming call from {parentName}
            </AlertDialogDescription>
            <div className="flex items-center justify-center gap-2 text-4xl animate-pulse">
              <Phone className="h-12 w-12" />
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center gap-2">
          <AlertDialogCancel onClick={onDecline} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Decline
          </AlertDialogCancel>
          <AlertDialogAction onClick={onAnswer} className="bg-green-600 hover:bg-green-700">
            Answer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};








