import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: { port: 5173, host: true },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
    cssMinify: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: 'index.html',
        home: 'home/index.html',
      },
    },
  },
});
