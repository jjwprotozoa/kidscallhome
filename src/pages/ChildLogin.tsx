import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Smile, Delete } from "lucide-react";

const ChildLogin = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleNumberClick = (num: string) => {
    if (code.length < 6) {
      setCode(code + num);
    }
  };

  const handleDelete = () => {
    setCode(code.slice(0, -1));
  };

  const handleLogin = async () => {
    if (code.length !== 6) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("children")
        .select("id, name, avatar_color")
        .eq("login_code", code.toUpperCase())
        .single();

      if (error || !data) {
        toast({
          title: "Code not found",
          description: "Please check your code and try again",
          variant: "destructive",
        });
        setCode("");
        return;
      }

      // Store child session in localStorage
      localStorage.setItem("childSession", JSON.stringify(data));
      navigate("/child/dashboard");
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

  const numbers = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary/5 p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-4">
          <Smile className="h-20 w-20 text-primary mx-auto" />
          <h1 className="text-4xl font-bold text-primary">Hi There!</h1>
          <p className="text-xl">Enter your special code</p>
        </div>

        <div className="bg-muted p-6 rounded-2xl">
          <div className="flex justify-center gap-2 mb-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="w-12 h-16 rounded-xl bg-card flex items-center justify-center border-2 border-primary/20"
              >
                <span className="text-3xl font-bold text-primary">
                  {code[i] || ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {numbers.map((num) => (
            <Button
              key={num}
              onClick={() => handleNumberClick(num)}
              size="lg"
              variant="outline"
              className="h-14 text-xl font-bold rounded-xl"
            >
              {num}
            </Button>
          ))}
          <Button
            onClick={handleDelete}
            size="lg"
            variant="outline"
            className="h-14 rounded-xl col-span-2"
          >
            <Delete className="h-6 w-6" />
          </Button>
        </div>

        <Button
          onClick={handleLogin}
          disabled={code.length !== 6 || loading}
          size="lg"
          className="w-full text-xl h-14 rounded-xl"
        >
          {loading ? "Checking..." : "Go!"}
        </Button>
      </Card>
    </div>
  );
};

export default ChildLogin;
