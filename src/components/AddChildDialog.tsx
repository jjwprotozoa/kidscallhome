// src/components/AddChildDialog.tsx
// Purpose: Dialog for parents to add children with kid-friendly login codes

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Check } from "lucide-react";
import { safeLog, sanitizeError } from "@/utils/security";

interface AddChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChildAdded: () => void;
}

const avatarColors = [
  "#3B82F6", // blue
  "#F97316", // orange
  "#10B981", // green
  "#A855F7", // purple
  "#EC4899", // pink
];

// Kid-friendly login code options
const colors = [
  { name: "red", color: "#EF4444" },
  { name: "blue", color: "#3B82F6" },
  { name: "green", color: "#10B981" },
  { name: "yellow", color: "#FBBF24" },
  { name: "orange", color: "#F97316" },
  { name: "purple", color: "#A855F7" },
  { name: "pink", color: "#EC4899" },
  { name: "brown", color: "#92400E" },
  { name: "black", color: "#1F2937" },
  { name: "white", color: "#F3F4F6" },
];

const animals = [
  { name: "cat", emoji: "🐱" },
  { name: "dog", emoji: "🐶" },
  { name: "bird", emoji: "🐦" },
  { name: "fish", emoji: "🐠" },
  { name: "bear", emoji: "🐻" },
  { name: "lion", emoji: "🦁" },
  { name: "tiger", emoji: "🐯" },
  { name: "elephant", emoji: "🐘" },
  { name: "monkey", emoji: "🐵" },
  { name: "rabbit", emoji: "🐰" },
  { name: "horse", emoji: "🐴" },
  { name: "duck", emoji: "🦆" },
  { name: "cow", emoji: "🐄" },
  { name: "pig", emoji: "🐷" },
  { name: "sheep", emoji: "🐑" },
];

const AddChildDialog = ({ open, onOpenChange, onChildAdded }: AddChildDialogProps) => {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(avatarColors[0]);
  const [codeType, setCodeType] = useState<"color" | "animal">("color");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [selectedNumber, setSelectedNumber] = useState<string>("");
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [familyCode, setFamilyCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const { toast } = useToast();

  // Fetch family code and generate a random code when dialog opens
  useEffect(() => {
    if (open) {
      fetchFamilyCode();
      generateRandomCode();
    }
  }, [open]);

  const fetchFamilyCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data, error } = await supabase
        .from("parents")
        .select("family_code")
        .eq("id", user.id)
        .single();

      // If parent record doesn't exist (PGRST116 = no rows found), create it
      if (error && error.code === 'PGRST116') {
        safeLog.log("📝 [FAMILY CODE] Parent record not found, creating it...");
        
        // Upsert parent record - the database trigger/function will generate family_code if needed
        const { error: upsertError } = await supabase
          .from("parents")
          .upsert({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || '',
          }, {
            onConflict: 'id'
          });

        if (upsertError) {
          safeLog.error("❌ [FAMILY CODE] Failed to create parent record:", sanitizeError(upsertError));
          throw upsertError;
        }

        // Fetch again after creating the record
        const { data: newData, error: newError } = await supabase
          .from("parents")
          .select("family_code")
          .eq("id", user.id)
          .single();

        if (newError) {
          throw newError;
        }

        data = newData;
      } else if (error) {
        // Check if it's a column doesn't exist error
        if (error.code === '42703' || error.message?.includes('does not exist')) {
          toast({
            title: "Database Migration Required",
            description: "The family_code column doesn't exist yet. Please run the migration in Supabase: supabase/migrations/20250121000000_add_family_code.sql",
            variant: "destructive",
            duration: 10000, // Show for 10 seconds
          });
          safeLog.error("❌ [FAMILY CODE] Migration not run. Error:", sanitizeError(error));
          return;
        }
        throw error;
      }
      
      if (data?.family_code) {
        setFamilyCode(data.family_code);
      } else {
        // Family code is null - might need to generate one via RPC
        safeLog.warn("⚠️ [FAMILY CODE] Parent exists but family_code is null, attempting to generate...");
        
        // Try to generate family code via RPC if available
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('generate_unique_family_code');
          
          if (!rpcError && rpcData) {
            // Update parent with generated family code
            const { error: updateError } = await supabase
              .from("parents")
              .update({ family_code: rpcData })
              .eq("id", user.id);

            if (!updateError) {
              setFamilyCode(rpcData);
              // SECURITY: Don't log family codes - they are sensitive
              safeLog.log("✅ [FAMILY CODE] Generated and set family code (code redacted)");
              return;
            } else {
              safeLog.error("❌ [FAMILY CODE] Failed to update parent with family code:", sanitizeError(updateError));
            }
          } else {
            safeLog.error("❌ [FAMILY CODE] RPC call failed:", sanitizeError(rpcError));
          }
        } catch (rpcErr) {
          safeLog.error("❌ [FAMILY CODE] Exception calling RPC:", sanitizeError(rpcErr));
        }
        
        // If we get here, we couldn't generate the family code
        toast({
          title: "Family Code Missing",
          description: "Your account doesn't have a family code yet. The system will attempt to generate one. Please refresh the page in a moment.",
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error: any) {
      safeLog.error("Failed to fetch family code:", sanitizeError(error));
      toast({
        title: "Error Loading Family Code",
        description: error.message || "Please refresh and try again. If the problem persists, ensure the database migration has been run.",
        variant: "destructive",
        duration: 8000,
      });
    }
  };

  const generateRandomCode = async () => {
    setCheckingCode(true);
    try {
      const { data, error } = await supabase.rpc("generate_kid_friendly_login_code");
      if (error) throw error;
      setGeneratedCode(data);
      // Parse the generated code
      const [option, number] = data.split("-");
      setSelectedOption(option);
      setSelectedNumber(number);
      // Determine if it's a color or animal
      const isColor = colors.some((c) => c.name === option);
      setCodeType(isColor ? "color" : "animal");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to generate code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCheckingCode(false);
    }
  };

  const handleOptionSelect = (option: string, type: "color" | "animal") => {
    setSelectedOption(option);
    setCodeType(type);
    updateCode(option, selectedNumber);
  };

  const handleNumberChange = (num: string) => {
    // Only allow 1-2 digit numbers (1-99)
    const numValue = parseInt(num);
    if (num === "" || (numValue >= 1 && numValue <= 99)) {
      setSelectedNumber(num);
      if (selectedOption) {
        updateCode(selectedOption, num);
      }
    }
  };

  const updateCode = (option: string, number: string) => {
    if (option && number && familyCode) {
      // Format: familyCode-color/animal-number
      setGeneratedCode(`${familyCode}-${option}-${number}`);
    } else if (option && number) {
      // Show partial code while family code loads
      setGeneratedCode(`${option}-${number}`);
    }
  };

  const checkCodeUnique = async (code: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("children")
        .select("id")
        .eq("login_code", code)
        .maybeSingle();
      
      if (error) throw error;
      return !data; // Code is unique if no data found
    } catch {
      return false;
    }
  };

  // Update code whenever family code, option, or number changes
  useEffect(() => {
    if (familyCode && selectedOption && selectedNumber) {
      setGeneratedCode(`${familyCode}-${selectedOption}-${selectedNumber}`);
    } else if (selectedOption && selectedNumber) {
      // Show partial code while family code loads
      setGeneratedCode(`${selectedOption}-${selectedNumber}`);
    }
  }, [familyCode, selectedOption, selectedNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name",
        variant: "destructive",
      });
      return;
    }

    if (!familyCode) {
      toast({
        title: "Family Code Required",
        description: "Family code not loaded. This may mean the database migration hasn't been run. Please check the console for details.",
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    if (!generatedCode || !selectedOption || !selectedNumber) {
      toast({
        title: "Error",
        description: "Please select a color/animal and number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if parent can add more children (subscription limit check)
      const { data: canAdd, error: canAddError } = await supabase.rpc(
        "can_add_child",
        { p_parent_id: user.id }
      );

      if (canAddError) {
        safeLog.error("Error checking subscription limit:", sanitizeError(canAddError));
        // Continue anyway - don't block if check fails
      } else if (canAdd === false) {
        // Get subscription details for better error message
        const { data: parentData } = await supabase
          .from("parents")
          .select("allowed_children, subscription_status, subscription_expires_at")
          .eq("id", user.id)
          .single();
        
        const { count: currentCount } = await supabase
          .from("children")
          .select("*", { count: "exact", head: true })
          .eq("parent_id", user.id);

        const allowed = parentData?.allowed_children || 1;
        const status = parentData?.subscription_status || "unknown";
        const expiresAt = parentData?.subscription_expires_at;
        const isExpired = expiresAt ? new Date(expiresAt) <= new Date() : false;

        let errorMessage = "You've reached your subscription limit. ";
        
        if (status !== "active" || isExpired) {
          errorMessage += `Your subscription status is "${status}"${isExpired ? " and has expired" : ""}. `;
        }
        
        errorMessage += `You have ${currentCount || 0} / ${allowed === 999 ? "unlimited" : allowed} children. `;
        errorMessage += "Please upgrade your plan or manage your subscription to add more children.";

        console.error("Subscription limit check failed:", {
          canAdd,
          currentCount,
          allowed,
          status,
          expiresAt,
          isExpired,
        });

        toast({
          title: "Subscription Limit Reached",
          description: errorMessage,
          variant: "destructive",
          duration: 10000,
        });
        setLoading(false);
        return;
      }

      // Check if code is unique
      const isUnique = await checkCodeUnique(generatedCode);
      if (!isUnique) {
        toast({
          title: "Code already taken",
          description: "Please generate a new code or choose different options",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("children").insert({
        parent_id: user.id,
        name: name.trim(),
        login_code: generatedCode,
        avatar_color: selectedColor,
      });

      if (error) throw error;

      toast({ 
        title: "Child added successfully!",
        description: `Full login code: ${generatedCode}`,
      });
      setName("");
      setSelectedColor(avatarColors[0]);
      setSelectedOption("");
      setSelectedNumber("");
      setGeneratedCode("");
      onOpenChange(false);
      onChildAdded();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a Child</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Child's Name</label>
            <Input
              type="text"
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Pick an Avatar Color</label>
            <div className="flex gap-2 flex-wrap">
              {avatarColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className="w-12 h-12 rounded-full border-4 transition-all"
                  style={{
                    backgroundColor: color,
                    borderColor: selectedColor === color ? color : "transparent",
                    opacity: selectedColor === color ? 1 : 0.6,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">Your Family Code</p>
              <p className="text-xl font-mono font-bold text-blue-700 dark:text-blue-300 text-center">
                {familyCode || "Loading..."}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 text-center">
                Share this code with your child for login
              </p>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Child's Login Code</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateRandomCode}
                disabled={checkingCode || !familyCode}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${checkingCode ? "animate-spin" : ""}`} />
                Generate New
              </Button>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Full Login Code</p>
              <p className="text-2xl font-mono font-bold text-center break-all">
                {generatedCode || (familyCode ? "Select color/animal and number" : "Loading...")}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={codeType === "color" ? "default" : "outline"}
                  onClick={() => setCodeType("color")}
                  className="flex-1"
                >
                  Colors
                </Button>
                <Button
                  type="button"
                  variant={codeType === "animal" ? "default" : "outline"}
                  onClick={() => setCodeType("animal")}
                  className="flex-1"
                >
                  Animals
                </Button>
              </div>

              {codeType === "color" ? (
                <div className="grid grid-cols-5 gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => handleOptionSelect(c.name, "color")}
                      className={`h-16 rounded-lg border-2 transition-all flex items-center justify-center ${
                        selectedOption === c.name
                          ? "border-primary scale-105"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.color }}
                    >
                      <span className="text-white font-bold text-sm capitalize">
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {animals.map((a) => (
                    <button
                      key={a.name}
                      type="button"
                      onClick={() => handleOptionSelect(a.name, "animal")}
                      className={`h-16 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                        selectedOption === a.name
                          ? "border-primary scale-105 bg-primary/10"
                          : "border-transparent opacity-60 hover:opacity-100 hover:bg-muted"
                      }`}
                    >
                      <span className="text-2xl">{a.emoji}</span>
                      <span className="text-xs font-medium capitalize mt-1">{a.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Number (1-99)</label>
              <Input
                type="number"
                min="1"
                max="99"
                placeholder="Enter number"
                value={selectedNumber}
                onChange={(e) => handleNumberChange(e.target.value)}
                className="text-center text-2xl font-bold"
              />
            </div>

            {generatedCode && familyCode && (
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                    Code ready!
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    Your child will use: <span className="font-mono font-bold">{generatedCode}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading || !generatedCode || !familyCode}>
            {loading ? "Creating..." : "Add Child"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddChildDialog;
