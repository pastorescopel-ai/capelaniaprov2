import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("DEBUG: NODE_ENV =", process.env.NODE_ENV);
  const app = express();
  const PORT = 3000;

  // Log de todas as requisições
  app.use((req, res, next) => {
    console.log(`DEBUG: Request received: ${req.url}`);
    next();
  });

  const getConfig = () => ({
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    supabaseKey: process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY || "",
  });

  // API para fornecer as chaves do Supabase dinamicamente
  app.get("/api/config", (req, res) => {
    res.json(getConfig());
  });

  // API para debug
  app.get("/api/debug", (req, res) => {
    res.json({
      hasUrl: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
      hasKey: !!(process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY),
      envKeys: Object.keys(process.env).filter(k => k.includes("SUPABASE")),
    });
  });

  // Middleware do Vite para desenvolvimento
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(async (req, res, next) => {
      if (req.url === '/' || req.url.endsWith('.html')) {
        try {
          let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");
          html = await vite.transformIndexHtml(req.url, html);
          
          const config = getConfig();
          const injection = `<script>
            window.__SUPABASE_CONFIG__ = ${JSON.stringify(config)};
            console.log("DEBUG: Injected Supabase Config:", {
              hasUrl: !!config.supabaseUrl,
              hasKey: !!config.supabaseKey,
              urlLength: config.supabaseUrl?.length,
              keyLength: config.supabaseKey?.length
            });
          </script>`;
          html = html.replace(/<!--\s*CONFIG_INJECTION\s*-->/, injection);
          
          console.log("DEBUG: HTML being sent to browser (first 500 chars):", html.substring(0, 500));
          
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
    app.use(express.static(path.join(__dirname, "dist"), { index: false }));
    
    app.get("*", (req, res) => {
      try {
        const indexPath = path.join(__dirname, "dist", "index.html");
        if (fs.existsSync(indexPath)) {
          let html = fs.readFileSync(indexPath, "utf-8");
          const config = getConfig();
          const injection = `<script>
            window.__SUPABASE_CONFIG__ = ${JSON.stringify(config)};
            console.log("DEBUG PROD: Injected Supabase Config:", {
              hasUrl: !!config.supabaseUrl,
              hasKey: !!config.supabaseKey
            });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    if (!process.env.VITE_SUPABASE_URL && !process.env.SUPABASE_URL) {
      console.warn("⚠️ AVISO: VITE_SUPABASE_URL não encontrada no ambiente do servidor!");
    }
    if (!process.env.VITE_SUPABASE_KEY && !process.env.SUPABASE_KEY) {
      console.warn("⚠️ AVISO: VITE_SUPABASE_KEY não encontrada no ambiente do servidor!");
    }
  });
}

startServer();
