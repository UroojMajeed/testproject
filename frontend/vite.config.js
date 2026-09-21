import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Without this Vite quietly falls back to 3001 when 3000 is taken, which
    // then fails CORS against the backend's CLIENT_URL for no visible reason.
    strictPort: true,
    proxy: {
      // Keeps the browser same-origin in development, so the refresh cookie
      // behaves exactly as it will in production behind one domain.
      '/api': { target: 'http://localhost:5000', changeOrigin: false },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
});
