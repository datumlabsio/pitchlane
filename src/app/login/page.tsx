'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogleSignIn() {
    setPending(true);
    setError('');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: supabaseError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            // Prompt account chooser every time so team members can switch accounts
            prompt: 'select_account',
          },
        },
      });
      if (supabaseError) setError(supabaseError.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPending(false);
    }
    // Don't set pending=false on success — browser redirects away
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold tracking-tight text-stone-950">SalesFlow</p>
          <p className="mt-1 text-sm text-stone-500">Upwork lead intelligence</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-stone-950">Sign in</h1>
          <p className="mb-6 text-sm text-stone-500">Use your Google account to access SalesFlow.</p>

          <button
            type="button"
            disabled={pending}
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {/* Google "G" logo */}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              />
            </svg>
            {pending ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {error && (
            <p className="mt-4 text-center text-sm text-rose-600">{error}</p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-stone-400">
          Access restricted to authorized team members.
        </p>
      </div>
    </div>
  );
}
