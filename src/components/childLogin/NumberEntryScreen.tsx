// src/components/childLogin/NumberEntryScreen.tsx
// Purpose: Number entry screen for child login

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { colors, animals } from "@/data/childLoginConstants";
import { Delete } from "lucide-react";

interface NumberEntryScreenProps {
  selectedOption: string;
  codeType: "color" | "animal";
  familyCode: string;
  number: string;
  loading: boolean;
  onBack: () => void;
  onNumberClick: (num: string) => void;
  onDelete: () => void;
  onLogin: () => void;
}

export const NumberEntryScreen = ({
  selectedOption,
  codeType,
  familyCode,
  number,
  loading,
  onBack,
  onNumberClick,
  onDelete,
  onLogin,
}: NumberEntryScreenProps) => {
  const selectedItem =
    codeType === "color"
      ? colors.find((c) => c.name === selectedOption)
      : animals.find((a) => a.name === selectedOption);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-primary/5 p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-4">
          <Button variant="ghost" onClick={onBack} className="absolute top-4 left-4">
            ← Back
          </Button>
          <div className="flex items-center justify-center gap-3">
            {codeType === "color" && selectedItem && "color" in selectedItem ? (
              <div
                className="w-16 h-16 rounded-full border-4 border-primary"
                style={{ backgroundColor: selectedItem.color }}
              />
            ) : selectedItem && "emoji" in selectedItem ? (
              <div className="text-6xl">{selectedItem.emoji}</div>
            ) : null}
            <div>
              <h2 className="text-2xl font-bold capitalize">{selectedOption}</h2>
              <p className="text-muted-foreground">
                Family: <span className="font-mono font-semibold">{familyCode}</span>
              </p>
              <p className="text-muted-foreground">Now enter your number</p>
            </div>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-2xl">
          <div className="flex justify-center mb-4">
            <div className="w-32 h-20 rounded-xl bg-card flex items-center justify-center border-2 border-primary/20">
              <span className="text-5xl font-bold text-primary">{number || "?"}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <Button
              key={num}
              onClick={() => onNumberClick(num.toString())}
              size="lg"
              variant="outline"
              className="h-16 text-2xl font-bold rounded-xl"
            >
              {num}
            </Button>
          ))}
          <Button
            onClick={onDelete}
            size="lg"
            variant="outline"
            className="h-16 rounded-xl col-span-2"
            disabled={!number}
          >
            <Delete className="h-6 w-6 mr-2" />
            Delete
          </Button>
          <Button
            onClick={() => onNumberClick("0")}
            size="lg"
            variant="outline"
            className="h-16 text-2xl font-bold rounded-xl"
          >
            0
          </Button>
        </div>

        <Button
          onClick={onLogin}
          disabled={!number || loading}
          size="lg"
          className="w-full text-xl h-14 rounded-xl"
        >
          {loading ? "Checking..." : "Go!"}
        </Button>
      </Card>
    </div>
  );
};

