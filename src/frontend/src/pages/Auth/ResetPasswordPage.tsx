import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import type { ApiError } from "../../api/types";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { Alert } from "../../components/ui/Alert";
import { Ornament } from "../../components/ui/Ornament";
import { usePageTitle } from "../../hooks/usePageTitle";

export const ResetPasswordPage: React.FC = () => {
  usePageTitle("Choose a new password");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(undefined);

    if (newPassword.length < 8) {
      setValidationError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.resetPassword({ token, newPassword });
      setSucceeded(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-paper bg-grid flex flex-col items-center justify-center px-4 py-12">
        <Link to="/" className="flex items-center gap-2.5 mb-8">
          <Ornament size={20} className="text-cobalt" />
          <span className="font-display font-extrabold uppercase tracking-[-0.01em] text-[20px] leading-none">
            <span className="text-ink">Knowledge</span>
            <span className="text-cobalt">Market</span>
          </span>
        </Link>
        <div className="bg-chalk border-2 border-ink shadow-hard p-8 w-full max-w-md text-center">
          <p className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-danger mb-3">
            Error
          </p>
          <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(1.9rem,5vw,2.5rem)] text-ink mb-3">
            Invalid link
          </h1>
          <p className="text-[13px] leading-[1.6] text-ink-soft mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Link
            to="/forgot-password"
            className="font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-cobalt hover:text-ink transition-colors"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper bg-grid flex flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="flex items-center gap-2.5 mb-8">
        <Ornament size={20} className="text-cobalt" />
        <span className="font-display font-extrabold uppercase tracking-[-0.01em] text-[20px] leading-none">
          <span className="text-ink">Knowledge</span>
          <span className="text-cobalt">Market</span>
        </span>
      </Link>

      <div className="bg-chalk border-2 border-ink shadow-hard p-8 w-full max-w-md">
        {succeeded ? (
          <div className="text-center">
            <p className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-4">
              Password updated
            </p>
            <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(1.9rem,5vw,2.5rem)] text-ink mb-3">
              All set
            </h1>
            <p className="text-[13px] leading-[1.6] text-ink-soft mb-6">
              Your password has been changed. Redirecting you to sign in…
            </p>
            <Link
              to="/login"
              className="font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-cobalt hover:text-ink transition-colors"
            >
              Sign in now
            </Link>
          </div>
        ) : (
          <>
            <p className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-3">
              New password
            </p>
            <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(1.9rem,5vw,2.5rem)] text-ink mb-3">
              Choose a new password
            </h1>
            <p className="text-[14px] leading-[1.6] text-ink-soft mb-7">
              Must be at least 8 characters.
            </p>

            <form onSubmit={handleSubmit}>
              <FormErrorList error={error} />
              {validationError && <Alert type="error">{validationError}</Alert>}
              <TextField
                label="New password"
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <TextField
                label="Confirm password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Saving…" : "Set new password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
