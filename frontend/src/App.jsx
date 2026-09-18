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

const SortStartPage = lazy(() => import('./features/sort/pages/SortStartPage.jsx'));
const SortSessionPage = lazy(() => import('./features/sort/pages/SortSessionPage.jsx'));
const SortResultPage = lazy(() => import('./features/sort/pages/SortResultPage.jsx'));

const DashboardPage = lazy(() => import('./features/dashboard/pages/DashboardPage.jsx'));
const AuditPage = lazy(() => import('./features/audit/pages/AuditPage.jsx'));
const DripPage = lazy(() => import('./features/drip/pages/DripPage.jsx'));
const AdvisorPage = lazy(() => import('./features/advisor/pages/AdvisorPage.jsx'));
const PlanDetailPage = lazy(() => import('./features/plans/pages/PlanDetailPage.jsx'));
const DelegationPage = lazy(() => import('./features/delegation/pages/DelegationPage.jsx'));
const PlaybooksPage = lazy(() => import('./features/playbooks/pages/PlaybooksPage.jsx'));
const PlaybookDetailPage = lazy(() => import('./features/playbooks/pages/PlaybookDetailPage.jsx'));
const WeeklyReviewPage = lazy(() => import('./features/review/pages/WeeklyReviewPage.jsx'));
const SettingsPage = lazy(() => import('./features/settings/pages/SettingsPage.jsx'));

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
            {/* The sort runs full-screen: one job, no chrome to wander into. */}
            <Route path={paths.sortStart} element={<SortStartPage />} />
            <Route path={paths.sortResultPattern} element={<SortResultPage />} />
            <Route path={paths.sortSessionPattern} element={<SortSessionPage />} />

            <Route path={paths.app} element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="drip" element={<DripPage />} />
              <Route path="advisor" element={<AdvisorPage />} />
              <Route path="plans/:id" element={<PlanDetailPage />} />
              <Route path="delegation" element={<DelegationPage />} />
              <Route path="playbooks" element={<PlaybooksPage />} />
              <Route path="playbooks/:id" element={<PlaybookDetailPage />} />
              <Route path="review" element={<WeeklyReviewPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={paths.landing} replace />} />
      </Routes>
    </Suspense>
  );
}
