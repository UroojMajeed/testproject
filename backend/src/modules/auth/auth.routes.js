import { Router } from 'express';
import * as c from './auth.controller.js';
import * as v from './auth.validation.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { verifyOrigin } from '../../middleware/csrf.middleware.js';
import { authLimiter, sensitiveLimiter } from '../../middleware/rateLimiter.js';

export const authRouter = Router();

// Every state-changing auth route is Origin-checked; the cookie is SameSite=Lax.
authRouter.use(verifyOrigin);

authRouter.post('/register', authLimiter, validate(v.registerSchema), c.register);
authRouter.post('/login', authLimiter, validate(v.loginSchema), c.login);
authRouter.post('/refresh', authLimiter, c.refresh);
authRouter.post('/logout', c.logout);

authRouter.post('/forgot-password', sensitiveLimiter, validate(v.forgotPasswordSchema), c.forgotPassword);
authRouter.post('/reset-password', sensitiveLimiter, validate(v.resetPasswordSchema), c.resetPassword);
authRouter.post('/verify-email', sensitiveLimiter, validate(v.verifyEmailSchema), c.verifyEmail);

authRouter.get('/me', requireAuth, c.me);
authRouter.post('/logout-all', requireAuth, c.logoutAll);
authRouter.post('/change-password', requireAuth, validate(v.changePasswordSchema), c.changePassword);
