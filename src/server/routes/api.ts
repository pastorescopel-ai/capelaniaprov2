import express, { Express } from "express";
import fs from "fs";
import path from "path";
import { logger } from "../../utils/logger.js";

export function setupApiRoutes(app: Express, getConfig: () => { supabaseUrl: string; supabaseKey: string }, _dirname: string) {
  // API para fornecer as chaves do Supabase dinamicamente
  app.get("/api/config", (req, res) => {
    const config = {
      ...getConfig()
    };
    res.json(config);
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API para diagnóstico robusto
  app.get("/api/diagnostics", async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: "Forbidden" });
    }
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
  app.post("/api/delete-file", async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: "Caminho do arquivo necessário" });
    
    const fullPath = path.join(_dirname, "src", filePath);
    
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        logger.info(`Arquivo deletado: ${filePath}`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Arquivo não encontrado" });
      }
    } catch (e) {
      logger.error(`Erro ao deletar arquivo: ${filePath}`, e);
      res.status(500).json({ error: "Erro ao deletar arquivo" });
    }
  });
}
