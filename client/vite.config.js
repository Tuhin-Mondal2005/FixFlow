import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs on :5000. Proxying keeps cookies/CORS out of the picture and lets
// Socket.IO and profile photos work from the same origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true, changeOrigin: true },
    },
  },
});
