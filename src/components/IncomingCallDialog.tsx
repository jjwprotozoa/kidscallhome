// src/components/IncomingCallDialog.tsx
// Purpose: Dialog component for displaying and handling incoming calls from children

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

interface IncomingCall {
  id: string;
  child_id: string;
  child_name: string;
  child_avatar_color: string;
}

interface IncomingCallDialogProps {
  incomingCall: IncomingCall | null;
  isAnsweringRef: React.MutableRefObject<boolean>;
  onAnswer: () => void;
  onDecline: () => void;
  onOpenChange: (open: boolean) => void;
}

export const IncomingCallDialog = ({
  incomingCall,
  isAnsweringRef,
  onAnswer,
  onDecline,
  onOpenChange,
}: IncomingCallDialogProps) => {
  const handleOpenChange = (open: boolean) => {
    // Only decline if dialog is being closed AND user didn't click Answer
    // Don't decline if user is answering (isAnsweringRef will be true)
    if (!open && incomingCall && !isAnsweringRef.current) {
      onDecline();
    }
    onOpenChange(open);
  };

  return (
    <AlertDialog open={!!incomingCall} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{
                backgroundColor:
                  incomingCall?.child_avatar_color || "#3B82F6",
              }}
            >
              {incomingCall?.child_name[0]}
            </div>
            <div>
              <AlertDialogTitle className="text-xl">
                Incoming Call
              </AlertDialogTitle>
              <p className="text-base font-normal text-muted-foreground">
                {incomingCall?.child_name} is calling...
              </p>
            </div>
          </div>
          <div className="pt-4">
            <AlertDialogDescription className="sr-only">
              Incoming call from {incomingCall?.child_name}
            </AlertDialogDescription>
            <div className="flex items-center justify-center gap-2 text-4xl animate-pulse">
              <Phone className="h-12 w-12" />
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center gap-2">
          <AlertDialogCancel
            onClick={onDecline}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Decline
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onAnswer}
            className="bg-green-600 hover:bg-green-700"
          >
            Answer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

