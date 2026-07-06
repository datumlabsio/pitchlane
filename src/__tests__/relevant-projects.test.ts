import { describe, expect, it } from 'vitest';

import { appendProjectsToSummary, rankProjects } from '@/domain/projects/relevant-projects';

const PROJECTS = [
  { title: 'ATS platform', techStack: ['Next.js', 'PostgreSQL', 'Claude API'], industry: 'recruiting' },
  { title: 'Vue storefront', techStack: ['Vue.js', 'Nuxt', 'Stripe'], industry: 'retail' },
  { title: 'Data dashboard', techStack: ['React', 'D3.js', 'Supabase'], industry: null },
].map((p, i) => ({ ...p, id: `p${i}`, description: 'desc', url: null, outcome: null }));

describe('rankProjects', () => {
  it('ranks by tech-stack overlap and drops zero-match projects', () => {
    const job = 'Build a Next.js app with PostgreSQL and a React dashboard.';
    const ranked = rankProjects(PROJECTS, job);
    expect(ranked.map((p) => p.title)).toEqual(['ATS platform', 'Data dashboard']);
  });

  it('matches tech variants through normalization (Vue.js ≈ vue js, D3.js ≈ d3)', () => {
    const ranked = rankProjects(PROJECTS, 'Migrate our vue js shop and add d3 charts');
    expect(ranked.map((p) => p.title)).toEqual(['Vue storefront', 'Data dashboard']);
  });

  it('counts industry as a weaker signal than stack overlap', () => {
    const ranked = rankProjects(PROJECTS, 'A recruiting tool built on Vue.js and Nuxt and Stripe');
    // Vue storefront: 3 stack hits (6) beats ATS platform: industry only (1).
    expect(ranked[0].title).toBe('Vue storefront');
    expect(ranked[1].title).toBe('ATS platform');
  });

  it('respects the limit', () => {
    const job = 'Next.js PostgreSQL Vue Nuxt React D3 Supabase Stripe recruiting';
    expect(rankProjects(PROJECTS, job, 2)).toHaveLength(2);
  });
});

describe('appendProjectsToSummary', () => {
  it('returns the summary untouched when no projects match', () => {
    expect(appendProjectsToSummary('About me.', [])).toBe('About me.');
  });

  it('appends projects with verbatim links and anti-invention guardrails', () => {
    const out = appendProjectsToSummary('About me.', [
      {
        title: 'ATS platform',
        description: 'Multi-profile lead pipeline.',
        techStack: ['Next.js', 'Claude API'],
        url: 'https://example.com/case-study',
        outcome: 'cut triage time 60%',
      },
    ]);
    expect(out).toContain('About me.');
    expect(out).toContain('RELEVANT PAST PROJECTS');
    expect(out).toContain('Never invent projects');
    expect(out).toContain('- ATS platform: Multi-profile lead pipeline.');
    expect(out).toContain('Stack: Next.js, Claude API.');
    expect(out).toContain('Outcome: cut triage time 60%.');
    expect(out).toContain('Link: https://example.com/case-study');
  });
});
