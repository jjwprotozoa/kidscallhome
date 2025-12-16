// src/utils/__tests__/inputValidation.test.ts
// Purpose: Comprehensive snapshot tests for all inputValidation functions
// These tests establish baseline behavior before refactoring

import { describe, it, expect } from 'vitest';
import {
  sanitizeInput,
  isValidEmail,
  validatePassword,
  validateChildLoginCode,
  sanitizeAndValidate,
  containsSQLInjection,
  containsXSS,
} from '../inputValidation';

/**
 * FUNCTION SIGNATURES DOCUMENTATION:
 * 
 * 1. sanitizeInput(input: string): string
 *    - Removes XSS patterns from string input
 *    - Returns sanitized string
 * 
 * 2. isValidEmail(email: string): boolean
 *    - Validates email format
 *    - Returns true if valid, false otherwise
 * 
 * 3. validatePassword(password: string): { valid: boolean; errors: string[] }
 *    - Validates password strength (8+ chars, uppercase, lowercase, digit, symbol)
 *    - Checks against weak password list
 *    - Returns validation result with errors array
 * 
 * 4. validateChildLoginCode(code: string): boolean
 *    - Validates child login code format: familyCode-color/animal-number
 *    - Accepts spaces or hyphens as separators
 *    - Returns true if valid format, false otherwise
 * 
 * 5. sanitizeAndValidate(input: { email?: string; password?: string; name?: string; code?: string }): 
 *    { valid: boolean; errors: Record<string, string[]>; sanitized: Record<string, string> }
 *    - Sanitizes and validates multiple input fields
 *    - Returns validation result with errors and sanitized values
 * 
 * 6. containsSQLInjection(input: string): boolean
 *    - Detects SQL injection patterns
 *    - Returns true if SQL patterns detected, false otherwise
 * 
 * 7. containsXSS(input: string): boolean
 *    - Detects XSS attack patterns
 *    - Returns true if XSS patterns detected, false otherwise
 */

describe('inputValidation - Baseline Tests', () => {
  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toMatchSnapshot();
      expect(sanitizeInput('<div>Hello</div>')).toMatchSnapshot();
      expect(sanitizeInput('Text with < and > characters')).toMatchSnapshot();
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeInput('javascript:alert("xss")')).toMatchSnapshot();
      expect(sanitizeInput('JAVASCRIPT:alert("xss")')).toMatchSnapshot();
      expect(sanitizeInput('text javascript: more text')).toMatchSnapshot();
    });

    it('should remove event handlers', () => {
      expect(sanitizeInput('onclick=alert("xss")')).toMatchSnapshot();
      expect(sanitizeInput('onerror=alert("xss")')).toMatchSnapshot();
      expect(sanitizeInput('onload=alert("xss")')).toMatchSnapshot();
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toMatchSnapshot();
      expect(sanitizeInput('\n\ttext\n\t')).toMatchSnapshot();
    });

    it('should handle non-string input', () => {
      expect(sanitizeInput(123 as any)).toMatchSnapshot();
      expect(sanitizeInput(null as any)).toMatchSnapshot();
      expect(sanitizeInput(undefined as any)).toMatchSnapshot();
    });

    it('should preserve safe text', () => {
      expect(sanitizeInput('Hello World')).toMatchSnapshot();
      expect(sanitizeInput('user@example.com')).toMatchSnapshot();
      expect(sanitizeInput('ABC123-blue-19')).toMatchSnapshot();
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.email+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('user123@test-domain.com')).toBe(true);
      expect(isValidEmail('a@b.co')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user @domain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(isValidEmail('  user@example.com  ')).toBe(true);
      expect(isValidEmail('user@example.com ')).toBe(true);
    });

    it('should handle non-string input', () => {
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail(undefined as any)).toBe(false);
      expect(isValidEmail(123 as any)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      expect(validatePassword('StrongP@ss123')).toMatchSnapshot();
      expect(validatePassword('MyP@ssw0rd!')).toMatchSnapshot();
      expect(validatePassword('Test123!@#')).toMatchSnapshot();
    });

    it('should reject passwords shorter than 8 characters', () => {
      expect(validatePassword('Short1!')).toMatchSnapshot();
      expect(validatePassword('Abc1!')).toMatchSnapshot();
    });

    it('should reject passwords longer than 128 characters', () => {
      const longPassword = 'A'.repeat(129) + '1!';
      expect(validatePassword(longPassword)).toMatchSnapshot();
    });

    it('should require uppercase letter', () => {
      expect(validatePassword('lowercase123!')).toMatchSnapshot();
    });

    it('should require lowercase letter', () => {
      expect(validatePassword('UPPERCASE123!')).toMatchSnapshot();
    });

    it('should require digit', () => {
      expect(validatePassword('NoDigits!@#')).toMatchSnapshot();
    });

    it('should require symbol', () => {
      expect(validatePassword('NoSymbol123')).toMatchSnapshot();
    });

    it('should reject weak passwords', () => {
      expect(validatePassword('password')).toMatchSnapshot();
      expect(validatePassword('12345678')).toMatchSnapshot();
      expect(validatePassword('qwerty')).toMatchSnapshot();
      expect(validatePassword('admin')).toMatchSnapshot();
      expect(validatePassword('Password1')).toMatchSnapshot();
    });

    it('should handle empty/null input', () => {
      expect(validatePassword('')).toMatchSnapshot();
      expect(validatePassword(null as any)).toMatchSnapshot();
      expect(validatePassword(undefined as any)).toMatchSnapshot();
    });

    it('should accept passwords with various symbols', () => {
      expect(validatePassword('Test123!')).toMatchSnapshot();
      expect(validatePassword('Test123@')).toMatchSnapshot();
      expect(validatePassword('Test123#')).toMatchSnapshot();
      expect(validatePassword('Test123$')).toMatchSnapshot();
      expect(validatePassword('Test123%')).toMatchSnapshot();
      expect(validatePassword('Test123^')).toMatchSnapshot();
      expect(validatePassword('Test123&')).toMatchSnapshot();
      expect(validatePassword('Test123*')).toMatchSnapshot();
      expect(validatePassword('Test123(')).toMatchSnapshot();
      expect(validatePassword('Test123)')).toMatchSnapshot();
      expect(validatePassword('Test123_')).toMatchSnapshot();
      expect(validatePassword('Test123+')).toMatchSnapshot();
      expect(validatePassword('Test123-')).toMatchSnapshot();
      expect(validatePassword('Test123=')).toMatchSnapshot();
      expect(validatePassword('Test123[')).toMatchSnapshot();
      expect(validatePassword('Test123]')).toMatchSnapshot();
      expect(validatePassword('Test123{')).toMatchSnapshot();
      expect(validatePassword('Test123}')).toMatchSnapshot();
      expect(validatePassword('Test123;')).toMatchSnapshot();
      expect(validatePassword('Test123:')).toMatchSnapshot();
      expect(validatePassword('Test123"')).toMatchSnapshot();
      expect(validatePassword('Test123|')).toMatchSnapshot();
      expect(validatePassword('Test123<')).toMatchSnapshot();
      expect(validatePassword('Test123>')).toMatchSnapshot();
      expect(validatePassword('Test123?')).toMatchSnapshot();
      expect(validatePassword('Test123,')).toMatchSnapshot();
      expect(validatePassword('Test123.')).toMatchSnapshot();
      expect(validatePassword('Test123/')).toMatchSnapshot();
      expect(validatePassword('Test123`')).toMatchSnapshot();
      expect(validatePassword('Test123~')).toMatchSnapshot();
    });
  });

  describe('validateChildLoginCode', () => {
    it('should accept valid login codes with hyphens', () => {
      expect(validateChildLoginCode('ABC123-blue-19')).toBe(true);
      expect(validateChildLoginCode('123456-cat-7')).toBe(true);
      expect(validateChildLoginCode('XYZ999-dog-99')).toBe(true);
      expect(validateChildLoginCode('A1B2C3-red-1')).toBe(true);
    });

    it('should accept valid login codes with spaces', () => {
      expect(validateChildLoginCode('ABC123 blue 19')).toBe(true);
      expect(validateChildLoginCode('123456 cat 7')).toBe(true);
      expect(validateChildLoginCode('XYZ999  dog  99')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(validateChildLoginCode('ABC123-blue')).toBe(false);
      expect(validateChildLoginCode('blue-19')).toBe(false);
      expect(validateChildLoginCode('ABC123-19')).toBe(false);
      expect(validateChildLoginCode('ABC123-blue-999')).toBe(false); // number too large
      // Note: regex uses /i flag, so case-insensitive - uppercase color is actually valid
      // expect(validateChildLoginCode('ABC123-BLUE-19')).toBe(false); // This actually passes due to /i flag
      expect(validateChildLoginCode('ab-blue-19')).toBe(false); // family code too short
      expect(validateChildLoginCode('ABCDEFG-blue-19')).toBe(false); // family code too long
    });

    it('should handle empty/null input', () => {
      expect(validateChildLoginCode('')).toBe(false);
      expect(validateChildLoginCode(null as any)).toBe(false);
      expect(validateChildLoginCode(undefined as any)).toBe(false);
    });
  });

  describe('sanitizeAndValidate', () => {
    it('should validate all fields correctly', () => {
      expect(sanitizeAndValidate({
        email: 'user@example.com',
        password: 'StrongP@ss123',
        name: 'John Doe',
        code: 'ABC123-blue-19',
      })).toMatchSnapshot();
    });

    it('should handle email validation', () => {
      expect(sanitizeAndValidate({
        email: 'invalid-email',
      })).toMatchSnapshot();
    });

    it('should handle password validation', () => {
      expect(sanitizeAndValidate({
        password: 'weak',
      })).toMatchSnapshot();
    });

    it('should handle name validation', () => {
      expect(sanitizeAndValidate({
        name: '',
      })).toMatchSnapshot();
      
      expect(sanitizeAndValidate({
        name: 'A'.repeat(101), // Too long
      })).toMatchSnapshot();
    });

    it('should handle code validation', () => {
      expect(sanitizeAndValidate({
        code: 'invalid-code',
      })).toMatchSnapshot();
    });

    it('should sanitize inputs', () => {
      expect(sanitizeAndValidate({
        email: '  user@example.com  ',
        name: '<script>alert("xss")</script>',
      })).toMatchSnapshot();
    });

    it('should handle partial input', () => {
      expect(sanitizeAndValidate({
        email: 'user@example.com',
      })).toMatchSnapshot();
      
      expect(sanitizeAndValidate({
        password: 'StrongP@ss123',
      })).toMatchSnapshot();
    });

    it('should handle empty input', () => {
      expect(sanitizeAndValidate({})).toMatchSnapshot();
    });
  });

  describe('containsSQLInjection', () => {
    it('should detect SQL keywords', () => {
      expect(containsSQLInjection('SELECT * FROM users')).toBe(true);
      expect(containsSQLInjection('INSERT INTO table')).toBe(true);
      expect(containsSQLInjection('UPDATE users SET')).toBe(true);
      expect(containsSQLInjection('DELETE FROM users')).toBe(true);
      expect(containsSQLInjection('DROP TABLE users')).toBe(true);
      expect(containsSQLInjection('CREATE TABLE users')).toBe(true);
      expect(containsSQLInjection('ALTER TABLE users')).toBe(true);
      expect(containsSQLInjection('EXEC sp_helpdb')).toBe(true);
      expect(containsSQLInjection('EXECUTE procedure')).toBe(true);
    });

    it('should detect SQL comments', () => {
      expect(containsSQLInjection('text -- comment')).toBe(true);
      expect(containsSQLInjection('text # comment')).toBe(true);
      expect(containsSQLInjection('text /* comment */')).toBe(true);
    });

    it('should detect SQL injection patterns', () => {
      // Note: The regex pattern /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i requires spaces and exact format
      // "1' OR '1'='1" doesn't match because of quotes, but "1 OR 1=1" would
      expect(containsSQLInjection('1 OR 1=1')).toBe(true);
      expect(containsSQLInjection('1 AND 1=1')).toBe(true);
      expect(containsSQLInjection('UNION SELECT *')).toBe(true);
    });

    it('should not detect false positives', () => {
      expect(containsSQLInjection('Hello World')).toBe(false);
      expect(containsSQLInjection('user@example.com')).toBe(false);
      expect(containsSQLInjection('ABC123-blue-19')).toBe(false);
    });

    it('should handle empty/null input', () => {
      expect(containsSQLInjection('')).toBe(false);
      expect(containsSQLInjection(null as any)).toBe(false);
      expect(containsSQLInjection(undefined as any)).toBe(false);
    });
  });

  describe('containsXSS', () => {
    it('should detect script tags', () => {
      expect(containsXSS('<script>alert("xss")</script>')).toBe(true);
      expect(containsXSS('<SCRIPT>alert("xss")</SCRIPT>')).toBe(true);
    });

    it('should detect javascript: protocol', () => {
      expect(containsXSS('javascript:alert("xss")')).toBe(true);
      expect(containsXSS('JAVASCRIPT:alert("xss")')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(containsXSS('onclick=alert("xss")')).toBe(true);
      expect(containsXSS('onerror=alert("xss")')).toBe(true);
      expect(containsXSS('onload=alert("xss")')).toBe(true);
      expect(containsXSS('onmouseover=alert("xss")')).toBe(true);
    });

    it('should detect iframe tags', () => {
      expect(containsXSS('<iframe src="evil.com"></iframe>')).toBe(true);
      expect(containsXSS('<IFRAME src="evil.com"></IFRAME>')).toBe(true);
    });

    it('should detect object tags', () => {
      expect(containsXSS('<object data="evil.swf"></object>')).toBe(true);
    });

    it('should detect embed tags', () => {
      expect(containsXSS('<embed src="evil.swf"></embed>')).toBe(true);
    });

    it('should not detect false positives', () => {
      expect(containsXSS('Hello World')).toBe(false);
      expect(containsXSS('user@example.com')).toBe(false);
      expect(containsXSS('ABC123-blue-19')).toBe(false);
      expect(containsXSS('Text with < and > characters')).toBe(false);
    });

    it('should handle empty/null input', () => {
      expect(containsXSS('')).toBe(false);
      expect(containsXSS(null as any)).toBe(false);
      expect(containsXSS(undefined as any)).toBe(false);
    });
  });
});

