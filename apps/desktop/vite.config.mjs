import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig(({ command }) => ({
  root: 'src/renderer', base: './',
  // Use ESM TypeScript for browser validation; Node consumers keep the CommonJS build.
  resolve: { alias: { '@erp/contracts': fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  plugins: [{ name: 'development-csp', transformIndexHtml: html => command === 'serve' ? html.replace("connect-src 'none'", "connect-src 'self' ws://127.0.0.1:5173").replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") : html }],
  build: { outDir: '../../dist/renderer', emptyOutDir: true }
}));
