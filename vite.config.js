import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";
import { execSync } from 'node:child_process'

// Fecha y commit del build: Ajustes → Versión los muestra para confirmar en el
// iPhone que llegó el deploy nuevo (la PWA puede seguir con la versión vieja).
const commit = (() => {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim()
    const dirty = execSync('git status --porcelain --untracked-files=no').toString().trim() !== ''
    return dirty ? `${sha}+cambios` : sha
  } catch { return 'sin git' }
})()

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify(commit),
  },
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
    manifest: {
      name: 'Gastos Familia',
      short_name: 'Gastos',
      description: 'Control de gastos y aportaciones de la familia',
      lang: 'es',
      theme_color: '#0d7a5f',
      background_color: '#0b1220',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      // Las llamadas a Supabase NO se cachean: el modo offline lo maneja
      // nuestra cola de sincronización en IndexedDB.
      navigateFallbackDenylist: [/^\/api/],
    },
  }), cloudflare()],
})