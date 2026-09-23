import { Route, Routes, Navigate } from 'react-router-dom';
import { ProtectedRoute, GuestRoute } from './routes/ProtectedRoute.jsx';
import { paths } from './routes/paths.js';
import LoginPage from './features/auth/pages/LoginPage.jsx';
import RegisterPage from './features/auth/pages/RegisterPage.jsx';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage.jsx';
import HomePage from './features/home/HomePage.jsx';

export default function App() {
  return (
    <>
      {/* First thing in the tab order: a way past the header for keyboard users. */}
      <a className="skip-link" href="#main">Skip to main content</a>

      <div id="main">
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path={paths.login} element={<LoginPage />} />
            <Route path={paths.register} element={<RegisterPage />} />
            <Route path={paths.forgotPassword} element={<ForgotPasswordPage />} />
            <Route path={paths.resetPassword} element={<ResetPasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path={paths.home} element={<HomePage />} />
          </Route>

          {/* Anything else goes home, which sends a signed-out visitor to sign in. */}
          <Route path="*" element={<Navigate to={paths.home} replace />} />
        </Routes>
      </div>
    </>
  );
}
