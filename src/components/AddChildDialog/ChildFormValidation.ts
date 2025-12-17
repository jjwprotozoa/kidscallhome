// src/components/AddChildDialog/ChildFormValidation.ts
// Purpose: Validation logic for child form

import { ValidationResult } from './types';

/**
 * Validate child name
 */
export function validateName(name: string): ValidationResult {
  const errors: string[] = [];
  
  if (!name || !name.trim()) {
    errors.push("Please enter a name");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate login code components
 */
export function validateLoginCode(
  familyCode: string,
  selectedOption: string,
  selectedNumber: string
): ValidationResult {
  const errors: string[] = [];
  
  if (!familyCode) {
    errors.push("Family code not loaded. This may mean the database migration hasn't been run.");
  }
  
  if (!selectedOption || !selectedNumber) {
    errors.push("Please select a color/animal and number");
  }
  
  if (selectedNumber) {
    const numValue = parseInt(selectedNumber);
    if (numValue < 1 || numValue > 99) {
      errors.push("Number must be between 1 and 99");
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format full login code
 */
export function formatLoginCode(
  familyCode: string,
  option: string,
  number: string
): string {
  if (familyCode && option && number) {
    return `${familyCode}-${option}-${number}`;
  } else if (option && number) {
    // Show partial code while family code loads
    return `${option}-${number}`;
  }
  return "";
}









