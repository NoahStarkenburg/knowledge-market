import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Ornament } from "../ui/Ornament";

export const Navbar: React.FC = () => {
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Auto-close the mobile menu when the user navigates to a new route.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `font-mono uppercase tracking-[0.12em] text-[11px] font-bold transition-colors pb-0.5 border-b-2 ${
      isActive
        ? "text-cobalt border-cobalt"
        : "text-ink-mute border-transparent hover:text-ink"
    }`;

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block py-2.5 font-mono uppercase tracking-[0.12em] text-[13px] font-bold ${
      isActive ? "text-cobalt" : "text-ink"
    }`;

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-ink bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-cobalt focus:text-white focus:px-3 focus:py-2 focus:font-mono focus:uppercase focus:tracking-[0.12em] focus:text-[11px] focus:font-bold"
      >
        Skip to content
      </a>
      <div className="max-w-[1320px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <Ornament size={18} className="text-cobalt" />
          <span className="font-display font-extrabold uppercase tracking-[-0.01em] text-[18px] leading-none">
            <span className="text-ink">Knowledge</span>
            <span className="text-cobalt">Market</span>
          </span>
        </Link>

        {isAuthenticated && (
          <nav className="hidden md:flex items-center gap-7 flex-1">
            <NavLink to="/courses" className={navLinkClass}>
              Catalog
            </NavLink>
            <NavLink to="/settings/learning" className={navLinkClass}>
              Learning
            </NavLink>
            <NavLink to="/settings/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navLinkClass}>
                Admin
              </NavLink>
            )}
          </nav>
        )}

        <div className="hidden md:flex items-center gap-6">
          {isAuthenticated ? (
            <>
              <NavLink to="/settings" className={navLinkClass}>
                Account
              </NavLink>
              <button
                onClick={handleLogout}
                className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink-mute hover:text-ink transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink-mute hover:text-ink transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center font-mono uppercase tracking-[0.08em] text-[11px] font-bold bg-ink text-paper border-2 border-ink px-4 py-2 shadow-hard-sm hover:bg-cobalt hover:border-cobalt hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[background-color,color,border-color,transform,box-shadow] duration-100"
              >
                Start learning
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          className="md:hidden font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink border-2 border-ink px-3 py-1.5"
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </div>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          className="md:hidden border-t-2 border-ink bg-paper"
        >
          <div className="max-w-[1320px] mx-auto px-5 sm:px-6 py-4">
            {isAuthenticated ? (
              <>
                <NavLink to="/courses" className={mobileNavLinkClass}>
                  Catalog
                </NavLink>
                <NavLink to="/settings/learning" className={mobileNavLinkClass}>
                  Learning
                </NavLink>
                <NavLink to="/settings/dashboard" className={mobileNavLinkClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/settings" className={mobileNavLinkClass}>
                  Account
                </NavLink>
                {isAdmin && (
                  <NavLink to="/admin" className={mobileNavLinkClass}>
                    Admin
                  </NavLink>
                )}
                <button
                  onClick={handleLogout}
                  className="block py-2.5 w-full text-left font-mono uppercase tracking-[0.12em] text-[13px] font-bold text-ink-mute"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/courses" className={mobileNavLinkClass}>
                  Catalog
                </NavLink>
                <NavLink to="/login" className={mobileNavLinkClass}>
                  Log in
                </NavLink>
                <NavLink to="/register" className={mobileNavLinkClass}>
                  Start learning
                </NavLink>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};
