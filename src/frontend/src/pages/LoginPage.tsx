import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TextField } from "../components/ui/TextField";
import { Button } from "../components/ui/Button";
import { FormErrorList } from "../components/ui/FormErrorList";
import { useAuth } from "../context/AuthContext";
import type { ApiError } from "../api/types";
import { Ornament } from "../components/ui/Ornament";
import { usePageTitle } from "../hooks/usePageTitle";
import { GoogleSignInButton } from "../components/Auth/GoogleSignInButton";

export const LoginPage: React.FC = () => {
  usePageTitle("Log in");
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate("/courses");
    } else {
      setError(result.error);
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
          Sign in
        </p>
        <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(1.9rem,5vw,2.5rem)] text-ink mb-3">
          Welcome back
        </h1>
        <p className="text-[14px] leading-[1.6] text-ink-soft mb-7">
          Sign in to your account to continue.
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex justify-end -mt-3 mb-5">
            <Link
              to="/forgot-password"
              className="font-mono uppercase tracking-[0.08em] text-[10px] font-bold text-ink-mute hover:text-cobalt transition-colors"
            >
              Forgot your password?
            </Link>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <GoogleSignInButton />

        <p className="text-[13px] text-ink-soft mt-6 text-center">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-semibold text-cobalt hover:text-ink underline underline-offset-2 decoration-2"
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
};
