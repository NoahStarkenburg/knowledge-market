import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import type { ApiError } from "../../api/types";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { Ornament } from "../../components/ui/Ornament";
import { usePageTitle } from "../../hooks/usePageTitle";

export const ForgotPasswordPage: React.FC = () => {
  usePageTitle("Reset password");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    try {
      await apiClient.forgotPassword({ email });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

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
        {submitted ? (
          <div className="text-center">
            <p className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-4">
              Email sent
            </p>
            <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(1.9rem,5vw,2.5rem)] text-ink mb-3">
              Check your email
            </h1>
            <p className="text-[13px] leading-[1.6] text-ink-soft mb-6">
              If an account exists for <strong className="text-ink">{email}</strong>, we sent a link
              to reset your password. The link expires in 1 hour.
            </p>
            <Link
              to="/login"
              className="font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-cobalt hover:text-ink transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-3">
              Reset password
            </p>
            <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(1.9rem,5vw,2.5rem)] text-ink mb-3">
              Reset your password
            </h1>
            <p className="text-[14px] leading-[1.6] text-ink-soft mb-7">
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit}>
              <FormErrorList error={error} />
              <TextField
                label="Email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>

            <p className="text-[13px] text-ink-soft mt-6 text-center">
              Remember your password?{" "}
              <Link
                to="/login"
                className="font-semibold text-cobalt hover:text-ink underline underline-offset-2 decoration-2"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};
