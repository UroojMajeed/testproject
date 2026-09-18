import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './routes/ProtectedRoute.jsx';
import { OnboardingGate, OnboardingOnly } from './routes/OnboardingGate.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';
import { paths } from './routes/paths.js';
import { FullPageSpinner } from './components/ui/FullPageSpinner.jsx';

// Route-level splitting: the marketing page should not ship the app shell.
const LandingPage = lazy(() => import('./features/landing/pages/LandingPage.jsx'));
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./features/auth/pages/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./features/auth/pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./features/auth/pages/ResetPasswordPage.jsx'));
const OnboardingPage = lazy(() => import('./features/onboarding/pages/OnboardingPage.jsx'));
const DashboardPage = lazy(() => import('./features/dashboard/pages/DashboardPage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path={paths.landing} element={<LandingPage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path={paths.login} element={<LoginPage />} />
          <Route path={paths.register} element={<RegisterPage />} />
          <Route path={paths.forgotPassword} element={<ForgotPasswordPage />} />
          <Route path={paths.resetPassword} element={<ResetPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<OnboardingOnly />}>
            <Route path={paths.onboarding} element={<OnboardingPage />} />
          </Route>

          <Route element={<OnboardingGate />}>
            <Route path={paths.app} element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={paths.landing} replace />} />
      </Routes>
    </Suspense>
  );
}
