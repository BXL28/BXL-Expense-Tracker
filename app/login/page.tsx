"use client";

import { useState } from "react";
import { Chrome } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback`
              : undefined,
        },
      });

      if (error) {
        setErrorMessage(error.message);
      }
    } catch {
      setErrorMessage("Unable to sign in right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2">
            <BrandMark heightClass="h-11" />
            <span className="text-sm font-semibold text-slate-800">BXL Expense Tracker</span>
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-bxl-moss bg-bxl-forest px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-bxl-moss disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Chrome className="h-4 w-4" />
            {isLoading ? "Syncing..." : "Sync with Gmail"}
          </button>

          {errorMessage ? (
            <p className="mt-3 text-sm text-rose-600">{errorMessage}</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
