import type { ProfileConfig } from '@prisma/client';

/**
 * The natural-language profile brief handed to the LLM judge. `jdSummary` is the
 * freelancer's own summary (also used to ground proposals); we append target roles
 * and explicit "avoid" rules so the judge knows scope + boundaries. A hand-tuned
 * jdSummary can carry richer routing guidance directly (e.g. "deep LLM/RAG → Abdur").
 */
export function buildProfileBrief(config: ProfileConfig): string {
  const parts = [config.jdSummary?.trim() || `${config.name} — ${config.roleFocus}.`];
  if (config.targetRoles.length) parts.push(`Target roles: ${config.targetRoles.join(', ')}.`);
  if (config.rejectRules.length) parts.push(`Out of scope / avoid: ${config.rejectRules.join(', ')}.`);
  if (config.budgetPreference) parts.push(`Budget preference: ${config.budgetPreference}.`);
  return parts.join('\n\n');
}
