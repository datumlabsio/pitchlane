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
  label: string; // e.g. "Feb 2"
  views: number;
  invites: number;
  impressions: number;
  clicks: number;
};
