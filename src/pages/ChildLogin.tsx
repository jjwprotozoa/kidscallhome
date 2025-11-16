// src/pages/ChildLogin.tsx
// Purpose: Kid-friendly login page with visual color/animal selection and number keypad

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Smile, Delete, Sparkles } from "lucide-react";

// Kid-friendly login code options (must match AddChildDialog)
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

const ChildLogin = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<"select" | "number" | "success">("select");
  const [codeType, setCodeType] = useState<"color" | "animal">("color");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [number, setNumber] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [childData, setChildData] = useState<{ id: string; name: string; avatar_color: string } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLoginWithCode = async (code: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("children")
        .select("id, name, avatar_color, parent_id")
        .eq("login_code", code)
        .single();

      if (error || !data) {
        toast({
          title: "Code not found",
          description: "Please check your code and try again",
          variant: "destructive",
        });
        setNumber("");
        setStep("select");
        return;
      }

      setChildData(data);
      setStep("success");
      localStorage.setItem("childSession", JSON.stringify(data));
      setTimeout(() => {
        navigate("/child/dashboard");
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setStep("select");
    } finally {
      setLoading(false);
    }
  };

  // Handle magic link with code parameter
  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam && codeParam.trim() !== "") {
      // Decode the code parameter in case it was URL-encoded
      const decodedCode = decodeURIComponent(codeParam.trim());
      const [option, num] = decodedCode.split("-");
      if (option && num && option.length > 0 && num.length > 0) {
        setSelectedOption(option);
        setNumber(num);
        // Determine if it's a color or animal
        const isColor = colors.some((c) => c.name === option);
        setCodeType(isColor ? "color" : "animal");
        setStep("number");
        // Auto-login if code is provided
        setTimeout(() => {
          handleLoginWithCode(decodedCode);
        }, 500);
      } else {
        // Invalid code format - show error
        toast({
          title: "Invalid login code",
          description: "The login code format is incorrect. Please check and try again.",
          variant: "destructive",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleOptionSelect = (option: string, type: "color" | "animal") => {
    setSelectedOption(option);
    setCodeType(type);
    setStep("number");
  };

  const handleNumberClick = (num: string) => {
    const newNumber = number + num;
    // Limit to 2 digits (1-99)
    if (newNumber.length <= 2 && parseInt(newNumber) <= 99) {
      setNumber(newNumber);
    }
  };

  const handleDelete = () => {
    setNumber(number.slice(0, -1));
  };

  const handleBack = () => {
    setStep("select");
    setSelectedOption("");
    setNumber("");
  };

  const handleLogin = async () => {
    if (!selectedOption || !number) {
      toast({
        title: "Incomplete code",
        description: "Please select a color/animal and enter your number",
        variant: "destructive",
      });
      return;
    }

    const loginCode = `${selectedOption}-${number}`;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("children")
        .select("id, name, avatar_color, parent_id")
        .eq("login_code", loginCode)
        .single();

      if (error || !data) {
        toast({
          title: "Code not found",
          description: "Please check your code and try again",
          variant: "destructive",
        });
        setNumber("");
        return;
      }

      // Show success animation
      setChildData(data);
      setStep("success");

      // Store child session in localStorage
      localStorage.setItem("childSession", JSON.stringify(data));

      // Navigate after animation
      setTimeout(() => {
        navigate("/child/dashboard");
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setNumber("");
    } finally {
      setLoading(false);
    }
  };

  // Success animation screen
  if (step === "success" && childData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary/5 p-4">
        <Card className="w-full max-w-md p-8 space-y-6 text-center">
          <div className="space-y-4 animate-bounce">
            <div className="flex justify-center">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-lg"
                style={{ backgroundColor: childData.avatar_color }}
              >
                {childData.name[0].toUpperCase()}
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <Sparkles className="h-8 w-8 text-yellow-500 animate-pulse" />
              <h1 className="text-4xl font-bold text-primary">
                Welcome, {childData.name}!
              </h1>
              <Sparkles className="h-8 w-8 text-yellow-500 animate-pulse" />
            </div>
            <p className="text-xl text-muted-foreground">You're all set! 🎉</p>
          </div>
        </Card>
      </div>
    );
  }

  // Number entry screen
  if (step === "number") {
    const selectedItem = codeType === "color"
      ? colors.find((c) => c.name === selectedOption)
      : animals.find((a) => a.name === selectedOption);

    return (
      <div className="min-h-screen flex items-center justify-center bg-primary/5 p-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="absolute top-4 left-4"
            >
              ← Back
            </Button>
            <div className="flex items-center justify-center gap-3">
              {codeType === "color" && selectedItem ? (
                <div
                  className="w-16 h-16 rounded-full border-4 border-primary"
                  style={{ backgroundColor: selectedItem.color }}
                />
              ) : selectedItem ? (
                <div className="text-6xl">{selectedItem.emoji}</div>
              ) : null}
              <div>
                <h2 className="text-2xl font-bold capitalize">{selectedOption}</h2>
                <p className="text-muted-foreground">Now enter your number</p>
              </div>
            </div>
          </div>

          <div className="bg-muted p-6 rounded-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-32 h-20 rounded-xl bg-card flex items-center justify-center border-2 border-primary/20">
                <span className="text-5xl font-bold text-primary">
                  {number || "?"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                size="lg"
                variant="outline"
                className="h-16 text-2xl font-bold rounded-xl"
              >
                {num}
              </Button>
            ))}
            <Button
              onClick={handleDelete}
              size="lg"
              variant="outline"
              className="h-16 rounded-xl col-span-2"
              disabled={!number}
            >
              <Delete className="h-6 w-6 mr-2" />
              Delete
            </Button>
            <Button
              onClick={() => handleNumberClick("0")}
              size="lg"
              variant="outline"
              className="h-16 text-2xl font-bold rounded-xl"
            >
              0
            </Button>
          </div>

          <Button
            onClick={handleLogin}
            disabled={!number || loading}
            size="lg"
            className="w-full text-xl h-14 rounded-xl"
          >
            {loading ? "Checking..." : "Go!"}
          </Button>
        </Card>
      </div>
    );
  }

  // Initial selection screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary/5 p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6">
        <div className="text-center space-y-4">
          <Smile className="h-20 w-20 text-primary mx-auto" />
          <h1 className="text-4xl font-bold text-primary">Hi There!</h1>
          <p className="text-xl">Pick your color or animal</p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={codeType === "color" ? "default" : "outline"}
              onClick={() => setCodeType("color")}
              className="flex-1"
              size="lg"
            >
              Colors
            </Button>
            <Button
              variant={codeType === "animal" ? "default" : "outline"}
              onClick={() => setCodeType("animal")}
              className="flex-1"
              size="lg"
            >
              Animals
            </Button>
          </div>

          {codeType === "color" ? (
            <div className="grid grid-cols-5 gap-3">
              {colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => handleOptionSelect(c.name, "color")}
                  className="h-20 rounded-xl border-2 border-transparent hover:border-primary transition-all flex items-center justify-center hover:scale-105"
                  style={{ backgroundColor: c.color }}
                >
                  <span className="text-white font-bold text-sm capitalize drop-shadow-lg">
                    {c.name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {animals.map((a) => (
                <button
                  key={a.name}
                  onClick={() => handleOptionSelect(a.name, "animal")}
                  className="h-20 rounded-xl border-2 border-transparent hover:border-primary transition-all flex flex-col items-center justify-center hover:scale-105 hover:bg-muted"
                >
                  <span className="text-3xl">{a.emoji}</span>
                  <span className="text-xs font-medium capitalize mt-1">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ChildLogin;
