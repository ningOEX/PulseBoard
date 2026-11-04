import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/board/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    proxy: {
      '/board/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/board/, ''),
      },
      '/board/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/board/, ''),
      },
    },
  },
});
