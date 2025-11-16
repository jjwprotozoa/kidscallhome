// src/pages/ChildParentsList.tsx
// Child: Parent List / Profile Screen

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone, ArrowLeft } from "lucide-react";

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
  parent_id: string;
}

interface Parent {
  id: string;
  name: string;
}

const ChildParentsList = () => {
  const [child, setChild] = useState<ChildSession | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const sessionData = localStorage.getItem("childSession");
    if (!sessionData) {
      navigate("/child/login");
      return;
    }
    const childData = JSON.parse(sessionData);
    setChild(childData);
    fetchParent(childData.parent_id);
  }, [navigate]);

  const fetchParent = async (parentId: string) => {
    try {
      const { data, error } = await supabase
        .from("parents")
        .select("id, name")
        .eq("id", parentId)
        .single();

      if (error) throw error;
      setParent(data);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error loading parent",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (parentId: string) => {
    navigate(`/child/call/${parentId}`);
  };

  if (loading || !child) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/child")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Call Parent</h1>
        </div>

        {parent ? (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                  {parent.name?.charAt(0).toUpperCase() || "P"}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">
                    {parent.name || "Parent"}
                  </h3>
                </div>
              </div>
              <Button onClick={() => handleCall(parent.id)}>
                <Phone className="mr-2 h-4 w-4" />
                Call
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <p className="text-muted-foreground">No parent found.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ChildParentsList;

