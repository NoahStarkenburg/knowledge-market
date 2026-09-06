import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/apiClient";
import type { AdminUserDto, AdminUsersResult, AdminOrdersResult, ApiError } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { Alert } from "../../components/ui/Alert";
import { usePageTitle } from "../../hooks/usePageTitle";

const PAGE_SIZE = 10;

const thClass = "text-left px-6 py-3 font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute";
const thClassRight = "text-right px-6 py-3 font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute";
const searchInputClass =
  "pl-8 pr-3 py-2 text-[13px] bg-chalk border-2 border-ink text-ink placeholder:text-ink-mute focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30 w-52 transition-colors";
const countChipClass =
  "font-mono uppercase tracking-[0.08em] text-[10px] font-bold bg-cobalt text-white px-2 py-1 tabular-nums";

// ── Users panel ────────────────────────────────────────────────────────────────

interface AssignRoleState {
  userId: string;
  status: "confirming" | "loading" | "success" | "error";
  errorMsg?: string;
}

function UsersPanel(): React.ReactElement {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AdminUsersResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleState, setRoleState] = useState<AssignRoleState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = useCallback(async (q: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.adminListUsers({ q: q || undefined, page: p, pageSize: PAGE_SIZE });
      setResult(data);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.detail ?? apiErr.message ?? "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers(submittedQuery, page);
  }, [fetchUsers, submittedQuery, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSubmittedQuery(query);
  };

  const totalPages = result ? Math.ceil(result.total / PAGE_SIZE) : 1;

  const handleMakeAdminClick = (user: AdminUserDto) => {
    setRoleState({ userId: user.id, status: "confirming" });
  };

  const handleConfirmRole = async (userId: string) => {
    setRoleState((prev) => prev ? { ...prev, status: "loading" } : null);
    try {
      await apiClient.adminAssignRole(userId, "Admin");
      setRoleState((prev) => prev ? { ...prev, status: "success" } : null);
      // Re-fetch to reflect any server-side changes
      await fetchUsers(submittedQuery, page);
      // Clear success indicator after 2 s
      setTimeout(() => setRoleState(null), 2000);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setRoleState((prev) =>
        prev ? { ...prev, status: "error", errorMsg: apiErr.detail ?? apiErr.message ?? "Failed." } : null
      );
    }
  };

  const handleCancelRole = () => setRoleState(null);

  return (
    <section className="bg-chalk border-2 border-ink">
      {/* Header */}
      <div className="px-6 py-4 border-b-2 border-ink flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">Users</h2>
          {result && (
            <span className={countChipClass}>{result.total.toLocaleString()}</span>
          )}
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-mute absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email…"
              className={searchInputClass}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" disabled={loading}>
            Search
          </Button>
        </form>
      </div>

      {/* Role-assign feedback banner */}
      {roleState?.status === "error" && (
        <div className="px-6 py-2">
          <Alert type="error">{roleState.errorMsg}</Alert>
        </div>
      )}
      {roleState?.status === "success" && (
        <div className="px-6 py-2">
          <Alert type="success">Role assigned successfully.</Alert>
        </div>
      )}

      {/* Body */}
      {loading && !result ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="px-6 py-6">
          <Alert type="error">{error}</Alert>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-2 border-ink bg-paper-dim">
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Registered</th>
                  <th className={thClass}>Verified</th>
                  <th className={thClassRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result && result.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-ink-mute">
                      No users found.
                    </td>
                  </tr>
                )}
                {result?.items.map((user) => {
                  const isThisUser = roleState?.userId === user.id;
                  return (
                    <tr
                      key={user.id}
                      className="border-b-2 border-ink/10 hover:bg-paper-dim transition-colors"
                    >
                      <td className="px-6 py-3 text-ink font-semibold">{user.email}</td>
                      <td className="px-6 py-3 text-ink-mute tabular-nums">
                        {new Date(user.registeredAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        {user.isEmailVerified ? (
                          <span className="inline-flex items-center gap-1 font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-[#1b5e34]">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Yes</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>No</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {isThisUser && roleState.status === "confirming" ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink">Make admin?</span>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => void handleConfirmRole(user.id)}
                            >
                              Confirm
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelRole}>
                              Cancel
                            </Button>
                          </span>
                        ) : isThisUser && roleState.status === "loading" ? (
                          <span className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute">
                            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Assigning…
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleMakeAdminClick(user)}
                            disabled={roleState?.status === "loading"}
                          >
                            Make admin
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {result && result.total > PAGE_SIZE && (
            <div className="px-6 py-3 border-t-2 border-ink flex items-center justify-between">
              <span className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Orders panel ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Paid: "border-[#1f7a3d] bg-[#eafaf0] text-[#1b5e34]",
  Pending: "border-[#9a6a00] bg-[#fff7e0] text-[#7a5400]",
  Refunded: "border-cobalt bg-[#eef0ff] text-cobalt-deep",
  Cancelled: "border-danger bg-[#fdeceb] text-danger",
};

function statusBadgeClass(status: string): string {
  return STATUS_COLORS[status] ?? "border-ink bg-paper-dim text-ink-mute";
}

type OrderStatusTab = "all" | "Pending" | "Paid" | "Refunded";
const ORDER_STATUS_TABS: { value: OrderStatusTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Paid", label: "Paid" },
  { value: "Refunded", label: "Refunded" },
];

function OrdersPanel(): React.ReactElement {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AdminOrdersResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatusTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchOrders = useCallback(async (p: number, status: OrderStatusTab, q: string, from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.adminListOrders({
        status: status === "all" ? undefined : status,
        q: q || undefined,
        from: from || undefined,
        to: to || undefined,
        page: p,
        pageSize: PAGE_SIZE,
      });
      setResult(data);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.detail ?? apiErr.message ?? "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders(page, statusFilter, submittedQuery, dateFrom, dateTo);
  }, [fetchOrders, page, statusFilter, submittedQuery, dateFrom, dateTo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSubmittedQuery(searchQuery);
  };

  const totalPages = result ? Math.ceil(result.total / PAGE_SIZE) : 1;

  const truncate = (id: string) => `${id.slice(0, 8)}…`;

  return (
    <section className="bg-chalk border-2 border-ink">
      {/* Header */}
      <div className="px-6 py-4 border-b-2 border-ink flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">Orders</h2>
          {result && (
            <span className={countChipClass}>{result.total.toLocaleString()}</span>
          )}
        </div>

        {/* Search form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-mute absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by course…"
              className={searchInputClass}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" disabled={loading}>
            Search
          </Button>
        </form>
      </div>

      {/* Status tabs + date filters */}
      <div className="px-6 py-3 border-b-2 border-ink flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {ORDER_STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`px-3 py-1.5 font-mono uppercase tracking-[0.08em] text-[11px] font-bold border-2 border-ink transition-colors ${
                statusFilter === tab.value
                  ? "bg-ink text-paper"
                  : "bg-chalk text-ink-mute hover:bg-ink hover:text-paper"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="bg-chalk border-2 border-ink px-2 py-1.5 text-[12px] text-ink focus:outline-none focus:border-cobalt"
          />
          <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="bg-chalk border-2 border-ink px-2 py-1.5 text-[12px] text-ink focus:outline-none focus:border-cobalt"
          />
        </div>
      </div>

      {/* Body */}
      {loading && !result ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="px-6 py-6">
          <Alert type="error">{error}</Alert>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-2 border-ink bg-paper-dim">
                  <th className={thClass}>Order ID</th>
                  <th className={thClass}>Buyer ID</th>
                  <th className={thClass}>Course</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Date</th>
                </tr>
              </thead>
              <tbody>
                {result && result.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-ink-mute">
                      No orders found.
                    </td>
                  </tr>
                )}
                {result?.items.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b-2 border-ink/10 hover:bg-paper-dim transition-colors"
                  >
                    <td className="px-6 py-3 font-mono text-ink-mute" title={order.id}>
                      {truncate(order.id)}
                    </td>
                    <td className="px-6 py-3 font-mono text-ink-mute" title={order.buyerId}>
                      {truncate(order.buyerId)}
                    </td>
                    <td className="px-6 py-3 text-ink max-w-[200px] truncate">{order.courseTitle}</td>
                    <td className="px-6 py-3 text-ink tabular-nums font-semibold">
                      {order.priceAmount === 0
                        ? "Free"
                        : `${order.priceAmount.toFixed(2)} ${order.priceCurrency}`}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.08em] border-2 ${statusBadgeClass(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-ink-mute tabular-nums">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {result && result.total > PAGE_SIZE && (
            <div className="px-6 py-3 border-t-2 border-ink flex items-center justify-between">
              <span className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function AdminDashboardPage(): React.ReactElement {
  usePageTitle("Admin");
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="bg-chalk border-2 border-ink shadow-hard px-10 py-12 flex flex-col items-center gap-4 max-w-md text-center">
          <div className="font-display display-x font-extrabold text-[64px] leading-none tracking-[-0.03em] text-danger">
            403
          </div>
          <h1 className="font-display font-bold uppercase tracking-[-0.01em] text-[22px] text-ink">Access Denied</h1>
          <p className="text-[14px] text-ink-mute">
            You do not have permission to view this page. Admin role required.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Page header */}
      <div className="bg-grid border-b-2 border-ink">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-3">
            Console
          </div>
          <h1 className="font-display display-x font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-ink text-[clamp(2.5rem,7vw,4rem)]">
            Admin Dashboard
          </h1>
          <p className="text-[14px] text-ink-soft mt-4 max-w-[60ch]">
            Manage users, orders, and platform settings.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">
        <UsersPanel />
        <OrdersPanel />
      </div>
    </div>
  );
}
