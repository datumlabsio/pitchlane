export type ProfileStatView = {
  id: string;
  accountId: string;
  weekStart: string; // yyyy-MM-dd
  views: number;
  invites: number;
  impressions: number;
  clicks: number;
};

export type ProfileStatInput = {
  accountId: string;
  weekStart: string; // yyyy-MM-dd
  views: number;
  invites: number;
  impressions: number;
  clicks: number;
};

// One point in the combined visibility time-series (summed across filtered profiles).
export type VisibilityPoint = {
  week: string; // yyyy-MM-dd (week start) — used for client-side monthly rollup
  label: string; // e.g. "Feb 2"
  views: number;
  invites: number;
  impressions: number;
  clicks: number;
};

export type ProfileVisibilityMetricDelta =
  | { kind: 'hidden' }
  | { kind: 'no-data' }
  | { kind: 'na' }
  | {
      kind: 'count';
      previous: number;
      currentValue: number;
      absDelta: number;
      pctDelta: number | null;
      direction: 'up' | 'down' | 'flat';
    };

export type ProfileVisibilityCell = {
  value: number;
  delta: ProfileVisibilityMetricDelta;
};

export type ProfileVisibilityTableRow = {
  profile: string;
  accountId?: string;
  views: ProfileVisibilityCell;
  invites: ProfileVisibilityCell;
  impressions: ProfileVisibilityCell;
  clicks: ProfileVisibilityCell;
};

export type ProfileVisibilityTable = {
  comparisonLabel: string;
  rows: ProfileVisibilityTableRow[];
  total: ProfileVisibilityTableRow;
};
