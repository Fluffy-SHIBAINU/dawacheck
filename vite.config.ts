import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: ['icons/*.png'],
  manifest: {
    name: 'DawaCheck',
    short_name: 'DawaCheck',
    description: 'Check a medicine against the NAFDAC register with no internet.',
    theme_color: '#0B6E4F',
    background_color: '#F6F9F7',
    display: 'standalone',
    start_url: './',
    scope: './',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2,json,mp3,wasm,gz}'],
    maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
  },
});

export default defineConfig({
  plugins: process.env.VITEST ? [react()] : [react(), pwa],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/scripts/**/*.test.ts'],
  },
});
