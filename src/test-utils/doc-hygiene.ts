/**
 * Documentation hygiene scanner for demo-studio authoring artifacts.
 *
 * Detects representative secret, environment, and private-artifact patterns in
 * markdown and other text docs. Downstream hosts can extend detection via
 * `additionalPatterns`.
 */

export interface DocHygieneViolation {
  pattern: string;
  line: number;
  excerpt: string;
}

export interface DocHygieneOptions {
  /** Host-specific patterns to treat as banned content. */
  additionalPatterns?: RegExp[];
  /** Patterns that override default bans when matched on the same line. */
  allowedPatterns?: RegExp[];
}

interface BannedPattern {
  label: string;
  regex: RegExp;
}

const DEFAULT_BANNED_PATTERNS: readonly BannedPattern[] = [
  { label: "api-key-assignment", regex: /\b(?:api[_-]?key|secret|token)\s*=\s*\S+/i },
  { label: "openai-sk-token", regex: /\bsk-(?:proj-)?[A-Za-z0-9]{8,}\b/ },
  { label: "github-pat", regex: /\bghp_[A-Za-z0-9]{20,}\b/ },
  { label: "env-file-reference", regex: /\.env(?:\.[A-Za-z0-9_-]+)?\b/i },
  { label: "private-artifact-path", regex: /\.(?:sealed|pem|key|p12)\b/i },
  { label: "custody-artifact-path", regex: /custody\/|\.custodian\./i },
  { label: "email-address", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { label: "invite-token", regex: /\binvite[_-]?token\s*=\s*\S+/i },
];

function lineMatchesPattern(line: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  return pattern.test(line);
}

function isLineAllowed(line: string, allowedPatterns: RegExp[] | undefined): boolean {
  if (!allowedPatterns || allowedPatterns.length === 0) {
    return false;
  }

  return allowedPatterns.some((pattern) => lineMatchesPattern(line, pattern));
}

function collectPatterns(options?: DocHygieneOptions): BannedPattern[] {
  const patterns: BannedPattern[] = [...DEFAULT_BANNED_PATTERNS];

  for (const regex of options?.additionalPatterns ?? []) {
    patterns.push({
      label: regex.source,
      regex,
    });
  }

  return patterns;
}

/**
 * Scan document content for banned secret, env, and private-artifact patterns.
 *
 * Returns an empty array when the document is clean. Each violation includes
 * the matched pattern label, 1-based line number, and a trimmed excerpt.
 */
export function scanDocForBannedContent(
  content: string,
  options?: DocHygieneOptions,
): DocHygieneViolation[] {
  const patterns = collectPatterns(options);
  const violations: DocHygieneViolation[] = [];
  const lines = content.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (isLineAllowed(line, options?.allowedPatterns)) {
      continue;
    }

    for (const pattern of patterns) {
      if (!lineMatchesPattern(line, pattern.regex)) {
        continue;
      }

      violations.push({
        pattern: pattern.label,
        line: index + 1,
        excerpt: line.trim().slice(0, 160),
      });
      break;
    }
  }

  return violations;
}
