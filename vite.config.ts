import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: './',
  plugins: [
    react(),
    VitePWA({
      // Trocado de 'generateSW' (automático) para 'injectManifest' -- precisa de um service
      // worker escrito à mão (src/sw.ts) pra poder reagir a notificações push (lembrete
      // diário). O cache de fontes/ícones que antes ficava aqui em `workbox:` foi movido pra
      // dentro do próprio src/sw.ts.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg}']
      },
      registerType: 'autoUpdate',
      includeAssets: [], // Removido para evitar 404 em arquivos que são Data URI no HTML
      manifest: {
        name: "Capelania Pro",
        // short_name é o texto que aparece embaixo do ícone na tela inicial do Android
        // (iOS já usa "Capelania Pro" via <meta name="apple-mobile-web-app-title"> no
        // index.html) -- estava "Capelania", sem o "Pro".
        short_name: "Capelania Pro",
        description: "Sistema Profissional de Capelania Hospitalar - HAB/HABA",
        theme_color: "#005a9c",
        background_color: "#f1f5f9",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        // Ícone do app instalado (tela inicial/launcher) = logo do Hospital Adventista de
        // Belém, gerado a partir de public/logo_hospital.png. purpose "any" (não "maskable")
        // porque o logo não foi desenhado com a margem de segurança que o recorte adaptativo
        // do Android exige -- como "maskable" ele ficaria cortado nas bordas.
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-utils': ['xlsx', 'jszip'],
          'vendor-pdf': ['jspdf', 'html2canvas'],
          'vendor-charts': ['recharts'],
          'vendor-db': ['@supabase/supabase-js']
        }
      }
    }
  },
  server: {
    port: 3000,
  }
});