import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }

// `npm run dev` answers /api/fetch with the same handler vercel runs, so the app works locally
function devApi(): Plugin {
  return {
    name: 'pagedown-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/fetch', async (req, res) => {
        const { handle } = (await server.ssrLoadModule('/server/handle.ts')) as typeof import('./server/handle')
        const response = await handle(new Request(new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost'), { method: req.method }))
        res.statusCode = response.status
        response.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(await response.text())
      })
    },
  }
}

export default defineConfig({
  plugins: [
    devApi(),
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
