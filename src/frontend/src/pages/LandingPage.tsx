import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/apiClient";
import type { CourseDto } from "../api/types";
import { Navbar } from "../components/Layout/Navbar";
import { Footer } from "../components/Layout/Footer";
import { usePageTitle } from "../hooks/usePageTitle";

function formatPrice(amount: number, currency: string): string {
  if (amount === 0) return "Free";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

export const LandingPage: React.FC = () => {
  usePageTitle();
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [stats, setStats] = useState<{ publishedCourses: number; creators: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.getFeaturedCourses(7).catch(() => [] as CourseDto[]),
      apiClient.getCatalogStats().catch(() => ({ publishedCourses: 0, creators: 0 })),
    ]).then(([fc, st]) => {
      if (cancelled) return;
      setCourses(fc);
      setStats(st);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const todayCourses = courses.slice(0, 4);
  const featuredCourses = courses.slice(0, 6);

  const fields = useMemo(() => {
    const seen = new Set<string>();
    for (const c of courses) for (const t of c.tags ?? []) seen.add(t);
    return [...seen].slice(0, 8);
  }, [courses]);

  const dateLine = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Navbar />

      <main id="main">
        {/* ── STATUS STRIP ──────────────────────────────────────────────── */}
        <div className="border-b-2 border-ink">
          <div className="max-w-[1320px] mx-auto px-5 sm:px-6 h-9 flex items-center justify-between font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-ink">
            <span>Vol. 01 / The Catalog</span>
            <span className="hidden sm:inline text-ink-mute">{dateLine}</span>
            <span className="text-cobalt">
              {stats ? `${stats.publishedCourses} courses / ${stats.creators} makers` : "Loading…"}
            </span>
          </div>
        </div>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b-2 border-ink">
          {/* Animated Swiss backdrop: a drifting grid with a few slow-floating blocks.
              Frozen automatically for prefers-reduced-motion via the global rule. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-grid animate-grid-pan" />
            <div className="absolute -left-16 top-10 w-44 h-44 border-2 border-cobalt/20 animate-spin-slow" />
            <div className="absolute left-[20%] bottom-8 w-16 h-16 border-2 border-ink/15 animate-float-rev" />
            <div className="absolute right-[32%] top-14 w-10 h-10 bg-signal/40 animate-float" />
            <div className="absolute right-[10%] bottom-14 w-8 h-8 bg-cobalt/20 animate-float-rev" />
          </div>
          <div className="relative z-10 max-w-[1320px] mx-auto px-5 sm:px-6 pt-12 pb-10 md:pt-16 md:pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end">
              {/* Headline */}
              <div className="lg:col-span-8">
                <p className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-ink-mute mb-6">
                  An independent catalog · est. 2026
                </p>
                <h1 className="font-display display-x font-extrabold uppercase tracking-[-0.04em] leading-[0.82] text-ink text-[clamp(3.25rem,11vw,8.5rem)]">
                  <span className="block overflow-hidden">
                    <span className="block animate-rise [animation-delay:0ms]">Learn</span>
                  </span>
                  <span className="block overflow-hidden">
                    <span className="block animate-rise [animation-delay:90ms]">
                      the{" "}
                      <span className="bg-signal text-ink px-2 box-decoration-clone">hard</span>
                    </span>
                  </span>
                  <span className="block overflow-hidden">
                    <span className="block animate-rise [animation-delay:180ms]">things.</span>
                  </span>
                </h1>
                <p className="mt-7 text-[17px] md:text-[19px] leading-[1.5] text-ink-soft max-w-[46ch]">
                  Courses on the parts of building software and products that are
                  genuinely hard, taught by people who do the work. Buy one course,
                  or subscribe for all of them.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    to="/courses"
                    className="inline-flex items-center font-mono uppercase tracking-[0.08em] text-[12px] font-bold bg-ink text-paper border-2 border-ink px-6 py-3.5 shadow-hard-sm hover:bg-cobalt hover:border-cobalt hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[background-color,color,border-color,transform,box-shadow] duration-100"
                  >
                    Browse the catalog →
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center font-mono uppercase tracking-[0.08em] text-[12px] font-bold bg-paper text-ink border-2 border-ink px-6 py-3.5 hover:bg-ink hover:text-paper active:translate-x-[3px] active:translate-y-[3px] transition-[background-color,color,transform] duration-100"
                  >
                    Teach on KM
                  </Link>
                </div>
              </div>

              {/* Cobalt stat monolith */}
              <div className="lg:col-span-4">
                <div className="bg-cobalt bg-grid-cobalt text-white border-2 border-ink shadow-hard divide-y-2 divide-white/25">
                  <MonolithStat
                    value={stats ? String(stats.publishedCourses).padStart(2, "0") : "00"}
                    label="Courses in print"
                  />
                  <MonolithStat
                    value={stats ? String(stats.creators).padStart(2, "0") : "00"}
                    label="Makers teaching"
                  />
                  <MonolithStat
                    value={fields.length > 0 ? String(fields.length).padStart(2, "0") : "00"}
                    label="Fields covered"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FIELD INDEX ───────────────────────────────────────────────── */}
        {fields.length > 0 && (
          <section className="border-b-2 border-ink bg-ink text-paper">
            <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-4 flex items-center gap-5 overflow-x-auto">
              <span className="font-mono uppercase tracking-[0.16em] text-[10px] font-bold text-paper/60 shrink-0">
                Fields
              </span>
              <div className="flex items-center gap-2.5">
                {fields.map((f) => (
                  <Link
                    key={f}
                    to={`/courses?tag=${encodeURIComponent(f)}`}
                    className="shrink-0 font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-paper border-2 border-paper/30 px-3 py-1.5 hover:bg-signal hover:text-ink hover:border-signal transition-colors"
                  >
                    {f}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── TODAY / WHAT'S NEW (live ledger) ──────────────────────────── */}
        <section className="border-b-2 border-ink">
          <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-12 md:py-16">
            <div className="flex items-end justify-between gap-4 mb-8">
              <div>
                <p className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-3">
                  Just added
                </p>
                <h2 className="font-display font-extrabold uppercase tracking-[-0.02em] text-[clamp(1.8rem,5vw,3rem)] leading-[0.95]">
                  Fresh off the press
                </h2>
              </div>
              <Link
                to="/courses"
                className="hidden sm:inline font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-ink underline underline-offset-4 decoration-2 decoration-cobalt hover:text-cobalt shrink-0"
              >
                See all →
              </Link>
            </div>

            {loading && todayCourses.length === 0 ? (
              <SkeletonRows />
            ) : todayCourses.length === 0 ? (
              <EmptyRow />
            ) : (
              <ul className="border-t-2 border-ink">
                {todayCourses.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/courses/${c.id}`}
                      className="group grid grid-cols-12 gap-3 md:gap-4 items-center py-4 md:py-5 border-b-2 border-ink px-2 -mx-2 hover:bg-ink transition-colors"
                    >
                      <div className="col-span-3 md:col-span-1 font-mono uppercase tracking-[0.08em] text-[10px] md:text-[11px] font-bold text-ink-mute group-hover:text-paper/60">
                        {formatDate(c.publishedAt ?? c.createdAt)}
                      </div>
                      <div className="hidden md:block md:col-span-2 font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-cobalt group-hover:text-signal truncate">
                        {c.tags?.[0] ?? "General"}
                      </div>
                      <div className="col-span-9 md:col-span-7 font-display font-bold tracking-[-0.01em] text-[20px] md:text-[26px] leading-[1.05] text-ink group-hover:text-paper">
                        {c.title}
                      </div>
                      <div className="hidden md:block md:col-span-2 font-display font-extrabold text-[20px] text-right tabular-nums text-cobalt group-hover:text-signal">
                        {formatPrice(c.priceAmount, c.priceCurrency)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── FEATURED ──────────────────────────────────────────────────── */}
        <section className="border-b-2 border-ink bg-paper-dim/40">
          <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-12 md:py-16">
            <div className="flex items-end justify-between gap-4 mb-8">
              <div>
                <p className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-3">
                  Editor's selection
                </p>
                <h2 className="font-display font-extrabold uppercase tracking-[-0.02em] text-[clamp(1.8rem,5vw,3rem)] leading-[0.95] max-w-[16ch]">
                  Picked by hand, not by an algorithm
                </h2>
              </div>
            </div>

            {loading && featuredCourses.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-52 bg-paper-dim animate-pulse border-2 border-ink" />
                ))}
              </div>
            ) : featuredCourses.length === 0 ? (
              <EmptyRow message="No published courses yet. Check back soon." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {featuredCourses.map((c, idx) => (
                  <FeaturedCard key={c.id} course={c} index={idx} highlight={idx === 0} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── TEACH ─────────────────────────────────────────────────────── */}
        <section className="border-b-2 border-ink">
          <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-14 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5">
              <p className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-5">
                For makers
              </p>
              <h2 className="font-display display-x font-extrabold uppercase tracking-[-0.03em] leading-[0.9] text-[clamp(2.25rem,6vw,4rem)]">
                Get paid for what you already know
              </h2>
              <p className="mt-6 text-[16px] leading-[1.6] text-ink-soft max-w-[42ch]">
                No agent, no production crew, no platform fees buried in your royalty
                statement. Upload, set a price, get paid.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center mt-8 font-mono uppercase tracking-[0.08em] text-[12px] font-bold bg-ink text-paper border-2 border-ink px-6 py-3.5 shadow-hard-sm hover:bg-cobalt hover:border-cobalt hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[background-color,color,border-color,transform,box-shadow] duration-100"
              >
                Start teaching →
              </Link>
            </div>
            <ol className="lg:col-span-7 lg:pl-10 lg:border-l-2 lg:border-ink grid sm:grid-cols-2 gap-x-8 gap-y-8 self-center">
              <Step n="01" title="Upload lessons" body="Markdown, video, audio, PDF. Drag and drop or paste a link." />
              <Step n="02" title="Set your price" body="One-time purchase or recurring access. Change it whenever." />
              <Step n="03" title="We handle payments" body="Stripe checkout, invoicing, refunds, and chargebacks." />
              <Step n="04" title="Keep your audience" body="Export your students any time. We never lock you in." />
            </ol>
          </div>
        </section>

        {/* ── CLOSING SIGNAL BAND ───────────────────────────────────────── */}
        <section className="bg-signal border-b-2 border-ink">
          <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-12 md:py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <h2 className="font-display display-x font-extrabold uppercase tracking-[-0.03em] leading-[0.9] text-ink text-[clamp(2rem,6vw,3.75rem)] max-w-[18ch]">
              Start with one course today
            </h2>
            <Link
              to="/courses"
              className="shrink-0 inline-flex items-center font-mono uppercase tracking-[0.08em] text-[13px] font-bold bg-ink text-signal border-2 border-ink px-7 py-4 shadow-hard hover:bg-cobalt hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[background-color,color,transform,box-shadow] duration-100"
            >
              Open the catalog →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

const MonolithStat: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="px-6 py-6">
    <div className="font-display display-x font-extrabold tabular-nums tracking-[-0.03em] leading-none text-[64px] md:text-[72px]">
      {value}
    </div>
    <div className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-white/75 mt-3">
      {label}
    </div>
  </div>
);

const FeaturedCard: React.FC<{ course: CourseDto; index: number; highlight: boolean }> = ({
  course,
  index,
  highlight,
}) => {
  const cardBase =
    "group flex flex-col border-2 border-ink p-6 transition-[transform,box-shadow] duration-100 hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-hard";
  const tone = highlight ? "bg-cobalt text-white" : "bg-chalk text-ink";
  const metaTone = highlight ? "text-white/70" : "text-ink-mute";
  const priceTone = highlight ? "text-signal" : "text-cobalt";
  const ruleTone = highlight ? "border-white/30" : "border-ink";

  return (
    <Link to={`/courses/${course.id}`} className={`${cardBase} ${tone}`}>
      <div className="flex items-center justify-between mb-5">
        <span className={`font-mono uppercase tracking-[0.12em] text-[11px] font-bold ${metaTone}`}>
          No. {String(index + 1).padStart(2, "0")}
        </span>
        <span className={`font-mono uppercase tracking-[0.12em] text-[11px] font-bold ${metaTone}`}>
          {course.tags?.[0] ?? "General"}
        </span>
      </div>
      <h3 className="font-display font-bold uppercase tracking-[-0.01em] text-[24px] leading-[0.98] mb-3">
        {course.title}
      </h3>
      {course.description && (
        <p className={`text-[14px] leading-[1.55] line-clamp-3 mb-6 flex-1 ${highlight ? "text-white/85" : "text-ink-soft"}`}>
          {course.description}
        </p>
      )}
      <div className={`flex items-end justify-between pt-4 border-t-2 ${ruleTone} mt-auto`}>
        <span className={`font-mono uppercase tracking-[0.12em] text-[11px] font-bold ${metaTone}`}>
          {course.priceAmount === 0 ? "Included" : "One-time"}
        </span>
        <span className={`font-display font-extrabold text-[26px] tabular-nums tracking-[-0.01em] ${priceTone}`}>
          {formatPrice(course.priceAmount, course.priceCurrency)}
        </span>
      </div>
    </Link>
  );
};

const Step: React.FC<{ n: string; title: string; body: string }> = ({ n, title, body }) => (
  <li>
    <div className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-cobalt mb-2">
      {n}
    </div>
    <div className="font-display font-bold uppercase tracking-[-0.01em] text-[19px] text-ink mb-1.5">
      {title}
    </div>
    <p className="text-[14px] leading-[1.55] text-ink-soft">{body}</p>
  </li>
);

const SkeletonRows: React.FC = () => (
  <ul className="border-t-2 border-ink">
    {[0, 1, 2, 3].map((i) => (
      <li key={i} className="grid grid-cols-12 gap-4 py-5 border-b-2 border-ink">
        <div className="col-span-1 h-3 bg-paper-dim animate-pulse" />
        <div className="col-span-2 h-3 bg-paper-dim animate-pulse" />
        <div className="col-span-7 h-6 bg-paper-dim animate-pulse" />
        <div className="col-span-2 h-4 bg-paper-dim animate-pulse" />
      </li>
    ))}
  </ul>
);

const EmptyRow: React.FC<{ message?: string }> = ({
  message = "The catalog is still being assembled. Check back tomorrow.",
}) => (
  <div className="border-y-2 border-ink py-12">
    <p className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink-mute text-center">
      {message}
    </p>
  </div>
);
