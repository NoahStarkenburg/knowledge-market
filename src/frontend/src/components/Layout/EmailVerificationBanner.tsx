import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import type { ApiError } from "../../api/types";

export const EmailVerificationBanner: React.FC = () => {
  const { isAuthenticated, isEmailVerified, resendVerification } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<ApiError | undefined>();

  if (!isAuthenticated || isEmailVerified) return null;

  const handleResend = async () => {
    setSending(true);
    setSendError(undefined);
    try {
      await resendVerification();
      setSent(true);
    } catch (err: unknown) {
      setSendError(err as ApiError);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-signal border-b-2 border-ink px-5 sm:px-6 py-2.5 flex items-center gap-3 text-[13px]">
      <span className="font-mono uppercase tracking-[0.12em] text-[10px] font-bold bg-ink text-signal px-2 py-1 shrink-0">
        Unverified
      </span>
      <span className="text-ink flex-1 font-medium">
        Verify your email to unlock purchases and publishing.
      </span>
      {sent ? (
        <span className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink shrink-0">
          Sent
        </span>
      ) : sendError ? (
        <span className="text-danger font-medium">
          {sendError.detail ?? sendError.message ?? "Failed to resend."}
        </span>
      ) : (
        <button
          onClick={handleResend}
          disabled={sending}
          className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink underline underline-offset-4 decoration-2 hover:text-cobalt-deep disabled:opacity-50 shrink-0"
        >
          {sending ? "Sending…" : "Resend email"}
        </button>
      )}
    </div>
  );
};
