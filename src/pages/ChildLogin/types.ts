// src/pages/ChildLogin/types.ts
// Purpose: Type definitions for ChildLogin page

export type LoginStep = "familyCode" | "select" | "number" | "success";

export type CodeType = "color" | "animal";

export type AuthState = "idle" | "loading" | "success" | "error";

export interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
  parent_id: string;
}

export interface LoginCodeParts {
  familyCode: string;
  option: string; // color or animal name
  number: string; // 1-99
}

export interface ParsedLoginCode {
  normalizedFamilyCode: string;
  normalizedChildCode: string; // format: "option-number"
  fullCode: string; // format: "FAMILYCODE-option-number"
}







