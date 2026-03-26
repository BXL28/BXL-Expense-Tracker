import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CreditCard,
  Lock,
  Pencil,
  PiggyBank,
  RefreshCw,
} from "lucide-react";

function PlaceholderImage({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  // Lightweight wrapper so the marketing page stays consistent.
  return (
    <figure className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={label}
        src={src}
        className="h-56 w-full object-cover"
      />
      <figcaption className="absolute bottom-3 left-3 rounded-xl bg-slate-900/80 px-3 py-2 text-xs font-medium text-white">
        {label}
      </figcaption>
    </figure>
  );
}

function FeatureBlock({
  icon,
  eyebrow,
  title,
  description,
  imageSrc,
  imageLabel,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  imageLabel: string;
}) {
  return (
    <div className="grid gap-8 md:grid-cols-2 md:items-center">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-bxl-moss/10 text-bxl-moss">
            {icon}
          </span>
          {eyebrow}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="text-sm leading-relaxed text-slate-600">{description}</p>
      </div>

      <PlaceholderImage src={imageSrc} label={imageLabel} />
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <div className="flex items-center gap-3">
          <BrandMark heightClass="h-11 sm:h-12" />
          <div>
            <p className="text-sm font-semibold text-slate-800">BXL Expense Tracker</p>
            <p className="text-xs text-slate-500">Email alerts to dashboard, budget, and digest</p>
          </div>
        </div>

        <nav className="hidden items-center gap-3 sm:flex">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-bxl-moss/30 bg-white px-4 py-2 text-sm font-medium text-bxl-moss hover:bg-white/70"
          >
            Try it
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-2">
        <div className="grid gap-8 md:grid-cols-2 md:items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-bxl-moss/10 text-bxl-moss">
                <RefreshCw className="h-4 w-4" />
              </span>
              How it works (the setup I use)
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Scotia email alerts to an editable dashboard + a week-locked digest email.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              I built this for my own budgeting: connect Gmail once, sync the Scotia “Last five
              transactions” emails into transaction rows, set a monthly budget, and let the digest
              email send automatically on a weekday (with week-to-week de-duping).
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-bxl-forest px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-bxl-moss"
              >
                Try it
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                See the dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <PlaceholderImage
              src="/images/weekly-email-placeholder.svg"
              label="Weekly digest email (placeholder)"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl space-y-16 px-6 pb-20">
        <FeatureBlock
          icon={<CreditCard className="h-4 w-4 text-bxl-moss" />}
          eyebrow="If my bank emails daily"
          title="Daily credit-card alerts to transaction rows"
          description="Scotia sends a “Last five transactions” email. After I connect Gmail, BXL runs the daily ingest (or I hit “Sync from Gmail now”) and stores posted charges as transactions for the dashboard."
          imageSrc="/images/dashboard-placeholder.svg"
          imageLabel="Dashboard rows created from your emails"
        />

        <FeatureBlock
          icon={<Pencil className="h-4 w-4 text-bxl-moss" />}
          eyebrow="Then I clean it up"
          title="Edit the dashboard (categories + delete)"
          description="Every transaction row is editable: change the category from the dropdown or delete rows if something looks wrong. Changes write back to Supabase."
          imageSrc="/images/dashboard-placeholder.svg"
          imageLabel="Edit categories directly in the dashboard"
        />

        <FeatureBlock
          icon={<PiggyBank className="h-4 w-4 text-bxl-moss" />}
          eyebrow="I set the goal"
          title="Set my monthly budget"
          description="On the dashboard I enter a monthly budget number. BXL uses posted spend to calculate month-to-date totals and shows progress against the budget."
          imageSrc="/images/budget-tracker-placeholder.svg"
          imageLabel="Monthly budget progress tracker"
        />

        <FeatureBlock
          icon={<Lock className="h-4 w-4 text-bxl-moss" />}
          eyebrow="Finally, the email"
          title="Weekly digest email (locked week-to-week)"
          description="Vercel runs the digest job daily, but BXL only sends on the weekday I choose (America/Toronto) and at most once per local calendar day. It uses `gmail_connections.weekly_digest_last_calendar_date` to prevent duplicates, and the email totals use the current Sunday–Saturday week window plus month-to-date spend (so it stays aligned week-to-week)."
          imageSrc="/images/weekly-email-placeholder.svg"
          imageLabel="Automatic weekly spend email digest"
        />
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Want to try the flow?</p>
              <p className="text-sm text-slate-600">
                Sign in with Google, connect Gmail, then sync your Scotia “Last five transactions”
                emails to see the dashboard + weekly digest.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-bxl-forest px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-bxl-moss"
              >
                Try it
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark heightClass="h-10 sm:h-11" />
            <div>
              <p className="text-sm font-semibold text-slate-800">BXL Expense Tracker</p>
              <p className="text-xs text-slate-500">Dashboard + weekly email digests from Gmail alerts</p>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Built on Next.js, Supabase, and Gmail OAuth.
          </div>
        </div>
      </footer>
    </main>
  );
}
