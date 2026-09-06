import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import type { ApiError, CreatorDashboardDto, CreatorOrderItem } from "../../api/types";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { Button } from "../../components/ui/Button";
import { ChevronRight } from "lucide-react";

function formatRevenue(amount: number): string {
  if (amount === 0) return "$0";
  return amount % 1 === 0
    ? `$${amount.toLocaleString()}`
    : `$${amount.toFixed(2)}`;
}

const THUMB_TONES = [
  "bg-cobalt",
  "bg-ink",
  "bg-cobalt-deep",
  "bg-[#1f7a3d]",
  "bg-[#7a3b12]",
  "bg-[#5b2d82]",
];

function thumbTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return THUMB_TONES[Math.abs(hash) % THUMB_TONES.length];
}

const Stat: React.FC<{ label: string; value: string; note?: string }> = ({
  label,
  value,
  note,
}) => (
  <div className="px-5 py-5 first:pl-0 lg:first:pl-5">
    <div className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink-mute mb-3">
      {label}
    </div>
    <div className="font-display display-x font-extrabold text-[38px] leading-none tabular-nums tracking-[-0.03em] text-ink">
      {value}
    </div>
    {note && <div className="text-[12px] text-ink-mute mt-2">{note}</div>}
  </div>
);

export const DashboardSection: React.FC = () => {
  const [dashboard, setDashboard] = useState<CreatorDashboardDto | null>(null);
  const [recentSales, setRecentSales] = useState<CreatorOrderItem[]>([]);
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotal, setSalesTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();

  const PAGE_SIZE = 10;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const data = await apiClient.getCreatorDashboard();
        setDashboard(data);
      } catch (err: unknown) {
        setError(err as ApiError);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadSales = async () => {
      setSalesLoading(true);
      try {
        const result = await apiClient.getCreatorOrders({ page: salesPage, pageSize: PAGE_SIZE });
        setRecentSales(result.items);
        setSalesTotal(result.total);
      } catch {
        // sales are secondary — don't block the page on failure
      } finally {
        setSalesLoading(false);
      }
    };
    loadSales();
  }, [salesPage]);

  const totalSalesPages = Math.max(1, Math.ceil(salesTotal / PAGE_SIZE));

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <div className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-3">
          Creator dashboard
        </div>
        <h1 className="font-display display-x font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-ink text-[clamp(2.5rem,7vw,4rem)]">
          The ledger
        </h1>
        <p className="text-[14px] text-ink-soft mt-4 max-w-[60ch]">
          Revenue, enrollments, and performance across all your courses.
        </p>
      </div>

      <FormErrorList error={error} />

      {dashboard && (
        <>
          {/* ── Top stats: four-column ribbon ─────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x-2 divide-ink border-y-2 border-ink mb-10">
            <Stat
              label="Total revenue"
              value={formatRevenue(dashboard.totalRevenue)}
              note="all time"
            />
            <Stat
              label="Enrollments"
              value={dashboard.totalEnrollments.toLocaleString()}
              note="total students"
            />
            <Stat
              label="Avg rating"
              value={dashboard.averageRating != null ? dashboard.averageRating.toFixed(1) : "—"}
              note={`${dashboard.totalReviews.toLocaleString()} review${dashboard.totalReviews !== 1 ? "s" : ""}`}
            />
            <Stat
              label="Courses"
              value={String(dashboard.totalCourses)}
              note={`${dashboard.publishedCourses} published${
                dashboard.draftCourses > 0 ? ` · ${dashboard.draftCourses} draft` : ""
              }`}
            />
          </div>

          {/* ── Per-course breakdown ───────────────────────────────────── */}
          <div className="mb-10">
            <div className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink mb-4 pb-2 border-b-2 border-ink">
              Performance by course
            </div>

            {dashboard.courses.length === 0 ? (
              <div className="py-16 text-center border-b-2 border-ink">
                <div className="font-display display-x font-extrabold text-[56px] leading-none text-ink mb-3">00</div>
                <p className="text-[14px] text-ink-mute mb-3">No courses yet.</p>
                <Link
                  to="/courses/new"
                  className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink underline underline-offset-4 decoration-2 decoration-cobalt hover:text-cobalt"
                >
                  Create your first course
                </Link>
              </div>
            ) : (
              <>
                <div className="hidden md:grid grid-cols-[1fr_80px_110px_80px_90px] gap-4 py-2 border-b-2 border-ink font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">
                  <span>Course</span>
                  <span className="text-right">Students</span>
                  <span className="text-right">Revenue</span>
                  <span className="text-right">Rating</span>
                  <span className="text-right">Status</span>
                </div>

                <ul>
                  {dashboard.courses.map((c) => (
                    <li key={c.id} className="border-b-2 border-ink">
                      <Link
                        to={`/courses/${c.id}`}
                        className="group flex items-center gap-4 py-4 px-3 -mx-3 hover:bg-ink transition-colors"
                      >
                        <div
                          className={`w-12 h-12 shrink-0 overflow-hidden flex items-center justify-center border-2 border-ink group-hover:border-paper ${thumbTone(c.id)}`}
                        >
                          {c.thumbnailFileId ? (
                            <img
                              src={apiClient.getCourseThumbnailUrl(c.id)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-display font-extrabold text-[20px] text-white">
                              {c.title[0]?.toUpperCase() ?? "C"}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-display font-bold text-[17px] tracking-[-0.01em] text-ink truncate group-hover:text-paper">
                            {c.title}
                          </div>
                          {c.publishedAt && (
                            <div className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute mt-1 group-hover:text-paper/60">
                              Published {new Date(c.publishedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                            </div>
                          )}
                        </div>

                        <div className="hidden md:flex items-center gap-8 shrink-0">
                          <div className="w-[80px] text-right">
                            <div className="font-display font-bold text-[18px] tabular-nums tracking-[-0.01em] text-ink group-hover:text-paper">
                              {c.enrollments.toLocaleString()}
                            </div>
                          </div>
                          <div className="w-[110px] text-right">
                            <div className="font-display font-extrabold text-[18px] tabular-nums tracking-[-0.01em] text-cobalt group-hover:text-signal">
                              {formatRevenue(c.revenue)}
                            </div>
                          </div>
                          <div className="w-[80px] text-right">
                            {c.averageRating != null ? (
                              <>
                                <div className="font-display font-bold text-[18px] tabular-nums tracking-[-0.01em] text-ink group-hover:text-paper">
                                  {c.averageRating.toFixed(1)}
                                </div>
                                <div className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute mt-0.5 group-hover:text-paper/60">
                                  {c.reviewCount} rev
                                </div>
                              </>
                            ) : (
                              <div className="text-[18px] text-ink-mute group-hover:text-paper/60">—</div>
                            )}
                          </div>
                          <div className="w-[90px] text-right">
                            <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink group-hover:text-paper">
                              {c.status === "Published" ? "In print" : "Draft"}
                            </span>
                          </div>
                        </div>

                        <div className="md:hidden flex items-center gap-4 shrink-0 text-right">
                          <div>
                            <div className="font-display font-extrabold text-[16px] tabular-nums text-cobalt group-hover:text-signal">
                              {formatRevenue(c.revenue)}
                            </div>
                            <div className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute group-hover:text-paper/60">
                              {c.enrollments} students
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-ink-mute group-hover:text-paper" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* ── Recent sales ──────────────────────────────────────────── */}
          <div className="bg-chalk border-2 border-ink">
            <div className="px-6 py-4 border-b-2 border-ink flex items-center justify-between">
              <h3 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">Recent sales</h3>
              <span className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute">{salesTotal.toLocaleString()} total</span>
            </div>

            {salesLoading ? (
              <div className="p-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : recentSales.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-[14px] text-ink-mute">No sales yet.</p>
              </div>
            ) : (
              <>
                <ul className="divide-y-2 divide-ink/10">
                  {recentSales.map((s) => (
                    <li
                      key={s.orderId}
                      className="flex items-center justify-between px-6 py-3.5 gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[14px] text-ink truncate">
                          {s.courseTitle}
                        </div>
                        <div className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute mt-0.5">
                          {new Date(s.paidAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                      <div className="font-display font-extrabold text-[16px] tabular-nums text-cobalt shrink-0">
                        {formatRevenue(s.amount)}
                      </div>
                    </li>
                  ))}
                </ul>

                {totalSalesPages > 1 && (
                  <div className="px-6 py-4 border-t-2 border-ink flex justify-between items-center">
                    <span className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute">
                      Page {salesPage} of {totalSalesPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={salesPage <= 1}
                        onClick={() => setSalesPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={salesPage >= totalSalesPages}
                        onClick={() => setSalesPage((p) => Math.min(totalSalesPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
