import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Serve the production security headers in `vite preview` too, so CSP breakage shows up locally.
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const headers = Object.fromEntries(vercel.headers[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  worker: { format: 'es' },
  preview: { headers },
});
