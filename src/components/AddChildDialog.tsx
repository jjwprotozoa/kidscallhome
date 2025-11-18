// src/components/AddChildDialog.tsx
// Purpose: Dialog for parents to add children with kid-friendly login codes

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Check } from "lucide-react";
import { z } from "zod";

const childNameSchema = z.object({
  name: z.string().trim().min(1, "Child name is required").max(100, "Name too long (max 100 characters)"),
});

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
  const [loading, setLoading] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const { toast } = useToast();

  // Generate a random code when dialog opens
  useEffect(() => {
    if (open) {
      generateRandomCode();
    }
  }, [open]);

  const generateRandomCode = async () => {
    setCheckingCode(true);
    try {
      const { data, error } = await supabase.rpc("generate_unique_login_code");
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
    if (option && number) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate child name using zod
    const validationResult = childNameSchema.safeParse({ name: name.trim() });
    if (!validationResult.success) {
      toast({
        title: "Invalid name",
        description: validationResult.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }
    
    if (!generatedCode) {
      toast({
        title: "Error",
        description: "Please generate a login code",
        variant: "destructive",
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
        description: `Login code: ${generatedCode}`,
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Login Code</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateRandomCode}
                disabled={checkingCode}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${checkingCode ? "animate-spin" : ""}`} />
                Generate New
              </Button>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Generated Code</p>
              <p className="text-2xl font-mono font-bold text-center">
                {generatedCode || "Generating..."}
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

            {generatedCode && (
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  Code ready: <span className="font-mono font-bold">{generatedCode}</span>
                </p>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading || !generatedCode}>
            {loading ? "Creating..." : "Add Child"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddChildDialog;
