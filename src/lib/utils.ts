import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Boilerplate lines to drop from a forwarded Upwork alert email.
const EMAIL_BOILERPLATE = [
  /^new job alert$/i,
  /^hi\b[^,\n]*,?\s*$/i,
  /this job was just posted/i,
  /matches your alert settings/i,
  /^posted$/i,
  /^view job$/i,
  /^submit a proposal$/i,
  /^see (more|other) jobs/i,
  /^best regards/i,
  /^the upwork team$/i,
];

// Once any of these is hit, everything after is footer junk.
const EMAIL_FOOTER = [
  /you('|’| a)?re receiving this/i,
  /unsubscribe/i,
  /upwork global/i,
  /privacy policy/i,
  /manage.*(settings|notifications|preferences)/i,
  /download the upwork app/i,
  /©\s*\d{4}/,
  /all rights reserved/i,
];

/**
 * Turn a raw forwarded Upwork email body into a clean, readable brief —
 * strips logos, greeting, alert boilerplate, links, and the footer.
 */
export function cleanEmailBrief(raw: string): string {
  if (!raw) return "";
  let text = raw;
  text = text.replace(/\[image:[^\]]*\]/gi, " "); // [image: Upwork]
  text = text.replace(/\[([^\]]+)\]\(https?:[^)]+\)/gi, "$1"); // [text](url) -> text
  text = text.replace(/<https?:\/\/[^>]*>/gi, " "); // <https://...>
  text = text.replace(/https?:\/\/\S+/gi, " "); // bare urls

  const out: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[ \t]+/g, " ").trim();
    if (!line) continue;
    if (EMAIL_FOOTER.some((re) => re.test(line))) break;
    if (EMAIL_BOILERPLATE.some((re) => re.test(line))) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
