import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";

// Landing route after the Google OAuth redirect. The API has already set our auth
// cookies; here we fetch the current user to populate client-side auth state.
export const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { hydrate } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const me = await apiClient.getMe();
        hydrate?.({
          userId: me.id,
          email: me.email,
          isEmailVerified: me.isEmailVerified,
          displayName: me.displayName,
        });
        navigate("/courses", { replace: true });
      } catch {
        navigate("/login?error=google", { replace: true });
      }
    })();
  }, [navigate, hydrate]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <p className="font-mono uppercase tracking-[0.14em] text-[12px] text-ink-mute">
        Signing you in...
      </p>
    </div>
  );
};
