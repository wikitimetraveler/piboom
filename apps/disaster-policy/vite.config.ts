import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/finance/disaster-policy/',
  build: {
    outDir: '../../public/finance/disaster-policy',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/shared': 'http://127.0.0.1:3000',
      '/finance/assets': 'http://127.0.0.1:3000',
      '/data': 'http://127.0.0.1:3000',
    },
  },
});
