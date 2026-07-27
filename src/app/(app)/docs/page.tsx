import { Topbar } from '@/components/layout/topbar';
import { leadLifecycleStatuses, leadStatusLabelMap } from '@/domain/leads/types';
import { stageGuide } from '@/domain/leads/stage-guide';

export const metadata = { title: 'Docs — SalesFlow' };

const TOC = [
  ['lifecycle', 'Pipeline stages'],
  ['flow', 'Where leads come from'],
  ['scoring', 'How scoring works'],
  ['proposals', 'Proposals'],
  ['alerts', 'Slack alerts'],
  ['howto', 'How-tos'],
  ['ownership', 'Data ownership'],
  ['faq', 'FAQ'],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <div className="space-y-3 text-sm leading-6 text-stone-600">{children}</div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-1 text-sm font-semibold text-stone-800">{children}</h3>;
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-medium text-stone-900">{q}</p>
      <div className="mt-1.5 text-sm leading-6 text-stone-600">{children}</div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <Topbar
        title="Docs"
        subtitle="How SalesFlow works: the pipeline, the scoring, the proposals, and what to do at each step."
      />

      <div className="flex flex-wrap gap-2">
        {TOC.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600 transition hover:border-stone-400"
          >
            {label}
          </a>
        ))}
      </div>

      <div className="max-w-3xl space-y-10 pb-16">
        <Section id="lifecycle" title="Pipeline stages">
          <p>
            A lead moves through <strong>10 stages</strong>. Two are automatic (the AI judge sets
            them), the rest are moved by BD using the lifecycle pills on the lead panel — pick a
            stage, then press <strong>Apply</strong>. Every transition is logged with a timestamp
            and who did it (see the Activity tab).
          </p>
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-2.5 font-medium">Stage</th>
                  <th className="px-4 py-2.5 font-medium">Who moves it</th>
                  <th className="px-4 py-2.5 font-medium">What it means</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-stone-100 align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-900">New</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-stone-500">{stageGuide.NEW.who}</td>
                  <td className="px-4 py-2.5">{stageGuide.NEW.meaning}</td>
                </tr>
                {leadLifecycleStatuses.map((s) => (
                  <tr key={s} className="border-b border-stone-100 align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-900">
                      {leadStatusLabelMap[s]}
                      {stageGuide[s].terminal && (
                        <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                          terminal
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-stone-500">{stageGuide[s].who}</td>
                    <td className="px-4 py-2.5">{stageGuide[s].meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <H3>Which terminal stage do I pick?</H3>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Won</strong> — we got the project.</li>
            <li><strong>Lost</strong> — the client engaged (reply, call, discussion) but chose someone else or went permanently silent.</li>
            <li><strong>Hires Other</strong> — the client hired someone else without ever engaging us. Usually straight from Applied.</li>
            <li><strong>Job Closed</strong> — the client closed or deleted the posting. The job no longer exists.</li>
            <li><strong>Rejected</strong> — we chose not to pursue it (or the judge did).</li>
          </ul>
          <p className="text-xs text-stone-500">
            History note: Follow Up, Qualified Lost, and Closed were retired from the status enum.
            Follow-ups live inside Ongoing Discussion, Qualified Lost inside Lost, and Closed inside
            Job Closed.
          </p>
        </Section>

        <Section id="flow" title="Where leads come from">
          <p>
            Each profile&apos;s Upwork job alerts are emailed to that person&apos;s own alert address and
            forwarded into the shared mailbox (<code className="rounded bg-stone-100 px-1 py-0.5 text-xs">sales@datumlabs.io</code>).
            A sync runs every few minutes, routes each email to its profile (by label or by the
            recipient address, so it survives mailbox changes), and creates the lead. You can also
            pull immediately with <strong>Sync now</strong> on the Leads page, or add a lead by hand
            with <strong>Add lead</strong>.
          </p>
          <H3>Why the same job doesn&apos;t appear twice</H3>
          <p>Three dedupe layers run at ingest, in order:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Same email</strong> — the Gmail message was already processed.</li>
            <li><strong>Same job posting</strong> — the job&apos;s ID from its URL already exists on this profile (catches re-alerts and mailbox switches).</li>
            <li><strong>Repost</strong> — a lead with the same title exists on this profile within the last 45 days (clients re-list the same job under a new ID).</li>
          </ul>
          <p>
            The same job <em>can</em> legitimately exist on two different profiles — the lead panel
            shows an “Also matched on N profiles” banner linking the siblings, and only the first
            one alerts Slack.
          </p>
        </Section>

        <Section id="scoring" title="How scoring works">
          <p>
            An AI judge reads each job against the profile&apos;s brief (skills, scope, what the person
            does and doesn&apos;t do — editable under Profiles) and returns a fit score with reasoning.
            It runs on the alert email first, then <strong>again with the full job description</strong> once
            the lead is enriched from Upwork — so scores can change after enrichment, and the
            enriched verdict is the one that counts.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Clear fit</strong> → the lead auto-moves to Qualified and gets a draft proposal.</li>
            <li><strong>Hard reject</strong> (wrong stack, out-of-scope work, no budget) → auto-moves to Rejected. The reasons are on the lead&apos;s Overview.</li>
            <li><strong>Caution</strong> — a partial or uncertain fit <em>also</em> moves to Qualified, keeping its ⚠ flags in the summary. New is transient: every scored lead ends up Qualified or Rejected, so the human decision happens in Qualified, before applying.</li>
          </ul>
          <p>
            In the background, each new lead is also judged against the <em>other</em> profiles&apos;
            briefs. When another persona clearly fits, an amber <strong>“Also fits”</strong> chip
            appears on the lead panel — click it to open the multi-profile apply dialog with those
            profiles pre-selected. Suggestions only; nothing is copied automatically.
          </p>
          <p>
            The judge never overrides a human decision: once BD has moved a lead anywhere, scoring
            only records evaluations, it doesn&apos;t change the stage.
          </p>
        </Section>

        <Section id="proposals" title="Proposals">
          <p>
            Drafts are generated for qualified leads and on demand (Generate / Regenerate on the
            Proposal tab). Every draft is grounded in the profile&apos;s brief and its{' '}
            <strong>portfolio projects</strong> (Profiles → Projects): the most relevant projects by
            tech overlap are cited with their links. The “Cite these projects” chips on the Proposal
            tab show exactly what will be cited — toggle them before regenerating.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>If the job post asks screening questions, the draft answers every one under an <strong>Answers:</strong> block — never skip these when applying.</li>
            <li>Use the feedback box to rewrite a draft with specific instructions instead of editing from scratch.</li>
            <li>Keep your Projects list fresh — proposals only cite what&apos;s there, and never invent work.</li>
          </ul>
          <H3>After you apply: the review trail</H3>
          <p>
            On the <strong>Application tab</strong>, paste the proposal exactly as submitted into{' '}
            <strong>“Proposal used to apply”</strong> (one click copies the current draft). Managers
            review it there, leave <strong>feedback</strong> for BD (it lands in the Activity feed
            with their name), and tick <strong>BU reviewed</strong> once the internal review happened.
            Separately, tick <strong>Viewed by client</strong> when Upwork shows the client opened the
            proposal — it becomes the green double tick on the lead (grey = not viewed yet). Log{' '}
            <strong>connects refunded</strong> on the same tab when Upwork returns connects for a
            closed job.
          </p>
        </Section>

        <Section id="alerts" title="Slack alerts">
          <p>A lead pings Slack only when all of these hold:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>it just enriched for the first time (crons and re-enrichment stay quiet),</li>
            <li>it qualified — alerts mirror the triage outcome (a Settings “alert floor”, default 0, can silence low-scoring qualified leads if the channel gets noisy),</li>
            <li>the judge didn&apos;t reject it,</li>
            <li>the alert email is less than <strong>24 hours old</strong> (backfilled or stale jobs never ping),</li>
            <li>no sibling profile already alerted for the same job.</li>
          </ul>
          <p>The 🟢 dot marks leads above the hot-score threshold; ⚪ is above the alert floor but below hot.</p>
        </Section>

        <Section id="howto" title="How-tos">
          <H3>Apply from a different profile — or several</H3>
          <p>
            Two distinct actions on the lead panel header:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Move</strong> — the profile dropdown (also in the list&apos;s Profile column).
              The lead transfers to that profile, is re-scored against their brief, and the old
              draft is retired so a new one generates in their voice.
            </li>
            <li>
              <strong>Also apply from…</strong> — pick multiple profiles and a linked{' '}
              <strong>copy</strong> is created on each: re-scored by the judge for that person,
              with its own proposal and lifecycle. Copies appear under “Also matched on N
              profiles”. Remember each application spends that profile&apos;s connects, and only the
              first alert pings Slack.
            </li>
          </ul>
          <H3>Kanban board</H3>
          <p>
            The <strong>Board</strong> toggle on the Leads page shows the pipeline as columns.
            Drag a card to move it between stages — dropping on <strong>Applied</strong> asks for
            the connects spent and stamps the applied time, exactly like the panel flow. Clicking
            a card opens the usual lead panel. Filters apply to the board too.
          </p>
          <H3>Daily digest</H3>
          <p>
            Every morning at 9:00 (PKT) Slack gets yesterday&apos;s funnel rates, connect spend,
            and a per-profile table (In / Qual / App / Proposal viewed / BU reviewed) with a
            severity signal so low convertors float to the top.
          </p>
          <H3>Metrics drill-down</H3>
          <p>
            On the Metrics page, the funnel rows, the status breakdown, and the per-profile bars
            are clickable — each opens the Leads list filtered to exactly the leads behind that
            number.
          </p>
          <H3>Filters and search</H3>
          <p>
            Filters on the Leads page (profile, status, date, search) persist while you open and
            close leads. Search matches titles, email content, and pasted Upwork job URLs.
          </p>
        </Section>

        <Section id="ownership" title="Data ownership">
          <p>
            SalesFlow is the single source of truth for Upwork performance — nothing gets reported
            that isn&apos;t logged here. BD owns this data entry as a core responsibility; gaps mean
            blind spots in reporting.
          </p>
          <H3>1. Automatic leads (from job alerts)</H3>
          <p>
            After applying, update the lead immediately: move it to Applied, log connects spent,
            log the applied date, and confirm the correct profile name is on the lead. Tracking
            which profiles receive and convert leads depends on it.
          </p>
          <H3>2. Manually sourced jobs</H3>
          <p>
            Any job found via manual search must be logged with <strong>Add lead</strong>. Applying
            first is fine, but enter the lead right after, in the same sitting — not batched for
            later. On entry, log: Applied status and connects spent, the job posting date and
            applied date, and the profile used to apply.
          </p>
          <H3>3. Weekly profile stats</H3>
          <p>
            Upwork profile views and invites are entered per week under Profiles → (person) →
            Stats, and feed the Metrics page.
          </p>
          <H3>4. Weekly outcome sweep</H3>
          <p>
            Once a week, review every open Applied-or-later lead and move it to the correct
            terminal stage:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Won</strong> — we got the project.</li>
            <li><strong>Lost</strong> — client engaged but chose someone else or went silent.</li>
            <li><strong>Hires Other</strong> — client hired someone else without engaging us.</li>
            <li><strong>Job Closed</strong> — posting was closed or deleted.</li>
            <li><strong>Rejected</strong> — decided not to pursue it after all.</li>
          </ul>
        </Section>

        <Section id="faq" title="FAQ">
          <div className="space-y-3">
            <Faq q="Why was this lead rejected automatically?">
              The judge hard-rejected it — the Overview tab lists the reasons (e.g. wrong stack,
              out-of-scope work, no budget). If you disagree, just move it with the lifecycle
              pills; the judge never overrides a human.
            </Faq>
            <Faq q="Why didn't this lead ping Slack?">
              Check the alert conditions above — most commonly the score was ≤30%, the alert email
              was older than 24h (backfill), or a sibling profile already alerted for the same job.
            </Faq>
            <Faq q="The same job is on two profiles — is that a bug?">
              No. Either Upwork alerted both profiles (both saved searches matched), or someone
              used “Also apply from…” to pursue it from several profiles deliberately. The lead
              panel links the siblings either way, and each copy has its own score, proposal, and
              lifecycle.
            </Faq>
            <Faq q="Why did the score change after a while?">
              The first score comes from the alert email alone. Once the full job description is
              fetched from Upwork, the judge re-scores with the complete picture — that score
              stands.
            </Faq>
            <Faq q="Who changed this lead's status?">
              Open the Activity tab — every transition shows a timestamp and a “by {'{name}'}” chip
              (or “system” for automatic moves).
            </Faq>
            <Faq q="What happened to Follow Up / Qualified Lost / Closed?">
              Retired from the status list. Follow-ups live inside Ongoing Discussion, Qualified
              Lost inside Lost, and Closed inside Job Closed. Activity history that mentioned them
              is unchanged.
            </Faq>
          </div>
        </Section>
      </div>
    </div>
  );
}
