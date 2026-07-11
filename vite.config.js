import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    watch: {
      ignored: ['**/*.zip', '**/assets/**'],
      usePolling: true,
      interval: 300
    }
  }
});
