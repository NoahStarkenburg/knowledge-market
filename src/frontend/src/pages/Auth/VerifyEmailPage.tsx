import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import type { ApiError } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Ornament } from "../../components/ui/Ornament";
import { usePageTitle } from "../../hooks/usePageTitle";

export const VerifyEmailPage: React.FC = () => {
  usePageTitle("Verify email");
  const [searchParams] = useSearchParams();
  const { isAuthenticated, markEmailVerified } = useAuth();
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [resendError, setResendError] = useState<ApiError | undefined>();

  const success = searchParams.get("success");
  const error = searchParams.get("error");

  useEffect(() => {
    if (success === "true") {
      markEmailVerified();
    }
  // markEmailVerified is stable (defined outside render), but we only want this once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  const handleResend = async () => {
    setResendLoading(true);
    setResendError(undefined);
    setResendDone(false);
    try {
      await apiClient.resendVerification();
      setResendDone(true);
    } catch (err: unknown) {
      setResendError(err as ApiError);
    } finally {
      setResendLoading(false);
    }
  };

  const Brand = () => (
    <Link to="/" className="flex items-center gap-2.5 mb-8">
      <Ornament size={20} className="text-cobalt" />
      <span className="font-display font-extrabold uppercase tracking-[-0.01em] text-[20px] leading-none">
        <span className="text-ink">Knowledge</span>
        <span className="text-cobalt">Market</span>
      </span>
    </Link>
  );

  if (success === "true") {
    return (
      <div className="min-h-screen bg-paper bg-grid flex flex-col items-center justify-center px-4 py-12">
        <Brand />
        <div className="bg-chalk border-2 border-ink shadow-hard p-8 w-full max-w-md text-center">
          <p className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-4">
            Verified
          </p>
          <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(1.9rem,5vw,2.5rem)] text-ink mb-3">
            Email verified!
          </h1>
          <p className="text-[13px] leading-[1.6] text-ink-soft mb-6">
            Your email address has been confirmed. You now have full access to KnowledgeMarket.
          </p>
          <Link to="/courses">
            <Button variant="primary" size="lg" className="w-full">
              Browse courses
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (error === "expired" || error === "invalid") {
    const isExpired = error === "expired";
    return (
      <div className="min-h-screen bg-paper bg-grid flex flex-col items-center justify-center px-4 py-12">
        <Brand />
        <div className="bg-chalk border-2 border-ink shadow-hard p-8 w-full max-w-md text-center">
          <p className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-danger mb-4">
            Error
          </p>
          <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(1.9rem,5vw,2.5rem)] text-ink mb-3">
            {isExpired ? "Link expired" : "Invalid link"}
          </h1>
          <p className="text-[13px] leading-[1.6] text-ink-soft mb-6">
            {isExpired
              ? "This verification link has expired. Request a new one below."
              : "This verification link is not valid. Request a new one below."}
          </p>

          {resendDone ? (
            <p className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-[#1b5e34]">
              Sent! Check your inbox.
            </p>
          ) : isAuthenticated ? (
            <>
              {resendError && (
                <p className="text-[13px] text-danger mb-3">
                  {resendError.detail ?? resendError.message ?? "Failed to resend. Please try again."}
                </p>
              )}
              <Button variant="primary" size="lg" disabled={resendLoading} onClick={handleResend}>
                {resendLoading ? "Sending…" : "Resend verification email"}
              </Button>
            </>
          ) : (
            <p className="text-[13px] text-ink-soft">
              <Link
                to="/login"
                className="font-semibold text-cobalt hover:text-ink underline underline-offset-2 decoration-2"
              >
                Sign in
              </Link>{" "}
              to request a new verification email.
            </p>
          )}
        </div>
      </div>
    );
  }

  // No params — generic "check your email" info page
  return (
    <div className="min-h-screen bg-paper bg-grid flex flex-col items-center justify-center px-4 py-12">
      <Brand />
      <div className="bg-chalk border-2 border-ink shadow-hard p-8 w-full max-w-md text-center">
        <p className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-4">
          Check your inbox
        </p>
        <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(1.9rem,5vw,2.5rem)] text-ink mb-3">
          Check your email
        </h1>
        <p className="text-[13px] leading-[1.6] text-ink-soft mb-6">
          We sent a verification link to your email address. Click it to confirm your account.
        </p>
        {isAuthenticated && (
          <>
            {resendDone ? (
              <p className="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-[#1b5e34]">
                Sent! Check your inbox.
              </p>
            ) : (
              <Button variant="secondary" size="lg" disabled={resendLoading} onClick={handleResend}>
                {resendLoading ? "Sending…" : "Resend email"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
