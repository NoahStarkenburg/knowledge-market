import { Routes } from '@angular/router';
import { authGuard, adminGuard } from '@core/auth.guards';

// Landing is bare (no shell); everything else renders inside AppLayout. Access control is
// authGuard / adminGuard; every page is a lazy-loaded standalone component.
export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('@features/landing/landing.page').then((m) => m.LandingPage) },
  {
    path: '',
    loadComponent: () => import('@layout/app-layout').then((m) => m.AppLayoutComponent),
    children: [
      // Auth
      { path: 'login', loadComponent: () => import('@features/auth/login.page').then((m) => m.LoginPage) },
      { path: 'register', loadComponent: () => import('@features/auth/register.page').then((m) => m.RegisterPage) },
      { path: 'forgot-password', loadComponent: () => import('@features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage) },
      { path: 'reset-password', loadComponent: () => import('@features/auth/reset-password.page').then((m) => m.ResetPasswordPage) },
      { path: 'verify-email', loadComponent: () => import('@features/auth/verify-email.page').then((m) => m.VerifyEmailPage) },
      { path: 'auth/callback', loadComponent: () => import('@features/auth/oauth-callback.page').then((m) => m.OAuthCallbackPage) },

      // Legal
      { path: 'terms', loadComponent: () => import('@features/legal/terms.page').then((m) => m.TermsPage) },
      { path: 'privacy', loadComponent: () => import('@features/legal/privacy.page').then((m) => m.PrivacyPage) },
      { path: 'refunds', loadComponent: () => import('@features/legal/refund-policy.page').then((m) => m.RefundPolicyPage) },
      { path: 'dmca', loadComponent: () => import('@features/legal/dmca.page').then((m) => m.DmcaPage) },

      // Courses (auth)
      { path: 'courses', canActivate: [authGuard], loadComponent: () => import('@features/courses/courses-list.page').then((m) => m.CoursesListPage) },
      { path: 'courses/new', canActivate: [authGuard], loadComponent: () => import('@features/courses/course-create.page').then((m) => m.CourseCreatePage) },
      { path: 'courses/:courseId', canActivate: [authGuard], loadComponent: () => import('@features/courses/course-detail.page').then((m) => m.CourseDetailPage) },
      { path: 'courses/:courseId/lessons', canActivate: [authGuard], loadComponent: () => import('@features/courses/lesson-list.page').then((m) => m.LessonListPage) },
      { path: 'courses/:courseId/lessons/:lessonId', canActivate: [authGuard], loadComponent: () => import('@features/courses/lesson-view.page').then((m) => m.LessonViewPage) },
      { path: 'courses/:courseId/lessons/:lessonId/manage', canActivate: [authGuard], loadComponent: () => import('@features/courses/lesson-content-manage.page').then((m) => m.LessonContentManagePage) },

      // Checkout (auth)
      { path: 'checkout/:orderId', canActivate: [authGuard], loadComponent: () => import('@features/orders/checkout.page').then((m) => m.CheckoutPage) },

      // Admin
      { path: 'admin', canActivate: [adminGuard], loadComponent: () => import('@features/admin/admin-dashboard.page').then((m) => m.AdminDashboardPage) },

      // Legacy redirects + settings hub
      { path: 'orders', redirectTo: 'settings/orders', pathMatch: 'full' },
      { path: 'profile', redirectTo: 'settings/overview', pathMatch: 'full' },
      { path: 'settings', redirectTo: 'settings/overview', pathMatch: 'full' },
      { path: 'settings/:section', canActivate: [authGuard], loadComponent: () => import('@features/settings/settings.page').then((m) => m.SettingsPage) },

      { path: '**', loadComponent: () => import('@features/not-found.page').then((m) => m.NotFoundPage) },
    ],
  },
];
