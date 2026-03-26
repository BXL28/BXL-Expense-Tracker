"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ArrowRight, PlayCircle, X } from "lucide-react";

function ShowcaseImage({
  src,
  label,
  description,
  onOpen,
}: {
  src: string;
  label: string;
  description?: string;
  onOpen: (src: string, label: string) => void;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onOpen(src, label)}
        className="group block w-full text-left"
      >
        <figure className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:border-bxl-moss/60 group-hover:shadow-lg group-focus-visible:-translate-y-1 group-focus-visible:border-bxl-moss/60 group-focus-visible:shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={label}
            src={src}
            className="h-full w-full object-cover transition duration-200 group-hover:brightness-[1.03]"
          />
          <div className="pointer-events-none absolute inset-0 ring-0 transition duration-200 group-hover:ring-2 group-hover:ring-bxl-accent/60" />
          <figcaption className="absolute bottom-3 left-3 rounded-xl bg-slate-900/80 px-3 py-2 text-xs font-medium text-white">
            {label}
          </figcaption>
        </figure>
      </button>
      <p className="px-1 text-xs leading-relaxed text-slate-600">
        {description ?? "Description placeholder text for this feature screenshot."}
      </p>
    </div>
  );
}

export default function HomePage() {
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-6">
        <div className="flex items-center gap-3">
          <BrandMark heightClass="h-11 sm:h-12" />
          <div>
            <p className="text-sm font-semibold text-slate-800">BXL Expense Tracker</p>
            <p className="text-xs text-slate-500">Built for my personal budgeting workflow</p>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 pb-8 pt-2">
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            BXL Expense Tracker
          </h1>
          <p className="mx-auto max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            I built this for personal use to turn Scotia alert emails into a clean dashboard with
            budget tracking and a weekly recap email.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-10">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-bxl-moss/50 bg-gradient-to-br from-bxl-lime/20 to-white text-center sm:h-[360px]">
            <PlayCircle className="mb-3 h-12 w-12 text-bxl-forest" />
            <p className="text-lg font-semibold text-slate-900">Video demo placeholder</p>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Upload your product walkthrough video here (full dashboard flow, sync, budget,
              digest, and manual edit).
            </p>
          </div>
          <p className="px-2 pb-1 pt-3 text-center text-xs font-medium text-slate-600 sm:text-sm">
            Hero area reserved for your full demo video
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ShowcaseImage
            src="/images/budget-tracker.png"
            label="Budget tracker"
            description="Placeholder: explain how monthly totals, top category, and budget progress bar help you track spending quickly."
            onOpen={(src, label) => setLightbox({ src, label })}
          />
          <ShowcaseImage
            src="/images/weekly-email.png"
            label="Weekly email digest"
            description="Placeholder: describe the automated weekly summary email and how it shows week totals and category breakdown."
            onOpen={(src, label) => setLightbox({ src, label })}
          />
          <ShowcaseImage
            src="/images/manual-editor.png"
            label="Manual transaction editor"
            description="Placeholder: highlight that you can manually edit categories or clean up rows directly in the dashboard."
            onOpen={(src, label) => setLightbox({ src, label })}
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <p className="mb-4 text-sm text-slate-600">
            Built for my own personal finances, now shared as a clean one-click workflow.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-bxl-forest px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-bxl-moss"
          >
            Try it
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.label}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-lg border border-slate-500/50 bg-slate-900/80 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.src}
              alt={lightbox.label}
              className="max-h-[90vh] w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
