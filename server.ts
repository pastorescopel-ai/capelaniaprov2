import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

let _filename: string;
let _dirname: string;

if (typeof __filename !== 'undefined') {
  _filename = __filename;
  _dirname = __dirname;
} else {
  _filename = fileURLToPath(import.meta.url);
  _dirname = path.dirname(_filename);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Log de todas as requisições
  app.use((req, res, next) => {
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

  // API para diagnóstico robusto
  app.get("/api/diagnostics", async (req, res) => {
    const report = {
      timestamp: new Date().toISOString(),
      fileAnalysis: {
        unusedFiles: [] as { path: string; lastModified: string }[],
        totalFilesScanned: 0
      },
      connectionStatus: {
        supabase: false
      }
    };

    // 1. Simples verificação de conexão Supabase
    try {
      const config = getConfig();
      if (!config.supabaseUrl) throw new Error("URL não configurada");
      
      const response = await fetch(`${config.supabaseUrl}/rest/v1/pro_staff?select=id&limit=1`, {
        headers: {
          'apikey': config.supabaseKey,
          'Authorization': `Bearer ${config.supabaseKey}`
        }
      });
      report.connectionStatus.supabase = response.ok;
    } catch (e) {
      report.connectionStatus.supabase = false;
    }

    // 2. Análise de arquivos
    const srcDir = path.join(_dirname, "src");
    const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []): string[] => {
      const files = fs.readdirSync(dirPath);
      files.forEach(file => {
        if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
          arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
        } else {
          arrayOfFiles.push(path.join(dirPath, file));
        }
      });
      return arrayOfFiles;
    };

    const allFiles = getAllFiles(srcDir);
    report.fileAnalysis.totalFilesScanned = allFiles.length;

    // Verifica se cada arquivo é importado em outro lugar
    const allContent = allFiles.map(f => fs.readFileSync(f, 'utf-8')).join('\n');
    
    allFiles.forEach(file => {
      const fileName = path.basename(file, path.extname(file));
      // Ignora arquivos de teste ou arquivos especiais
      if (file.includes('.test.') || file.includes('.spec.')) return;
      
      // Verifica se o nome do arquivo aparece em outro arquivo
      const regex = new RegExp(fileName, 'g');
      const matches = (allContent.match(regex) || []).length;
      
      // Se aparecer apenas uma vez (nele mesmo), pode estar órfão
      if (matches <= 1) {
        const stats = fs.statSync(file);
        report.fileAnalysis.unusedFiles.push({
          path: path.relative(srcDir, file),
          lastModified: stats.mtime.toISOString()
        });
      }
    });

    res.json(report);
  });

  // API para deletar arquivo
  app.post("/api/delete-file", express.json(), async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: "Caminho do arquivo necessário" });
    
    const fullPath = path.join(_dirname, "src", filePath);
    
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Arquivo não encontrado" });
      }
    } catch (e) {
      res.status(500).json({ error: "Erro ao deletar arquivo" });
    }
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
