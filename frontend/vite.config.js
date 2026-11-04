import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, Vite reenvía /api al backend. Así el navegador usa rutas
// relativas (/api/...) y la cookie de sesión funciona sin configurar CORS.
// Si el backend corre en otro puerto, define VITE_API_PROXY (por ejemplo en frontend/.env.local).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_PROXY || 'http://localhost:3000',
    },
  },
});
