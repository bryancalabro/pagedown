import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        clientsClaim: true,
        navigateFallback: '/index.html',
        // the fetch function is live data: never answered from the worker's cache
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, url }) => sameOrigin && !url.pathname.startsWith('/api/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'pagedown-runtime', matchOptions: { ignoreVary: true } },
          },
        ],
      },
    }),
  ],
  define: {
    // baked at build time so the footer never drifts from package.json
    __APP_VERSION__: JSON.stringify(`v${pkg.version}`),
  },
  test: {
    exclude: ['node_modules/**', 'e2e/**'],
  },
})
