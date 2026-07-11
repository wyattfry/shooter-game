import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    watch: {
      ignored: ['**/*.zip', '**/assets/**'],
      usePolling: true,
      interval: 300
    }
  }
});
