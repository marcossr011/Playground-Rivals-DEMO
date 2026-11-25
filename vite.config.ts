import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const serverUrl = env.VITE_SERVER_URL ?? process.env.VITE_SERVER_URL;
  if (mode === 'mobile' && !serverUrl) {
    throw new Error(
      'Falta VITE_SERVER_URL para la app nativa. Copia .env.mobile.example a .env.mobile y pon la URL HTTPS de tu servidor de salas.'
    );
  }

  return {
    plugins: [
      react(),
      VitePWA({
        disable: mode === 'mobile',
        registerType: 'autoUpdate',
        includeAssets: ['recreo-mark.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'],
        manifest: {
          name: 'Recreo — juega en el móvil y en la calle',
          short_name: 'Recreo',
          description: 'Más de 1000 juegos: solitarios, con amigos, salas online y juegos para la vida real.',
          lang: 'es',
          dir: 'ltr',
          theme_color: '#0B0D16',
          background_color: '#0B0D16',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          categories: ['games', 'entertainment', 'lifestyle'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/socket\.io/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'map-tiles',
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 }
              }
            }
          ]
        },
        devOptions: { enabled: false }
      })
    ],
    server: {
      port: 5173,
      proxy: {
        '/socket.io': {
          target: 'http://localhost:3001',
          ws: true,
          changeOrigin: true
        },
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});
