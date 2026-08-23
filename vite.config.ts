import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Só existe em produção como função serverless da Vercel (api/verify-turnstile.ts) -- o
// `npm run dev` (Vite puro) não sabe servir rotas /api/*, então mesmo com o domínio "localhost"
// liberado no painel do Cloudflare (o widget passa a aparecer/resolver normalmente), o passo
// seguinte -- o POST pro back-end validar o token -- caía em 404 e o login continuava travado.
// Esse plugin só roda em `vite dev` (nunca no build/produção, que usa a função real da Vercel)
// e replica a mesma chamada ao endpoint siteverify do Cloudflare, usando a mesma
// TURNSTILE_SECRET_KEY do .env.local.
function turnstileDevProxy(secretKey: string | undefined): Plugin {
  return {
    name: 'turnstile-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/verify-turnstile', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
          return;
        }
        if (!secretKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: 'TURNSTILE_SECRET_KEY não configurada no .env.local' }));
          return;
        }

        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', async () => {
          try {
            const { token } = raw ? JSON.parse(raw) : {};
            if (!token) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Token ausente.' }));
              return;
            }

            const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ secret: secretKey, response: token }),
            });
            const data = await verifyRes.json();

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = data.success ? 200 : 400;
            res.end(JSON.stringify({ success: !!data.success, error: data.success ? undefined : 'Verificação falhou.' }));
          } catch (err) {
            console.error('[turnstile-dev-proxy] Erro ao verificar token:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: 'Erro ao verificar token.' }));
          }
        });
      });
    }
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
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
      }),
      ...(command === 'serve' ? [turnstileDevProxy(env.TURNSTILE_SECRET_KEY)] : [])
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
  };
});
