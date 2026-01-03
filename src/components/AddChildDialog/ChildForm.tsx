// src/components/AddChildDialog/ChildForm.tsx
// Purpose: Form fields and UI for adding a child

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Check } from "lucide-react";
import { AVATAR_COLORS, COLORS, ANIMALS } from './constants';

interface ChildFormProps {
  name: string;
  onNameChange: (name: string) => void;
  selectedColor: string;
  onColorChange: (color: string) => void;
  codeType: "color" | "animal";
  onCodeTypeChange: (type: "color" | "animal") => void;
  selectedOption: string;
  onOptionSelect: (option: string, type: "color" | "animal") => void;
  selectedNumber: string;
  onNumberChange: (num: string) => void;
  generatedCode: string;
  familyCode: string;
  checkingCode: boolean;
  onGenerateCode: () => void;
}

export const ChildForm = ({
  name,
  onNameChange,
  selectedColor,
  onColorChange,
  codeType,
  onCodeTypeChange,
  selectedOption,
  onOptionSelect,
  selectedNumber,
  onNumberChange,
  generatedCode,
  familyCode,
  checkingCode,
  onGenerateCode,
}: ChildFormProps) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Child's Name</label>
        <Input
          type="text"
          placeholder="Enter name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Pick an Avatar Color</label>
        <div className="flex gap-2 flex-wrap">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorChange(color)}
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
            onClick={onGenerateCode}
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
              onClick={() => onCodeTypeChange("color")}
              className="flex-1"
            >
              Colors
            </Button>
            <Button
              type="button"
              variant={codeType === "animal" ? "default" : "outline"}
              onClick={() => onCodeTypeChange("animal")}
              className="flex-1"
            >
              Animals
            </Button>
          </div>

          {codeType === "color" ? (
            <div className="grid grid-cols-5 gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => onOptionSelect(c.name, "color")}
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
              {ANIMALS.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  onClick={() => onOptionSelect(a.name, "animal")}
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
            onChange={(e) => onNumberChange(e.target.value)}
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
    </div>
  );
};












