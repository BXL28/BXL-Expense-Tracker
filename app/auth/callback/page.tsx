"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Handles the Supabase OAuth return for both PKCE and implicit flows.
 *
 * The Supabase JS v2 client processes the code/token in the URL automatically
 * during initialization. onAuthStateChange always delivers the current auth
 * state to new subscribers, so we just listen and redirect when ready.
 * Calling getSession() or exchangeCodeForSession() here conflicts with that
 * internal exchange and causes "code already used" failures.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let redirected = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (redirected) return;
        if (session?.user) {
          redirected = true;
          router.replace("/dashboard");
        }
      }
    );

    const timeout = window.setTimeout(() => {
      if (!redirected) {
        setMessage("Something went wrong. Redirecting…");
        window.setTimeout(() => router.replace("/login"), 1_000);
      }
    }, 6_000);

    return () => {
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
      <p className="text-sm">{message}</p>
    </main>
  );
}
