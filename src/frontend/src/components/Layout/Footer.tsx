import React from "react";
import { Link } from "react-router-dom";
import { Ornament } from "../ui/Ornament";

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-paper border-t-2 border-ink mt-auto">
      <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
          <FooterColumn label="Catalog" links={[
            { to: "/courses", text: "Browse all" },
            { to: "/courses?sort=newest", text: "Recently added" },
            { to: "/courses?sort=popular", text: "Most popular" },
          ]} />
          <FooterColumn label="Teach" links={[
            { to: "/register", text: "Become a creator" },
            { to: "/courses/new", text: "Submit a course" },
          ]} />
          <FooterColumn label="Account" links={[
            { to: "/settings/learning", text: "My learning" },
            { to: "/settings/orders", text: "Orders" },
            { to: "/settings/account", text: "Settings" },
          ]} />
          <FooterColumn label="Legal" links={[
            { to: "/terms", text: "Terms" },
            { to: "/privacy", text: "Privacy" },
            { to: "/refunds", text: "Refunds" },
            { to: "/dmca", text: "DMCA" },
          ]} />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-6 border-t-2 border-ink">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5">
              <Ornament size={16} className="text-cobalt" />
              <span className="font-display font-extrabold uppercase tracking-[-0.01em] text-[20px] leading-none">
                <span className="text-ink">Knowledge</span>
                <span className="text-cobalt">Market</span>
              </span>
            </Link>
            <p className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink-mute mt-3">
              Vol. 01 / No. {String(Math.max(1, year - 2025)).padStart(2, "0")}
            </p>
          </div>
          <p className="font-mono uppercase tracking-[0.12em] text-[11px] text-ink-mute">
            &copy; {year} KnowledgeMarket. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

const FooterColumn: React.FC<{
  label: string;
  links: { to: string; text: string }[];
}> = ({ label, links }) => (
  <div>
    <div className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink mb-4 pb-2 border-b-2 border-ink">
      {label}
    </div>
    <ul className="space-y-2.5">
      {links.map((link) => (
        <li key={link.to + link.text}>
          <Link
            to={link.to}
            className="text-[14px] text-ink-soft hover:text-cobalt transition-colors"
          >
            {link.text}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);
