// src/pages/ParentAuth/types.ts
// Purpose: TypeScript interfaces for ParentAuth

export interface AuthFormData {
  email: string;
  password: string;
  name?: string;
  staySignedIn: boolean;
}

export interface AuthValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
  sanitized: Record<string, string>;
}

export interface AuthState {
  isLogin: boolean;
  loading: boolean;
  captchaToken: string | null;
  needsFamilySetup: boolean;
  userId: string | null;
  parentName: string | null;
}







