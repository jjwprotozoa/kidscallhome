// src/pages/Upgrade/PaymentDialog.tsx
// Purpose: Email entry and payment confirmation dialog

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { SubscriptionPlan } from "./types";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPlan: SubscriptionPlan | null;
  email: string;
  onEmailChange: (email: string) => void;
  emailLocked: boolean;
  isProcessing: boolean;
  onPayment: () => void;
  onManualUpgrade: () => void;
}

export const PaymentDialog = ({
  open,
  onOpenChange,
  selectedPlan,
  email,
  onEmailChange,
  emailLocked,
  isProcessing,
  onPayment,
  onManualUpgrade,
}: PaymentDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Your Upgrade</DialogTitle>
          <DialogDescription>
            Enter your family account email to link this subscription to your
            account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Family Account Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your-email@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              disabled={isProcessing || emailLocked}
              readOnly={emailLocked}
              className={emailLocked ? "bg-muted cursor-not-allowed" : ""}
            />
            {emailLocked && (
              <p className="text-xs text-muted-foreground">
                Email is locked to your authenticated account for security
              </p>
            )}
          </div>
          {selectedPlan && (
            <Card className="p-4 bg-muted">
              <div className="space-y-2">
                <p className="text-sm font-semibold">{selectedPlan.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPlan.price}/{selectedPlan.interval === "month" ? "month" : "year"}
                </p>
              </div>
            </Card>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={onPayment}
            disabled={isProcessing || !email.trim()}
            className="w-full sm:w-auto"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Proceed to Payment"
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={onManualUpgrade}
            disabled={isProcessing || !email.trim()}
            className="w-full sm:w-auto"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "I Already Paid"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};









