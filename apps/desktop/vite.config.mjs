import { defineConfig } from 'vite';
export default defineConfig(({ command }) => ({
  root: 'src/renderer', base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  plugins: [{ name: 'development-csp', transformIndexHtml: html => command === 'serve' ? html.replace("connect-src 'none'", "connect-src 'self' ws://127.0.0.1:5173").replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") : html }],
  build: { outDir: '../../dist/renderer', emptyOutDir: true }
}));
