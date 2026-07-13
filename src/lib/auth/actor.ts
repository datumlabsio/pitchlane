import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Who is performing the current action, for event attribution ("who changed what").
 * Reads the signed-in Supabase user from the request cookies; returns "system" when
 * there is no session (crons, background enrichment, scripts) or when running
 * outside a request context entirely. Never throws — attribution must not break
 * the action being attributed.
 */
export async function getActorName(): Promise<string> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return 'system';
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const name = [meta.full_name, meta.name].find(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    );
    return name?.trim() || user.email || 'system';
  } catch {
    return 'system';
  }
}
