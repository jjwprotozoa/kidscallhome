// src/components/AddChildDialog/types.ts
// Purpose: TypeScript interfaces and types for AddChildDialog

export interface AddChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChildAdded: () => void;
}

export interface ChildFormData {
  name: string;
  selectedColor: string;
  codeType: "color" | "animal";
  selectedOption: string;
  selectedNumber: string;
  generatedCode: string;
  familyCode: string;
}

export interface ColorOption {
  name: string;
  color: string;
}

export interface AnimalOption {
  name: string;
  emoji: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}








