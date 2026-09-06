import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../components/Layout/AppLayout";
import { LoginPage } from "../pages/LoginPage";
import { LandingPage } from "../pages/LandingPage";
import { CoursesListPage } from "../pages/Courses/CoursesListPage";
import { CourseCreatePage } from "../pages/Courses/CourseCreatePage";
import { CourseDetailPage } from "../pages/Courses/CourseDetailPage";
import { LessonListPage } from "../pages/Courses/LessonListPage";
import { LessonViewPage } from "../pages/Courses/LessonViewPage";
import { LessonContentManagePage } from "../pages/Courses/LessonContentManagePage";
import { SettingsPage } from "../pages/Settings/SettingsPage";
import { RegisterPage } from "../pages/RegisterPage";
import { CheckoutPage } from "../pages/Orders/CheckoutPage";
import { useAuth } from "../context/AuthContext";
import { ForgotPasswordPage } from "../pages/Auth/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/Auth/ResetPasswordPage";
import { VerifyEmailPage } from "../pages/Auth/VerifyEmailPage";
import { OAuthCallbackPage } from "../pages/Auth/OAuthCallbackPage";
import { AdminDashboardPage } from "../pages/Admin/AdminDashboardPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ErrorPage } from "../pages/ErrorPage";
import { TermsPage } from "../pages/Legal/TermsPage";
import { PrivacyPage } from "../pages/Legal/PrivacyPage";
import { RefundPolicyPage } from "../pages/Legal/RefundPolicyPage";
import { DmcaPage } from "../pages/Legal/DmcaPage";

// eslint-disable-next-line react-refresh/only-export-components
const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// eslint-disable-next-line react-refresh/only-export-components
const RequireAdmin: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/courses" replace />;
  return children;
};

export const router = createBrowserRouter([
  // Public landing page — no AppLayout wrapper, no auth required
  { path: "/", element: <LandingPage /> },
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      { path: "verify-email", element: <VerifyEmailPage /> },
      { path: "auth/callback", element: <OAuthCallbackPage /> },
      { path: "terms", element: <TermsPage /> },
      { path: "privacy", element: <PrivacyPage /> },
      { path: "refunds", element: <RefundPolicyPage /> },
      { path: "dmca", element: <DmcaPage /> },
      {
        path: "courses",
        element: (
          <RequireAuth>
            <CoursesListPage />
          </RequireAuth>
        ),
      },
      {
        path: "courses/new",
        element: (
          <RequireAuth>
            <CourseCreatePage />
          </RequireAuth>
        ),
      },
      {
        path: "courses/:courseId",
        element: (
          <RequireAuth>
            <CourseDetailPage />
          </RequireAuth>
        ),
      },
      {
        path: "courses/:courseId/lessons",
        element: (
          <RequireAuth>
            <LessonListPage />
          </RequireAuth>
        ),
      },
      {
        path: "courses/:courseId/lessons/:lessonId",
        element: (
          <RequireAuth>
            <LessonViewPage />
          </RequireAuth>
        ),
      },
      {
        path: "courses/:courseId/lessons/:lessonId/manage",
        element: (
          <RequireAuth>
            <LessonContentManagePage />
          </RequireAuth>
        ),
      },
      {
        path: "checkout/:orderId",
        element: (
          <RequireAuth>
            <CheckoutPage />
          </RequireAuth>
        ),
      },
      {
        path: "admin",
        element: (
          <RequireAdmin>
            <AdminDashboardPage />
          </RequireAdmin>
        ),
      },
      // Legacy redirects
      { path: "orders", element: <Navigate to="/settings/orders" replace /> },
      { path: "profile", element: <Navigate to="/settings/overview" replace /> },
      // Settings hub
      { path: "settings", element: <Navigate to="/settings/overview" replace /> },
      {
        path: "settings/:section",
        element: (
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
