// src/components/AddFamilyMemberDialog.tsx
// Purpose: Dialog for parents to invite family members (grandparents, aunts, uncles, etc.)

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError } from "@/utils/security";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

interface AddFamilyMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFamilyMemberAdded: () => void;
}

const relationships = [
  { value: "grandparent", label: "Grandparent" },
  { value: "aunt", label: "Aunt" },
  { value: "uncle", label: "Uncle" },
  { value: "cousin", label: "Cousin" },
  { value: "other", label: "Other" },
];

const AddFamilyMemberDialog = ({
  open,
  onOpenChange,
  onFamilyMemberAdded,
}: AddFamilyMemberDialogProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState<string>("grandparent");
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const { toast } = useToast();

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setName("");
      setEmail("");
      setRelationship("grandparent");
    }
  }, [open]);

  // Check if email is already invited
  const checkEmailExists = async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes("@")) {
      return { found: false, status: null };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { found: false, status: null };

      setCheckingEmail(true);
      const { data, error } = await supabase.rpc("check_family_member_email", {
        email_to_check: emailToCheck.toLowerCase().trim(),
        parent_id_to_check: user.id,
      });

      if (error) {
        // If function doesn't exist yet, that's okay - migration might not be run
        if (
          error.code === "42883" ||
          error.code === "PGRST301" ||
          error.message?.includes("does not exist")
        ) {
          safeLog.debug(
            "check_family_member_email function not found - migration may not be run yet"
          );
          return { found: false, status: null };
        }
        throw error;
      }

      if (data && data.length > 0) {
        return { found: data[0].found, status: data[0].status };
      }

      return { found: false, status: null };
    } catch (error) {
      safeLog.error("Error checking email:", sanitizeError(error));
      return { found: false, status: null };
    } finally {
      setCheckingEmail(false);
    }
  };

  // Validate email format
  const validateEmail = (emailToValidate: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailToValidate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter the family member's name",
        variant: "destructive",
      });
      return;
    }

    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter the family member's email address",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Check if email is already invited
      const emailCheck = await checkEmailExists(email);
      if (emailCheck.found) {
        if (emailCheck.status === "pending") {
          toast({
            title: "Invitation already sent",
            description:
              "An invitation has already been sent to this email address. It's still pending acceptance.",
            variant: "default",
          });
          setLoading(false);
          return;
        } else if (emailCheck.status === "active") {
          toast({
            title: "Already registered",
            description:
              "This email address is already registered as a family member.",
            variant: "default",
          });
          setLoading(false);
          return;
        }
      }

      // Create invitation record in family_members table
      const { data: invitation, error: insertError } = await supabase
        .from("family_members")
        .insert({
          parent_id: user.id,
          email: email.toLowerCase().trim(),
          name: name.trim(),
          relationship: relationship,
          created_by: user.id,
          invitation_sent_at: new Date().toISOString(),
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      if (!invitation) {
        throw new Error("Failed to create invitation");
      }

      // Note: adult_profiles record will be automatically created when the family member
      // accepts the invitation and signs up (via handle_new_family_member trigger)
      // This ensures they appear in child's family list and can have conversations

      // Build invitation URL for manual sharing
      const invitationUrl = `${window.location.origin}/family-member/invite/${invitation.invitation_token}`;

      // Send invitation email via edge function
      try {
        const { data: emailData, error: emailError } =
          await supabase.functions.invoke("send-family-member-invitation", {
            body: {
              invitationToken: invitation.invitation_token,
              email: email.toLowerCase().trim(),
              name: name.trim(),
              relationship: relationship,
              parentName: user.user_metadata?.name || "a family member",
            },
          });

        if (emailError) {
          // Log error but don't fail - invitation is created in DB
          safeLog.warn(
            "Failed to send invitation email:",
            sanitizeError(emailError)
          );

          // Copy invitation link to clipboard
          try {
            await navigator.clipboard.writeText(invitationUrl);
            toast({
              title: "Invitation created",
              description: `Email sending failed (expected in local dev). Invitation link copied to clipboard!`,
              variant: "default",
              duration: 8000,
            });
          } catch (clipboardError) {
            toast({
              title: "Invitation created",
              description: `Email sending failed. Share this link: ${invitationUrl}`,
              variant: "default",
              duration: 10000,
            });
          }
        } else {
          toast({
            title: "Invitation sent!",
            description: `An invitation has been sent to ${email}. They'll receive an email with registration instructions.`,
          });
        }
      } catch (emailError: any) {
        // Edge function might not exist yet or not available locally - that's okay
        safeLog.debug(
          "Email sending edge function not available:",
          sanitizeError(emailError)
        );

        // Copy invitation link to clipboard
        try {
          await navigator.clipboard.writeText(invitationUrl);
          toast({
            title: "Invitation created",
            description: `Email function not available (local dev). Invitation link copied to clipboard! Share: ${invitationUrl}`,
            variant: "default",
            duration: 10000,
          });
        } catch (clipboardError) {
          toast({
            title: "Invitation created",
            description: `Email function not available. Share this link: ${invitationUrl}`,
            variant: "default",
            duration: 10000,
          });
        }
      }

      // Reset form
      setName("");
      setEmail("");
      setRelationship("grandparent");
      onOpenChange(false);
      onFamilyMemberAdded();
    } catch (error: any) {
      safeLog.error(
        "Error creating family member invitation:",
        sanitizeError(error)
      );
      toast({
        title: "Error",
        description:
          error.message || "Failed to create invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Family Member
          </DialogTitle>
          <DialogDescription>
            Invite grandparents, aunts, uncles, or other family members to
            connect with your children.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Enter family member's name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="family.member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || checkingEmail}
                className="pl-10"
                required
              />
            </div>
            {checkingEmail && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking email...
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="relationship">Relationship</Label>
            <Select
              value={relationship}
              onValueChange={setRelationship}
              disabled={loading}
            >
              <SelectTrigger id="relationship">
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                {relationships.map((rel) => (
                  <SelectItem key={rel.value} value={rel.value}>
                    {rel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || checkingEmail}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFamilyMemberDialog;
