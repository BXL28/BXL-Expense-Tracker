"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Handles Supabase OAuth return (PKCE / URL params). Use a single callback path
 * in Supabase → Authentication → Redirect URLs, e.g.
 * https://yoursite.vercel.app/auth/callback
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    let timeoutId = 0;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled || !session?.user) return;
      window.clearTimeout(timeoutId);
      router.replace("/dashboard");
    });

    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        router.replace("/dashboard");
        return;
      }
      setMessage("Almost there…");
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        void supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (cancelled) return;
          router.replace(s?.user ? "/dashboard" : "/login");
        });
      }, 10_000);
    };

    void run();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
      <p className="text-sm">{message}</p>
    </main>
  );
}
