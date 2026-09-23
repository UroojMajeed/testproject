import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { AuthProvider } from './context/AuthProvider.jsx';
import { queryClient } from './lib/queryClient.js';
import { ROUTER_FUTURE } from './routes/routerFuture.js';
// Self-hosted variable fonts. Each package ships one @font-face per unicode-range,
// so the browser fetches the Latin subset and nothing else — and the day this needs
// another alphabet, the declarations are already in place.
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import './styles/custom.scss';
import { initTheme } from './lib/theme.js';

// Before the first render, so the page never paints in the wrong theme and then
// corrects itself — the white flash on a dark-mode machine that makes a site feel
// cheaply made.
initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={ROUTER_FUTURE}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
