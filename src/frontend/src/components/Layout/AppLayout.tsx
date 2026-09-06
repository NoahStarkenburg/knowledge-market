import React from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { EmailVerificationBanner } from "./EmailVerificationBanner";
import { Footer } from "./Footer";

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <Navbar />
      <EmailVerificationBanner />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
