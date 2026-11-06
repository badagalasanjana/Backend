import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Set API_TARGET if the API runs on a different port.
    proxy: { '/api': process.env.API_TARGET || 'http://localhost:5000' },
  },
});
