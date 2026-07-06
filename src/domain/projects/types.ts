export type ProjectView = {
  id: string;
  accountId: string;
  title: string;
  description: string;
  techStack: string[];
  url: string | null;
  outcome: string | null;
  industry: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type ProjectInput = {
  title: string;
  description: string;
  techStack: string[];
  url?: string | null;
  outcome?: string | null;
  industry?: string | null;
  isActive?: boolean;
};
