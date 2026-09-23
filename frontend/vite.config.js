import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Fail loudly on a taken port. Sliding to 3001 would silently break CORS and
    // the Origin check on the auth routes, which is a confusing afternoon.
    strictPort: true,
    proxy: {
      // Same-origin in development, so the refresh cookie behaves exactly as it
      // will in production. No CORS preflight, no SameSite surprises.
      '/api': { target: 'http://localhost:5000', changeOrigin: false },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 still uses Sass's legacy colour functions and @import, and
        // each build prints 300-odd deprecation notices about its own internals.
        // Silencing them keeps a warning about OUR stylesheet visible, which is the
        // only reason to read the output at all.
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
});
