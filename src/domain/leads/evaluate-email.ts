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

// Hard vetoes — reject rules that kill a lead no matter how well the skills match.
// Two kinds: (1) commercial / engagement dealbreakers — an unpaid or entry-level job
// is a no even if it's a perfect fit; (2) whole *domains* the profile won't work in —
// a mobile-app or Shopify build is that job, not an "incidental" mention, so a strong
// web/data skill match shouldn't excuse it. Every OTHER reject rule (WordPress, PHP,
// Laravel — legacy tech that turns up in passing during migrations) is a *soft* reject
// that a strong core match downgrades to a caution.
const ALWAYS_VETO = [
  // commercial / engagement
  "no budget",
  "unpaid",
  "entry level",
  "free trial",
  "no pay",
  "equity only",
  "revenue share",
  "commission only",
  "spec work",
  "volunteer",
  // wrong-domain (rarely incidental)
  "mobile app",
  "mobile development",
  "react native",
  "flutter",
  "ios app",
  "android app",
  "shopify",
  "woocommerce",
];
function isHardDealbreaker(rule: string): boolean {
  const r = normalize(rule);
  return ALWAYS_VETO.some((v) => r.includes(v));
}

// Lines that should NOT trigger reject rules. Upwork alert emails auto-tag each job
// with skills (links into Upwork's job search) — that's Upwork's classification, not
// the client's requirement — and clients routinely list off-limits tech as optional
// ("or similar", "open to recommendations", "possible/preferred stack", "nice to
// have", "not required"). A blacklisted term in either place isn't a real reject.
const REJECT_SKIP_LINE =
  /upwork\.com\/[^\s]*search\/jobs|(?:^|\s)skills:\s*$|\bor similar\b|\bopen to\b|possible (?:tech )?stack|preferred (?:tech )?stack|nice[ -]?to[ -]?have|we are open|flexible on|not required/;
function rejectScope(lowerText: string): string {
  return lowerText
    .split("\n")
    .filter((line) => !REJECT_SKIP_LINE.test(line))
    .join(" ");
}

export function evaluateEmail(input: EvaluateEmailInput): EvaluationResult {
  const text = `${input.subject}\n${input.body}`.toLowerCase();
  const normText = normalize(text);
  const weights = { ...DEFAULT_WEIGHTS, ...(input.scoringWeights ?? {}) };

  // Reject rules match against a cleaned copy of the text (Upwork skill-tags and
  // explicitly-optional tech stripped out); positive matching still uses the full text.
  const rejectNorm = normalize(rejectScope(text));
  const rejectionReasons = input.rejectRules.filter((rule) => hasReject(rejectNorm, rule));
  const matchedSkills = input.requiredSkills.filter((skill) => hasTerm(normText, skill));
  const matchedNiceToHave = (input.niceToHaveSkills ?? []).filter((skill) => hasTerm(normText, skill));
  const matchedKeywords = input.targetKeywords.filter((kw) => hasTerm(normText, kw));
  const matchedRoles = (input.targetRoles ?? []).filter((role) => hasTerm(normText, role));

  // A reject flags the lead, but a *soft* reject only vetoes it when the fit is weak.
  // A strong core-stack match (≥3 required skills, or ≥50% of them) means a legacy
  // technology is likely mentioned in passing (e.g. "replace our old PHP system with
  // a Node.js API") and shouldn't kill an obvious fit — those downgrade to a caution.
  // Hard vetoes (commercial dealbreakers + wrong-domain work) always win (ALWAYS_VETO).
  const strongCoreMatch =
    matchedSkills.length >= 3 ||
    (input.requiredSkills.length > 0 &&
      matchedSkills.length / input.requiredSkills.length >= 0.5);
  const vetoed =
    rejectionReasons.some(isHardDealbreaker) ||
    (rejectionReasons.length > 0 && !strongCoreMatch);
  const hardFilterPassed = matchedSkills.length > 0 && !vetoed;

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
