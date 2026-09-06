import React from "react";
import { Link, NavLink } from "react-router-dom";

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

const LEGAL_LINKS: { to: string; label: string }[] = [
  { to: "/terms", label: "Terms of service" },
  { to: "/privacy", label: "Privacy policy" },
  { to: "/refunds", label: "Refund policy" },
  { to: "/dmca", label: "Copyright / DMCA" },
];

const proseClass = [
  "max-w-none text-ink-soft text-[15px] leading-[1.7]",
  "[&>*:first-child]:mt-0",
  "[&_p]:my-4",
  "[&_h2]:font-display [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-[-0.005em] [&_h2]:text-[clamp(1.2rem,2.8vw,1.55rem)] [&_h2]:leading-[1.05] [&_h2]:text-ink [&_h2]:mt-10 [&_h2]:mb-3",
  "[&_h3]:font-mono [&_h3]:uppercase [&_h3]:tracking-[0.1em] [&_h3]:text-[12px] [&_h3]:font-bold [&_h3]:text-ink [&_h3]:mt-6 [&_h3]:mb-2",
  "[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:my-4 [&_ul]:space-y-1.5 [&_ul]:marker:text-cobalt",
  "[&_li]:pl-1",
  "[&_a]:text-cobalt [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-2 [&_a:hover]:text-cobalt-deep",
  "[&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-paper-dim [&_code]:text-ink [&_code]:px-1.5 [&_code]:py-0.5",
  "[&_strong]:font-bold [&_strong]:text-ink",
].join(" ");

export const LegalLayout: React.FC<LegalLayoutProps> = ({ title, lastUpdated, children }) => {
  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-[1100px] mx-auto px-5 sm:px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute hover:text-ink transition-colors mb-8"
        >
          &larr; Back to home
        </Link>

        <div className="border-b-2 border-ink pb-8 mb-10">
          <div className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-3">
            Legal
          </div>
          <h1 className="font-display display-x font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-ink text-[clamp(2.25rem,6vw,3.75rem)]">
            {title}
          </h1>
          <p className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute mt-5">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-8 lg:gap-12">
          <aside className="col-span-12 lg:col-span-3 lg:sticky lg:top-20 lg:self-start">
            <div className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink mb-3 pb-2 border-b-2 border-ink">
              Documents
            </div>
            <nav className="space-y-2">
              {LEGAL_LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `block px-3 py-2.5 font-mono uppercase tracking-[0.08em] text-[11px] font-bold border-2 border-ink transition-colors ${
                      isActive
                        ? "bg-ink text-paper"
                        : "bg-chalk text-ink-soft hover:bg-ink hover:text-paper"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </aside>

          <div className="col-span-12 lg:col-span-9 min-w-0">
            <div className={`bg-chalk border-2 border-ink p-6 sm:p-8 lg:p-10 ${proseClass}`}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
