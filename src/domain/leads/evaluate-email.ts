import type { EvaluationResult } from "@/domain/leads/types";

type ScoringWeights = {
  skillMatch?: number;
  roleFit?: number;
  keywordMatch?: number;
  budgetFit?: number;
  confidence?: number;
};

const DEFAULT_WEIGHTS: Required<ScoringWeights> = {
  skillMatch: 0.35,
  roleFit: 0.25,
  keywordMatch: 0.2,
  budgetFit: 0.1,
  confidence: 0.1,
};

type EvaluateEmailInput = {
  subject: string;
  body: string;
  requiredSkills: string[];
  niceToHaveSkills?: string[];
  rejectRules: string[];
  targetKeywords: string[];
  targetRoles?: string[];
  budgetPreference?: string;
  scoringWeights?: ScoringWeights | null;
};

// Lowercase, turn punctuation (. _ / - , & ()) into spaces, collapse, and pad —
// so "Next.js" ≈ "next js" and "Full-Stack" ≈ "full stack" all match cleanly.
function normalize(s: string): string {
  return ` ${s.toLowerCase().replace(/[._/\-,&()]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

// A single word is "present" if it starts at a word boundary. ≥3-char words allow a
// trailing continuation (so "dashboard" matches "dashboards"); ≤2-char words ("ai")
// must be a whole word to avoid matching "air"/"aid".
function wordHit(normText: string, word: string): boolean {
  return word.length <= 2 ? normText.includes(` ${word} `) : normText.includes(` ${word}`);
}

// Lenient positive match (skills/roles/keywords — we WANT to catch fits): the term
// appears as a phrase, OR every word of a multi-word term is present (so
// "Full Stack Developer" matches "Full-Stack Web Developer").
function hasTerm(normText: string, term: string): boolean {
  const t = normalize(term).trim();
  if (!t) return false;
  if (normText.includes(` ${t}`)) return true;
  const words = t.split(' ');
  return words.length > 1 && words.every((w) => wordHit(normText, w));
}

// Strict reject match: contiguous phrase only — so "mobile app" never rejects a
// "mobile-responsive web app".
function hasReject(normText: string, rule: string): boolean {
  const r = normalize(rule).trim();
  return Boolean(r) && normText.includes(` ${r}`);
}

export function evaluateEmail(input: EvaluateEmailInput): EvaluationResult {
  const text = `${input.subject}\n${input.body}`.toLowerCase();
  const normText = normalize(text);
  const weights = { ...DEFAULT_WEIGHTS, ...(input.scoringWeights ?? {}) };

  const rejectionReasons = input.rejectRules.filter((rule) => hasReject(normText, rule));
  const matchedSkills = input.requiredSkills.filter((skill) => hasTerm(normText, skill));
  const matchedNiceToHave = (input.niceToHaveSkills ?? []).filter((skill) => hasTerm(normText, skill));
  const matchedKeywords = input.targetKeywords.filter((kw) => hasTerm(normText, kw));
  const matchedRoles = (input.targetRoles ?? []).filter((role) => hasTerm(normText, role));

  const hardFilterPassed = matchedSkills.length > 0 && rejectionReasons.length === 0;

  // Component scores (0–100)
  const skillMatchScore = input.requiredSkills.length > 0
    ? (matchedSkills.length / input.requiredSkills.length) * 100
    : 50;

  const roleFitScore = (input.targetRoles ?? []).length > 0
    ? (matchedRoles.length / input.targetRoles!.length) * 100
    : 50;

  const keywordMatchScore = input.targetKeywords.length > 0
    ? (matchedKeywords.length / input.targetKeywords.length) * 100
    : 50;

  // Budget fit: check how many budget-preference words appear in text
  const budgetFitScore = input.budgetPreference
    ? input.budgetPreference.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && text.includes(w)).length >= 2
      ? 80
      : 50
    : 50;

  const confidenceRaw = text.length > 800 ? 80 : text.length > 300 ? 65 : 45;

  const rawScore =
    skillMatchScore * weights.skillMatch +
    roleFitScore * weights.roleFit +
    keywordMatchScore * weights.keywordMatch +
    budgetFitScore * weights.budgetFit +
    confidenceRaw * weights.confidence;

  // Nice-to-have bonus capped at 8 pts
  const niceBonus = Math.min(8, matchedNiceToHave.length * 4);

  const score = Math.round(Math.min(95, rawScore + niceBonus));
  const confidence = Math.round(
    Math.min(95, confidenceRaw + (matchedSkills.length + matchedKeywords.length) * 2),
  );

  const summary = [
    matchedSkills.length
      ? `Matched ${matchedSkills.length} of ${input.requiredSkills.length} required skills (${matchedSkills.slice(0, 3).join(', ')}).`
      : 'No required skills detected — needs manual review before applying.',
    matchedKeywords.length
      ? `${matchedKeywords.length} role keyword${matchedKeywords.length > 1 ? 's' : ''} matched (${matchedKeywords.slice(0, 3).join(', ')}).`
      : 'Keyword signal is weak — keep reviewer-assisted.',
    matchedNiceToHave.length
      ? `${matchedNiceToHave.length} bonus skill${matchedNiceToHave.length > 1 ? 's' : ''} found (${matchedNiceToHave.slice(0, 3).join(', ')}).`
      : 'No nice-to-have skills found in the email body.',
  ];

  return { score, confidence, hardFilterPassed, rejectionReasons, matchedKeywords, summary };
}
