import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/apiClient";
import type { ApiError, CourseDto, OrderDto } from "../../api/types";
import { useEnrolledCourses } from "../../hooks/useEnrolledCourses";
import { Skeleton } from "../../components/ui/Skeleton";
import { FormErrorList } from "../../components/ui/FormErrorList";

export const OverviewSection: React.FC = () => {
  const { email } = useAuth();
  const { entries, loading: enrolledLoading, reload } = useEnrolledCourses();
  const [myCourses, setMyCourses] = useState<CourseDto[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderDto[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<ApiError | undefined>();

  useEffect(() => {
    reload();
    const loadData = async () => {
      setDataLoading(true);
      setDataError(undefined);
      try {
        const [coursesResult, ordersResult] = await Promise.all([
          apiClient.getMyCourses({ pageSize: 50 }),
          apiClient.listOrders({ page: 1, pageSize: 3 }),
        ]);
        setMyCourses(coursesResult.items);
        setRecentOrders(ordersResult.items);
        setTotalOrders(ordersResult.total);
      } catch (err: unknown) {
        setDataError(err as ApiError);
      } finally {
        setDataLoading(false);
      }
    };
    loadData();
  }, [reload]);

  const initials = email
    ? email
        .split("@")[0]
        .split(/[._-]/)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("")
    : "?";

  const username = email?.split("@")[0] ?? "User";

  if (dataLoading || enrolledLoading) {
    return (
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-5 mb-10">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px mb-10">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <FormErrorList error={dataError} />

      {/* Profile header */}
      <div className="flex items-center gap-5 mb-10">
        <div className="w-16 h-16 bg-ink text-paper rounded-full flex items-center justify-center font-display font-extrabold text-[22px] shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-1">
            Account overview
          </div>
          <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-ink text-[clamp(1.8rem,5vw,3rem)] truncate">
            {username}
          </h1>
          <p className="text-[13px] text-ink-mute mt-1">{email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x-2 divide-ink border-y-2 border-ink mb-10">
        <div className="px-5 py-5 first:pl-0">
          <div className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink-mute mb-3">
            Created
          </div>
          <div className="font-display display-x font-extrabold text-[38px] leading-none tabular-nums tracking-[-0.03em] text-ink">
            {myCourses.length}
          </div>
          <div className="text-[12px] text-ink-mute mt-2">courses</div>
        </div>
        <div className="px-5 py-5">
          <div className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink-mute mb-3">
            Enrolled
          </div>
          <div className="font-display display-x font-extrabold text-[38px] leading-none tabular-nums tracking-[-0.03em] text-ink">
            {entries.length}
          </div>
          <div className="text-[12px] text-ink-mute mt-2">courses</div>
        </div>
        <div className="px-5 py-5">
          <div className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink-mute mb-3">
            Orders
          </div>
          <div className="font-display display-x font-extrabold text-[38px] leading-none tabular-nums tracking-[-0.03em] text-ink">
            {totalOrders}
          </div>
          <div className="text-[12px] text-ink-mute mt-2">purchases</div>
        </div>
      </div>

      {/* Quick actions + recent orders */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-chalk border-2 border-ink p-5">
          <h3 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink mb-4 pb-2 border-b-2 border-ink">
            Quick actions
          </h3>
          <div className="space-y-3">
            <Link
              to="/courses/new"
              className="block font-display font-bold text-[15px] text-ink hover:text-cobalt transition-colors"
            >
              Create a new course
            </Link>
            <Link
              to="/courses"
              className="block font-display font-bold text-[15px] text-ink hover:text-cobalt transition-colors"
            >
              Browse all courses
            </Link>
          </div>
        </div>

        {recentOrders.length > 0 && (
          <div className="bg-chalk border-2 border-ink p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-ink">
              <h3 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">
                Recent orders
              </h3>
              <Link
                to="/settings/orders"
                className="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-cobalt hover:text-ink"
              >
                View all
              </Link>
            </div>
            <ul className="space-y-2.5">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-ink truncate">{o.courseTitle}</span>
                  <span
                    className={`font-mono uppercase tracking-[0.08em] text-[10px] font-bold shrink-0 ${
                      o.status === "Paid" ? "text-[#1b5e34]" : "text-cobalt"
                    }`}
                  >
                    {o.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
