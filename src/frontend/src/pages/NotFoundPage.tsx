import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { usePageTitle } from "../hooks/usePageTitle";

export const NotFoundPage: React.FC = () => {
  usePageTitle("Not found");

  return (
    <div className="min-h-[70vh] flex items-center bg-paper bg-grid px-6">
      <div className="max-w-[1280px] mx-auto w-full grid grid-cols-12 gap-8 items-start py-20">
        <div className="col-span-12 md:col-span-7">
          <div className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-5">
            Error 404
          </div>
          <h1 className="font-display display-x font-extrabold uppercase leading-[0.85] tracking-[-0.03em] text-ink text-[clamp(2.75rem,8vw,5.5rem)] mb-6">
            That page is no longer in print.
          </h1>
          <p className="text-[16px] leading-[1.6] text-ink-soft max-w-[52ch] mb-8">
            The URL you tried does not match any page on the site. It may have been moved, the
            course you were looking at may have been unpublished, or the link you followed may have
            been mistyped.
          </p>
          <div className="flex flex-wrap gap-5 items-center">
            <Link to="/">
              <Button variant="primary" size="lg">
                Back to the front page
              </Button>
            </Link>
            <Link
              to="/courses"
              className="font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-ink underline underline-offset-4 decoration-2 decoration-cobalt hover:text-cobalt"
            >
              Browse the catalog
            </Link>
          </div>
        </div>
        <aside className="hidden md:block md:col-span-4 md:col-start-9 md:pl-8 md:border-l-2 md:border-ink">
          <div className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-ink-mute mb-4">
            What you can try
          </div>
          <ul className="space-y-3 text-[14px] leading-[1.6] text-ink-soft">
            <li>Search the catalog from any page.</li>
            <li>Check the URL for typos.</li>
            <li>Go back and follow the link again.</li>
            <li>Return to the front page.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
};
