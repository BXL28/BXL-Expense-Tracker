"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

const BULLETS = [
  "Daily Scotiabank credit card alerts parsed straight from Gmail",
  "Transactions sync automatically — no manual entry needed",
  "Monthly budget tracker with category breakdown",
  "Weekly debrief email sent to my inbox every Saturday",
] as const;

// pre-compute where each bullet starts in the flat char stream
const BULLET_STARTS = BULLETS.reduce<number[]>((acc, _b, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + BULLETS[i - 1].length);
  return acc;
}, []);
const TOTAL_CHARS = BULLETS.reduce((sum, b) => sum + b.length, 0);

const FEATURES = [
  {
    src: "/images/budget-tracker.png",
    title: "Budget tracker",
    body:
      "I track my monthly spend with posted totals, top category, and progress toward my budget all in one view.",
  },
  {
    src: "/images/weekly-email.png",
    title: "Weekly email digest",
    body:
      "I get a weekly summary email with my spending totals and category breakdown so I can review at a glance.",
  },
  {
    src: "/images/manual-editor.png",
    title: "Manual transaction editor",
    body:
      "I clean up categories and transaction rows directly from the dashboard whenever I want finer control.",
  },
] as const;

export default function HomePage() {
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const [activeFeatureIdx, setActiveFeatureIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const activeFeature = FEATURES[activeFeatureIdx];

  // typewriter state
  const [typedCount, setTypedCount] = useState(0);

  useEffect(() => {
    if (typedCount < TOTAL_CHARS) {
      const t = setTimeout(() => setTypedCount((n) => n + 1), 28);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setTypedCount(0), 3000);
      return () => clearTimeout(t);
    }
  }, [typedCount]);

  const showPrevFeature = () => {
    setSlideDirection("left");
    setActiveFeatureIdx((prev) => (prev - 1 + FEATURES.length) % FEATURES.length);
  };

  const showNextFeature = () => {
    setSlideDirection("right");
    setActiveFeatureIdx((prev) => (prev + 1) % FEATURES.length);
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-10 pt-20 text-slate-900">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="relative mx-auto flex h-16 w-full max-w-[1500px] items-center px-6">
          <div className="flex items-center gap-2">
            <BrandMark heightClass="h-8" />
            <p className="text-sm font-semibold text-slate-800 sm:text-base">BXL Expense Tracker</p>
          </div>
          <div className="ml-auto">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-bxl-forest px-4 py-2 text-sm font-medium text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-bxl-moss hover:shadow-lg focus-visible:-translate-y-0.5 focus-visible:bg-bxl-moss focus-visible:shadow-lg"
            >
              Try it
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1500px] px-6 pb-14 pt-2">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid h-[420px] sm:h-[560px] md:grid-cols-[1.4fr_1fr]">
            {/* video — left */}
            <div className="h-full overflow-hidden">
              <video
                className="h-full w-full object-cover"
                src="/videos/demo-placeholder.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              />
            </div>

            {/* typed description — right */}
            <div className="flex h-full flex-col justify-center bg-gradient-to-br from-white to-bxl-lime/10 p-8 lg:p-12">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-bxl-moss">
                Overview
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                How I use It
              </h2>
              <ul className="mt-6 space-y-4">
                {BULLETS.map((bullet, i) => {
                  const start = BULLET_STARTS[i];
                  if (typedCount <= start) return null;
                  const charsVisible = Math.min(typedCount - start, bullet.length);
                  const text = bullet.slice(0, charsVisible);
                  const isTyping = typedCount > start && typedCount < start + bullet.length;
                  return (
                    <li key={bullet} className="flex items-start gap-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-bxl-moss" />
                      <span>
                        {text}
                        {isTyping && (
                          <span className="ml-px inline-block w-[2px] animate-pulse bg-bxl-forest align-middle text-bxl-forest">
                            |
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto w-full max-w-[1500px] px-6">
          <div className="relative">
            <article
              key={`${activeFeatureIdx}-${slideDirection}`}
              className={`grid min-h-[62vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg md:grid-cols-[1fr_1.2fr] ${
                slideDirection === "right" ? "animate-feature-slide-in-right" : "animate-feature-slide-in-left"
              }`}
            >
              <div className="flex h-full flex-col justify-center bg-gradient-to-br from-white to-bxl-lime/10 p-8 text-slate-900">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-bxl-moss">
                  Feature
                </p>
                <h3 className="text-3xl font-semibold uppercase tracking-tight sm:text-4xl">
                  {activeFeature.title}
                </h3>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
                  {activeFeature.body}
                </p>
                <p className="mt-6 text-xs font-medium text-slate-500">
                  {String(activeFeatureIdx + 1).padStart(2, "0")}/{String(FEATURES.length).padStart(2, "0")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightbox({ src: activeFeature.src, label: activeFeature.title })}
                className="group relative flex h-full items-center justify-center overflow-hidden bg-slate-50 p-4"
              >
                <img
                  alt={activeFeature.title}
                  src={activeFeature.src}
                  className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.01] group-hover:brightness-[1.03]"
                />
              </button>
            </article>

            <button
              type="button"
              onClick={showPrevFeature}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 p-2.5 text-slate-700 shadow-md transition hover:bg-white hover:text-bxl-forest"
              aria-label="Previous feature"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={showNextFeature}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 p-2.5 text-slate-700 shadow-md transition hover:bg-white hover:text-bxl-forest"
              aria-label="Next feature"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
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
