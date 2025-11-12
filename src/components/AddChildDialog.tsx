import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

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

const AddChildDialog = ({ open, onOpenChange, onChildAdded }: AddChildDialogProps) => {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(avatarColors[0]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate unique code
      const { data: codeData, error: codeError } = await supabase.rpc(
        "generate_unique_login_code"
      );
      if (codeError) throw codeError;

      const { error } = await supabase.from("children").insert({
        parent_id: user.id,
        name,
        login_code: codeData,
        avatar_color: selectedColor,
      });

      if (error) throw error;

      toast({ title: "Child added successfully!" });
      setName("");
      setSelectedColor(avatarColors[0]);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a Child</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="text-sm font-medium">Pick a Color</label>
            <div className="flex gap-2">
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Add Child"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddChildDialog;
