import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TextField } from "../components/ui/TextField";
import { Button } from "../components/ui/Button";
import { FormErrorList } from "../components/ui/FormErrorList";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/apiClient";
import type { ApiError } from "../api/types";
import { Ornament } from "../components/ui/Ornament";
import { usePageTitle } from "../hooks/usePageTitle";
import { GoogleSignInButton } from "../components/Auth/GoogleSignInButton";

export const RegisterPage: React.FC = () => {
  usePageTitle("Create an account");
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<ApiError | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/courses");
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (password !== confirmPassword) {
      setError({ status: 400, title: "Passwords do not match" });
      return;
    }

    setLoading(true);
    try {
      await apiClient.register(email, password);
      const result = await login(email, password);
      if (result.success) {
        navigate("/courses");
      } else {
        setError(result.error);
      }
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper bg-grid flex flex-col items-center justify-center px-4 py-12">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-2.5 mb-8">
        <Ornament size={20} className="text-cobalt" />
        <span className="font-display font-extrabold uppercase tracking-[-0.01em] text-[20px] leading-none">
          <span className="text-ink">Knowledge</span>
          <span className="text-cobalt">Market</span>
        </span>
      </Link>

      {/* Card */}
      <div className="bg-chalk border-2 border-ink shadow-hard p-8 w-full max-w-md">
        <p className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-3">
          Create account
        </p>
        <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(1.9rem,5vw,2.5rem)] text-ink mb-3">
          Create your account
        </h1>
        <p className="text-[14px] leading-[1.6] text-ink-soft mb-7">
          Join thousands of learners and creators today.
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
          <TextField
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-[12px] text-ink-mute mt-4 text-center leading-relaxed">
            By creating an account, you agree to our{" "}
            <Link to="/terms" className="text-cobalt hover:text-ink underline underline-offset-2 decoration-2">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-cobalt hover:text-ink underline underline-offset-2 decoration-2">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <GoogleSignInButton />

        <p className="text-[13px] text-ink-soft mt-6 text-center">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-cobalt hover:text-ink underline underline-offset-2 decoration-2"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
