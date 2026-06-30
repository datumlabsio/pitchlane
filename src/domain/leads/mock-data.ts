import { evaluateEmail } from "@/domain/leads/evaluate-email";
import type { LeadSummary } from "@/domain/leads/types";
import type { ProfileCardView } from "@/domain/profiles/types";

export const profileCards: ProfileCardView[] = [
  {
    id: "profile-humayun",
    name: "Humayun Jawad",
    roleFocus: "Data Engineering and BI",
    label: "upwork-alerts-humayun",
    threshold: 78,
    tone: "CONSULTATIVE",
    keywords: ["power bi", "sql", "analytics", "dashboard"],
  },
  {
    id: "profile-faizan",
    name: "Faizan Khan",
    roleFocus: "Cloud and Backend Automation",
    label: "upwork-alerts-faizan",
    threshold: 80,
    tone: "EXPERT",
    keywords: ["aws", "terraform", "automation", "python"],
  },
  {
    id: "profile-nidal",
    name: "Nidal",
    roleFocus: "Data Platforms and Reporting",
    label: "upwork-alerts-nidal",
    threshold: 76,
    tone: "DIRECT",
    keywords: ["snowflake", "looker", "etl", "warehouse"],
  },
];

const mockEvaluation = evaluateEmail({
  subject: "Power BI and SQL dashboard specialist needed for recurring analytics work",
  body: "We need a Power BI expert with strong SQL, stakeholder reporting, and dashboard design experience. Budget flexible. Looking for someone who can own the analytics workflow end to end.",
  requiredSkills: ["power bi", "sql", "dashboard"],
  rejectRules: ["unpaid", "telegram", "whatsapp"],
  targetKeywords: ["analytics", "reporting", "dashboard", "power bi"],
});

export const leadSummaries: LeadSummary[] = [
  {
    id: "lead-001",
    title: "Power BI Dashboard Specialist for Executive Reporting",
    profileName: "Humayun Jawad",
    accountId: "acct-001",
    status: "Qualified",
    statusCode: "QUALIFIED",
    matchScore: mockEvaluation.score,
    confidence: "Medium",
    budget: "$1,200 fixed",
    sourceCompleteness: "Partial",
    createdAt: "2h ago",
    proposal: "",
    summary: mockEvaluation.summary,
    sourceUrl: "https://www.upwork.com/jobs/~lead-001",
  },
  {
    id: "lead-002",
    title: "AWS Automation Engineer for Cost Optimization",
    profileName: "Faizan Khan",
    accountId: "acct-002",
    status: "New",
    statusCode: "NEW",
    matchScore: 81,
    confidence: "Low",
    budget: "$45/hr",
    sourceCompleteness: "Partial",
    createdAt: "45m ago",
    proposal: "",
    summary: ["Good keyword overlap, but application data is still missing."],
    sourceUrl: "https://www.upwork.com/jobs/~lead-002",
  },
  {
    id: "lead-003",
    title: "Snowflake and Looker Reporting Lead",
    profileName: "Nidal",
    accountId: "acct-003",
    status: "Applied",
    statusCode: "APPLIED",
    matchScore: 88,
    confidence: "High",
    budget: "$3,500 fixed",
    sourceCompleteness: "Full",
    createdAt: "1d ago",
    proposal: "",
    summary: ["Qualified lead already converted into an application workflow."],
    sourceUrl: "https://www.upwork.com/jobs/~lead-003",
  },
];

export const metrics = [
  { label: "Leads Received", value: "124", note: "+18% this month" },
  { label: "Qualified Rate", value: "42%", note: "Email-only scoring" },
  { label: "Applied", value: "31", note: "Across active profiles" },
  { label: "Connects Spent", value: "146", note: "Tracked per profile" },
];
