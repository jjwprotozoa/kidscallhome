// src/lib/wordFilter.ts
// Word filter utility for detecting inappropriate content in messages
// Can be extended to use safety mode keywords from family settings

/**
 * Default list of inappropriate words/phrases for child safety
 * These are ALWAYS checked for all users (children and adults)
 * Can be extended with family-specific keywords from safety settings
 */
const DEFAULT_BLOCKED_WORDS = [
  // Profanity (common variations)
  'damn', 'hell', 'crap', 'stupid', 'idiot', 'dumb',
  
  // Inappropriate content indicators
  'kill', 'die', 'hurt', 'hate', 'fight',
  
  // Personal information sharing (to prevent)
  'address', 'phone number', 'home alone', 'parents away',
  
  // Cyberbullying indicators
  'ugly', 'fat', 'loser', 'weirdo', 'freak',
  
  // Note: This is a basic list. For production, consider:
  // 1. Using a more comprehensive profanity filter library
  // 2. Allowing parents to customize keywords in safety settings
  // 3. Using AI content scanning for more sophisticated detection
];

/**
 * Leetspeak character substitutions (common bypass attempts)
 * Maps common character substitutions used to bypass word filters
 */
const LEETSPEAK_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '!': 'i',
  '$': 's',
};

/**
 * Normalize text for word matching (removes punctuation, special chars, numbers, converts to lowercase)
 * Handles bypass attempts like: d!e, d1e, d ie, d@e, etc.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Replace leetspeak characters with their letter equivalents
    .split('')
    .map((char) => LEETSPEAK_MAP[char] || char)
    .join('')
    // Remove all special characters, numbers, and punctuation (keep only letters and spaces)
    .replace(/[^a-z\s]/g, ' ')
    // Normalize whitespace (multiple spaces, tabs, etc. become single space)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a message contains blocked words or phrases
 * Always checks DEFAULT_BLOCKED_WORDS plus any custom keywords
 * @param message - The message text to check
 * @param customKeywords - Optional custom keywords/phrases from safety settings (added to default words)
 * @returns Object with isBlocked flag and matched words/phrases
 */
export function checkBlockedWords(
  message: string,
  customKeywords: string[] = []
): { isBlocked: boolean; matchedWords: string[] } {
  const normalizedMessage = normalizeText(message);
  // Always check default words + custom keywords (default words are always active)
  const allKeywords = [...DEFAULT_BLOCKED_WORDS, ...customKeywords];
  const matchedWords: string[] = [];

  for (const keyword of allKeywords) {
    const normalizedKeyword = normalizeText(keyword);
    const keywordWords = normalizedKeyword.split(/\s+/);
    
    // Check if it's a phrase (multiple words) or single word
    if (keywordWords.length > 1) {
      // For phrases, match the entire phrase as a substring
      // This allows matching "home alone" even if there are other words around it
      // After normalization, special chars and spaces are removed, so we match the normalized phrase
      const phrasePattern = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const phraseRegex = new RegExp(phrasePattern, 'i');
      
      if (phraseRegex.test(normalizedMessage)) {
        matchedWords.push(keyword);
      }
    } else {
      // For single words, use word boundary matching (prevents false positives like "class" matching "ass")
      // After normalization, special chars are removed, so "d!e" becomes "die" and will match
      const wordPattern = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`\\b${wordPattern}\\b`, 'i');
      
      if (wordBoundaryRegex.test(normalizedMessage)) {
        matchedWords.push(keyword);
      }
    }
  }

  return {
    isBlocked: matchedWords.length > 0,
    matchedWords,
  };
}

/**
 * Get family safety settings including custom keywords
 * This can be extended to fetch from the database
 */
export async function getFamilySafetyKeywords(familyId: string): Promise<string[]> {
  // TODO: Fetch from families.safety_mode_settings.keywords if implemented
  // For now, return empty array (using default words only)
  return [];
}

