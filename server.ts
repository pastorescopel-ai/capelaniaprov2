import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { setupApiRoutes } from "./src/server/routes/api.js";

let _filename: string;
let _dirname: string;

if (typeof __filename !== 'undefined') {
  _filename = __filename;
  _dirname = __dirname;
} else {
  _filename = fileURLToPath(import.meta.url);
  _dirname = path.dirname(_filename);
}

const app = express();

const getConfig = () => ({
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
  supabaseKey: process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY || "",
});

// Middleware Global (Deve vir ANTES das rotas)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar rotas de API imediatamente e de forma síncrona
// Isso garante que o Vercel encontre as rotas assim que importar o 'app'
setupApiRoutes(app, getConfig, _dirname);

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware do Vite para desenvolvimento (Assíncrono)
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(async (req, res, next) => {
      if (req.url === '/' || req.url.endsWith('.html')) {
        try {
          let html = fs.readFileSync(path.join(_dirname, "index.html"), "utf-8");
          html = await vite.transformIndexHtml(req.url, html);
          
          const config = getConfig();
          const injection = `<script>
            window.__SUPABASE_CONFIG__ = ${JSON.stringify(config)};
          </script>`;
          html = html.replace(/<!--\s*CONFIG_INJECTION\s*-->/, injection);
          
          return res.status(200).set({ "Content-Type": "text/html" }).end(html);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      } else {
        vite.middlewares(req, res, next);
      }
    });
  } else {
    // Servir arquivos estáticos em produção
    app.use(express.static(_dirname, { index: false }));
    
    app.get("*all", (req, res) => {
      try {
        const indexPath = path.join(_dirname, "index.html");
        if (fs.existsSync(indexPath)) {
          const html = fs.readFileSync(indexPath, "utf-8");
          const config = getConfig();
          const injection = `<script>
            window.__SUPABASE_CONFIG__ = ${JSON.stringify(config)};
          </script>`;
          const replaced = html.replace(/<!--\s*CONFIG_INJECTION\s*-->/, injection);
          if (replaced === html) {
            console.warn("⚠️ CONFIG_INJECTION placeholder not found in production index.html");
          }
          res.status(200).set({ "Content-Type": "text/html" }).end(replaced);
        } else {
          res.status(404).send("Index not found");
        }
      } catch (e) {
        res.status(500).send("Erro ao carregar index.html");
      }
    });
  }

  // Apenas inicia o listen se não estiver sendo importado como módulo (Vercel/Cloud Run)
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
