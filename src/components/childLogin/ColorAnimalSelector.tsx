// src/components/childLogin/ColorAnimalSelector.tsx
// Purpose: Color/Animal selection screen for child login

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { colors, animals } from "@/data/childLoginConstants";
import { Smile, Shuffle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ColorAnimalSelectorProps {
  familyCode: string;
  codeType: "color" | "animal";
  onCodeTypeChange: (type: "color" | "animal") => void;
  onOptionSelect: (option: string, type: "color" | "animal") => void;
  onBack: () => void;
}

export const ColorAnimalSelector = ({
  familyCode,
  codeType,
  onCodeTypeChange,
  onOptionSelect,
  onBack,
}: ColorAnimalSelectorProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-primary/5 p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6">
        <div className="text-center space-y-4">
          <Button variant="ghost" onClick={onBack} className="absolute top-4 left-4">
            ← Back
          </Button>
          <button
            onClick={() => navigate("/parent/auth")}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Switch to Parent"
            title="Switch to Parent Login"
          >
            <Shuffle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
          </button>
          <Smile className="h-20 w-20 text-primary mx-auto" />
          <h1 className="text-4xl font-bold text-primary">Hi There!</h1>
          <p className="text-xl">
            Family Code:{" "}
            <span className="font-mono font-bold text-primary">{familyCode}</span>
          </p>
          <p className="text-lg">Pick your color or animal</p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={codeType === "color" ? "default" : "outline"}
              onClick={() => onCodeTypeChange("color")}
              className="flex-1"
              size="lg"
            >
              Colors
            </Button>
            <Button
              variant={codeType === "animal" ? "default" : "outline"}
              onClick={() => onCodeTypeChange("animal")}
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
                  onClick={() => onOptionSelect(c.name, "color")}
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
                  onClick={() => onOptionSelect(a.name, "animal")}
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

