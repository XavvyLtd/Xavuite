import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
 
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    // Hardcode the production API URL so it's always baked into the bundle
    'import.meta.env.VITE_API_URL': JSON.stringify(
      mode === 'production'
        ? 'https://api-v2.xavvy.uk'
        : 'http://localhost:8787'
    ),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
}));