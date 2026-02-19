/**
 * PII Detection Service
 * 
 * Provides regex-based detection for sensitive data patterns.
 */

const PII_PATTERNS = [
  {
    type: 'email',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  },
  {
    type: 'api_key',
    regex: /(?:sk|pk|key|api|auth)-(?:live|test)?[a-zA-Z0-9]{20,}/gi
  },
  {
    type: 'ssn',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g
  },
  {
    type: 'phone',
    regex: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g
  }
];

/**
 * Detect PII in a given text
 * @param {string} text 
 * @returns {Array<{type: string, value: string, index: number}>}
 */
export function detectPII(text) {
  if (!text || typeof text !== 'string') return [];

  const results = [];

  for (const pattern of PII_PATTERNS) {
    let match;
    // Reset regex index for global flags
    pattern.regex.lastIndex = 0;
    
    while ((match = pattern.regex.exec(text)) !== null) {
      results.push({
        type: pattern.type,
        value: match[0],
        index: match.index
      });
    }
  }

  // Sort by index
  return results.sort((a, b) => a.index - b.index);
}

/**
 * Mask PII in a given text
 * @param {string} text 
 * @returns {string}
 */
export function maskPII(text) {
  const findings = detectPII(text);
  if (findings.length === 0) return text;

  let maskedText = text;
  // Apply masks from end to beginning to keep indexes valid
  for (let i = findings.length - 1; i >= 0; i--) {
    const finding = findings[i];
    maskedText = maskedText.substring(0, finding.index) + 
                 `[${finding.type.toUpperCase()}_REDACTED]` + 
                 maskedText.substring(finding.index + finding.value.length);
  }

  return maskedText;
}
