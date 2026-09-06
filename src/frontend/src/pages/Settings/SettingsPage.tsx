import React from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { OverviewSection } from "./OverviewSection";
import { DashboardSection } from "./DashboardSection";
import { LearningSection } from "./LearningSection";
import { CreatorSection } from "./CreatorSection";
import { OrdersSection } from "./OrdersSection";
import { AccountSection } from "./AccountSection";
import { usePageTitle } from "../../hooks/usePageTitle";

type Section = "overview" | "dashboard" | "learning" | "creator" | "orders" | "account";

const NAV_ITEMS: Array<{ section: Section; label: string }> = [
  { section: "overview", label: "Overview" },
  { section: "dashboard", label: "Dashboard" },
  { section: "learning", label: "Learning" },
  { section: "creator", label: "Creator studio" },
  { section: "orders", label: "Orders" },
  { section: "account", label: "Account" },
];

const VALID_SECTIONS = NAV_ITEMS.map((n) => n.section);

export const SettingsPage: React.FC = () => {
  const { section } = useParams<{ section?: string }>();
  const { email } = useAuth();

  const activeSection = (
    section && VALID_SECTIONS.includes(section as Section) ? section : "overview"
  ) as Section;

  const sectionTitle = NAV_ITEMS.find((n) => n.section === activeSection)?.label ?? "Settings";
  usePageTitle(sectionTitle);

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewSection />;
      case "dashboard":
        return <DashboardSection />;
      case "learning":
        return <LearningSection />;
      case "creator":
        return <CreatorSection />;
      case "orders":
        return <OrdersSection />;
      case "account":
        return <AccountSection />;
    }
  };

  return (
    <div className="min-h-screen bg-paper flex">
      {/* ── Sidebar (editorial rail) ──────────────────────────────────── */}
      <aside className="w-[220px] shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] flex flex-col px-6 py-8 border-r-2 border-ink">
        <div className="mb-8">
          <div className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-ink-mute mb-2">
            Signed in as
          </div>
          <div className="text-[13px] text-ink truncate" title={email ?? undefined}>
            {email ?? "—"}
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item, idx) => {
            const isActive = activeSection === item.section;
            return (
              <Link
                key={item.section}
                to={`/settings/${item.section}`}
                className={`group flex items-baseline gap-3 py-2.5 pl-3 -ml-3 border-l-2 transition-colors ${
                  isActive
                    ? "border-cobalt text-ink"
                    : "border-transparent text-ink-mute hover:text-ink hover:border-ink"
                }`}
              >
                <span
                  className={`font-mono text-[10px] font-bold tabular-nums ${
                    isActive ? "text-cobalt" : "text-ink-mute group-hover:text-ink"
                  }`}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="font-mono uppercase tracking-[0.08em] text-[11px] font-bold whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {renderSection()}
      </main>
    </div>
  );
};
