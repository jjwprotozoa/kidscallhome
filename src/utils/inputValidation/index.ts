// src/utils/inputValidation/index.ts
// Purpose: Barrel exports - must match original exports exactly

// Text validation and sanitization
export {
  sanitizeInput,
  sanitizeAndValidate,
  containsSQLInjection,
  containsXSS,
} from './textValidation';

// Email validation
export { isValidEmail } from './emailValidation';

// Password validation
export { validatePassword } from './passwordValidation';

// Code validation
export { validateChildLoginCode } from './codeValidation';












