import { Route, Routes, Navigate } from 'react-router-dom';
import { ProtectedRoute, GuestRoute } from './routes/ProtectedRoute.jsx';
import { paths } from './routes/paths.js';
import LandingPage from './features/landing/LandingPage.jsx';
import LoginPage from './features/auth/pages/LoginPage.jsx';
import RegisterPage from './features/auth/pages/RegisterPage.jsx';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage.jsx';
import { OnboardingGate } from './routes/OnboardingGate.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';
import RatePage from './features/rate/RatePage.jsx';
import AuditPage from './features/audit/AuditPage.jsx';

/**
 * The skip link lives here, once, and every page supplies the `<main id="main">`
 * it points at. App does not wrap the routes in a `<main>` of its own: the landing
 * page has a header and a footer that belong outside the main landmark, and a page
 * that rendered its own `<main>` inside App's would nest two of them — invalid
 * HTML, and two "main" landmarks for a screen reader to choose between.
 */
export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>

      <Routes>
        {/*
          Open to everyone, signed in or not. Not a GuestRoute: bouncing a signed-in
          user off the front page would mean they could never read it again without
          signing out. The header offers them their account instead.
        */}
        <Route path={paths.landing} element={<LandingPage />} />

        <Route element={<GuestRoute />}>
          <Route path={paths.login} element={<LoginPage />} />
          <Route path={paths.register} element={<RegisterPage />} />
          <Route path={paths.forgotPassword} element={<ForgotPasswordPage />} />
          <Route path={paths.resetPassword} element={<ResetPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          {/*
            ProtectedRoute answers "are you signed in"; OnboardingGate answers
            "where do you belong", from the server's own /state. Nested, because
            the second question only makes sense once the first is yes.
          */}
          <Route element={<OnboardingGate />}>
            <Route path={paths.app} element={<DashboardPage />} />
            <Route path={paths.rate} element={<RatePage />} />
            <Route path={paths.audit} element={<AuditPage />} />
          </Route>
        </Route>

        {/*
          Anything unrecognised goes to the landing page, not to sign in. A mistyped
          URL is not an authentication problem, and answering one with a login form
          is a confusing thing to do to someone who is already signed in.
        */}
        <Route path="*" element={<Navigate to={paths.landing} replace />} />
      </Routes>
    </>
  );
}
