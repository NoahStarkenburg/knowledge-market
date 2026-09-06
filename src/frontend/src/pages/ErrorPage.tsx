import React from "react";
import { Link, useRouteError, isRouteErrorResponse } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { usePageTitle } from "../hooks/usePageTitle";

export const ErrorPage: React.FC = () => {
  const error = useRouteError();
  usePageTitle("Error");

  let message = "An unexpected error occurred.";
  let status = "";
  if (isRouteErrorResponse(error)) {
    status = String(error.status);
    message = error.statusText || error.data?.message || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="min-h-screen flex items-center bg-paper bg-grid px-6">
      <div className="max-w-[1280px] mx-auto w-full grid grid-cols-12 gap-8 py-20">
        <div className="col-span-12 md:col-span-8">
          <div className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-5">
            {status ? `Error ${status}` : "Error"}
          </div>
          <h1 className="font-display display-x font-extrabold uppercase leading-[0.85] tracking-[-0.03em] text-ink text-[clamp(2.5rem,7vw,4.5rem)] mb-6">
            Something went wrong.
          </h1>
          <p className="text-[16px] leading-[1.6] text-ink-soft max-w-[60ch] mb-4">
            We hit an unexpected error rendering this page.
          </p>
          <p className="font-mono text-[13px] leading-[1.55] text-ink-soft bg-paper-dim border-2 border-ink px-4 py-3 max-w-[80ch] mb-8 break-words">
            {message}
          </p>
          <div className="flex flex-wrap gap-5 items-center">
            <Link to="/">
              <Button variant="primary" size="lg">
                Back to the front page
              </Button>
            </Link>
            <Button variant="secondary" size="lg" onClick={() => window.location.reload()}>
              Reload this page
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
