import React from "react";
import { Button } from "../ui/Button";
import { apiClient } from "../../api/apiClient";

// Rendered only when Google OAuth is enabled at build time (VITE_GOOGLE_AUTH=true),
// so the app shows nothing broken until the backend is configured with Google creds.
export const GoogleSignInButton: React.FC = () => {
  if (import.meta.env.VITE_GOOGLE_AUTH !== "true") return null;

  return (
    <>
      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-ink/15" />
        <span className="font-mono uppercase tracking-[0.14em] text-[10px] text-ink-mute">or</span>
        <div className="h-px flex-1 bg-ink/15" />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={() => {
          window.location.href = apiClient.googleSignInUrl();
        }}
      >
        Continue with Google
      </Button>
    </>
  );
};
