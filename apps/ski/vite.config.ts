import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/ski/',
  build: {
    outDir: '../../public/ski',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/shared': 'http://127.0.0.1:3000',
      '/data': 'http://127.0.0.1:3000',
    },
  },
});
