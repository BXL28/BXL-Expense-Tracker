"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Chrome, MailCheck, ShieldCheck } from "lucide-react";
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
              ? `${window.location.origin}/dashboard`
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
      <section className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-10 px-6 py-10 md:grid-cols-2 md:items-center md:px-10">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <BrandMark heightClass="h-11" />
            <span className="text-sm font-semibold text-slate-800">BXL Expense Tracker</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Automate expense tracking from your bank email alerts.
          </h1>
          <p className="max-w-xl text-base text-slate-600 sm:text-lg">
            Connect once, and BXL syncs email transaction alerts into a clean
            monthly view so you can manage spend without manual entry.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FeaturePill
              icon={<MailCheck className="h-4 w-4" />}
              label="Email-to-Expense Sync"
            />
            <FeaturePill
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Private, user-isolated data"
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to view your synced transactions and budget insights.
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-bxl-moss bg-bxl-forest px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-bxl-moss disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Chrome className="h-4 w-4" />
            {isLoading ? "Signing in..." : "Sign in with Google"}
          </button>

          {errorMessage ? (
            <p className="mt-3 text-sm text-rose-600">{errorMessage}</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function FeaturePill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-bxl-moss/15 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
      {icon}
      <span>{label}</span>
    </div>
  );
}
