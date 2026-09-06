import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import type { ApiError, OrderDto } from "../../api/types";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { Skeleton } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import { Search } from "lucide-react";

type StatusTab = "all" | "Pending" | "Paid" | "Refunded";

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Paid", label: "Paid" },
  { value: "Refunded", label: "Refunded" },
];

export const OrdersSection: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ApiError | undefined>();
  const [refundConfirming, setRefundConfirming] = useState<string | null>(null);
  const [refundSucceeded, setRefundSucceeded] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 350);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchInput]);

  const loadOrders = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.listOrders({
        status: statusFilter === "all" ? undefined : statusFilter,
        q: debouncedQuery || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page,
        pageSize,
      });
      setOrders(result.items);
      setTotal(result.total);
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, debouncedQuery, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handlePayNow = (orderId: string) => {
    setActionLoading(orderId);
    setActionError(undefined);
    navigate(`/checkout/${orderId}`);
    setActionLoading(null);
  };

  const handleRefundConfirm = async (orderId: string) => {
    setActionLoading(orderId);
    setActionError(undefined);
    setRefundConfirming(null);
    try {
      await apiClient.refundOrder(orderId);
      setRefundSucceeded(orderId);
      setTimeout(() => {
        setRefundSucceeded(null);
        loadOrders();
      }, 2000);
    } catch (err: unknown) {
      setActionError(err as ApiError);
    } finally {
      setActionLoading(null);
    }
  };

  const dateInputClass =
    "bg-chalk border-2 border-ink px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30 transition-colors";

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <div className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-3">
          Purchase history
        </div>
        <h1 className="font-display display-x font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-ink text-[clamp(2.5rem,7vw,4rem)]">
          Orders
        </h1>
        <p className="text-[14px] text-ink-soft mt-4 max-w-[60ch]">
          Your course purchase history.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 border-b-2 border-ink">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-4 py-2.5 font-mono uppercase tracking-[0.08em] text-[11px] font-bold border-b-2 -mb-[2px] transition-colors ${
              statusFilter === tab.value
                ? "border-cobalt text-ink"
                : "border-transparent text-ink-mute hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + date range */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute pointer-events-none" />
          <input
            type="search"
            placeholder="Search by course title..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-chalk border-2 border-ink pl-9 pr-4 py-2 text-[14px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className={dateInputClass}
          />
          <label className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className={dateInputClass}
          />
        </div>
      </div>

      <FormErrorList error={error} />
      <FormErrorList error={actionError} />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : orders.length === 0 && !error ? (
        <div className="border-y-2 border-ink py-16 text-center">
          <div className="font-display display-x font-extrabold text-[56px] leading-none text-ink mb-3">
            00
          </div>
          <p className="font-display font-bold uppercase tracking-[-0.01em] text-[20px] text-ink mb-2">
            No orders found
          </p>
          <p className="text-[14px] text-ink-mute mb-6">
            {debouncedQuery || statusFilter !== "all" || dateFrom || dateTo
              ? "Try adjusting your filters."
              : "Courses you purchase will appear here."}
          </p>
          {!debouncedQuery && statusFilter === "all" && !dateFrom && !dateTo && (
            <Link
              to="/courses"
              className="inline-flex font-mono uppercase tracking-[0.08em] text-[11px] font-bold bg-ink text-paper border-2 border-ink px-5 py-2.5 shadow-hard-sm hover:bg-cobalt hover:border-cobalt hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[background-color,color,border-color,transform,box-shadow] duration-100"
            >
              Browse courses
            </Link>
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-4 mb-6">
            {orders.map((o) => (
              <li key={o.id} className="bg-chalk border-2 border-ink">
                <div className="p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-[16px] tracking-[-0.01em] text-ink truncate">
                      {o.courseTitle}
                    </div>
                    <div className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute mt-1">
                      {new Date(o.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {o.paidAt && (
                        <span className="ml-2 text-[#1b5e34]">
                          · Paid {new Date(o.paidAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-display font-extrabold text-[18px] tabular-nums tracking-[-0.01em] text-cobalt">
                      {o.priceAmount === 0 ? "Free" : `$${o.priceAmount}`}
                    </div>
                    <span
                      className={`font-mono uppercase tracking-[0.08em] text-[10px] font-bold ${
                        o.status === "Paid"
                          ? "text-[#1b5e34]"
                          : o.status === "Refunded"
                          ? "text-ink-mute"
                          : "text-cobalt"
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 min-w-[100px] justify-end">
                    {refundSucceeded === o.id ? (
                      <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-[#1b5e34]">
                        Refunded
                      </span>
                    ) : (
                      <>
                        {o.status === "Pending" && (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={actionLoading === o.id}
                            onClick={() => handlePayNow(o.id)}
                          >
                            {actionLoading === o.id ? "..." : "Pay now"}
                          </Button>
                        )}
                        {o.status === "Paid" && o.courseId && (
                          <>
                            <Link
                              to={`/courses/${o.courseId}/lessons`}
                              className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-cobalt underline underline-offset-4 decoration-2 hover:text-ink"
                            >
                              View
                            </Link>
                            {o.paidAt && (Date.now() - new Date(o.paidAt).getTime()) < 24 * 60 * 60 * 1000 ? (
                              <button
                                disabled={actionLoading === o.id}
                                onClick={() =>
                                  setRefundConfirming(refundConfirming === o.id ? null : o.id)
                                }
                                className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute hover:text-danger transition-colors disabled:opacity-50"
                                title="Request refund"
                              >
                                Refund
                              </button>
                            ) : (
                              <span className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute">
                                Refund window expired
                              </span>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {refundConfirming === o.id && (
                  <div className="border-t-2 border-danger bg-paper px-5 py-4">
                    <p className="text-[13px] text-ink mb-3">
                      Refunds are final. You will lose course access.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRefundConfirming(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={actionLoading === o.id}
                        onClick={() => handleRefundConfirm(o.id)}
                      >
                        {actionLoading === o.id ? "..." : "Confirm refund"}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-6 border-t-2 border-ink">
              <span className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute">
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
