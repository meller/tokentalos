/**
 * TokenTalos Security Engine (OWASP LLM Top 10)
 * 
 * Implements scanning for Prompt Injection (LLM01) and 
 * Sensitive Data/Secret Disclosure (LLM06).
 */

const INJECTION_PATTERNS = [
  { name: 'Ignore Instructions', regex: /ignore (all )?(previous|prior) instructions/i, severity: 'high' },
  { name: 'System Override', regex: /you are now (a|an) (admin|system|root|developer)/i, severity: 'critical' },
  { name: 'DAN Mode', regex: /do anything now|dan mode/i, severity: 'high' },
  { name: 'Output Redirection', regex: /stop (all )?filtering|disable safety/i, severity: 'critical' },
  { name: 'XML Escape Attempt', regex: /<\/?[a-zA-Z0-9_]+>/i, severity: 'medium' }, // Tag escaping
  { name: 'Roleplay Jailbreak', regex: /let's play a game|hypothetically speaking/i, severity: 'medium' }
];

const SECRET_PATTERNS = [
  { name: 'Generic API Key', regex: /key-[a-zA-Z0-9]{32,}/i, severity: 'high' },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/, severity: 'critical' },
  { name: 'AWS Secret Key', regex: /aws_secret_access_key/i, severity: 'critical' },
  { name: 'Stripe API Key', regex: /sk_test_[0-9a-zA-Z]{24}|sk_live_[0-9a-zA-Z]{24}/, severity: 'critical' },
  { name: 'GitHub Token', regex: /ghp_[a-zA-Z0-9]{36}/, severity: 'high' },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{35}/, severity: 'high' },
  { name: 'Slack Webhook', regex: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/, severity: 'medium' }
];

/**
 * Scans content for prompt injection patterns.
 */
export function scanForInjections(content) {
  const findings = [];
  if (!content || typeof content !== 'string') return findings;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(content)) {
      findings.push({
        type: 'injection',
        name: pattern.name,
        severity: pattern.severity,
        description: `Potential injection pattern detected: ${pattern.name}`
      });
    }
  }
  return findings;
}

/**
 * Scans content for secrets and credentials.
 */
export function scanForSecrets(content) {
  const findings = [];
  if (!content || typeof content !== 'string') return findings;

  // 1. Pattern Matching
  for (const pattern of SECRET_PATTERNS) {
    const match = content.match(pattern.regex);
    if (match) {
      findings.push({
        type: 'secret',
        name: pattern.name,
        severity: pattern.severity,
        description: `Potential secret detected: ${pattern.name}`,
        match: match[0].substring(0, 4) + '...' // Only log start of secret
      });
    }
  }

  // 2. High Entropy Check (Heuristic for unknown keys)
  // Look for strings of 32+ chars with no spaces
  const entropyMatch = content.match(/[a-zA-Z0-9/+]{32,}/g);
  if (entropyMatch) {
    for (const token of entropyMatch) {
      if (calculateEntropy(token) > 4.0) {
        findings.push({
          type: 'secret',
          name: 'High Entropy Token',
          severity: 'medium',
          description: 'High-entropy string detected (likely a key or token).'
        });
      }
    }
  }

  return findings;
}

/**
 * Shannon Entropy calculation helper.
 */
function calculateEntropy(str) {
  const len = str.length;
  const frequencies = Array.from(str).reduce((acc, char) => {
    acc[char] = (acc[char] || 0) + 1;
    return acc;
  }, {});

  return Object.values(frequencies).reduce((sum, f) => {
    const p = f / len;
    return sum - p * Math.log2(p);
  }, 0);
}
