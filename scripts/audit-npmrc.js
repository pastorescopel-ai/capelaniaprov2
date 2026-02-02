
const fs = require('fs');
const path = require('path');

const npmrcPath = path.resolve(process.cwd(), '.npmrc');

console.log("🔍 Iniciando auditoria de integridade do .npmrc...");

try {
  if (fs.existsSync(npmrcPath)) {
    const buffer = fs.readFileSync(npmrcPath);
    
    // Verificação 1: Detecção de BOM (Byte Order Mark)
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        throw new Error("BOM (Byte Order Mark) detectado. O arquivo deve ser UTF-8 sem BOM.");
    }

    // Verificação 2: Caracteres de controle e não-ASCII
    for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
        // Permitir: Tab (9), New Line (10), Carriage Return (13), e caracteres imprimíveis (32-126)
        if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte > 126) {
             throw new Error(`Caractere binário ou inválido detectado na posição ${i} (código ${byte}).`);
        }
    }
    
    console.log("✅ SUCESSO: .npmrc está limpo e compatível com ASCII/UTF-8.");
  } else {
    console.log("ℹ️ INFO: Arquivo .npmrc não encontrado. Ambiente limpo.");
  }
} catch (e) {
  console.error("❌ FALHA CRÍTICA: O arquivo .npmrc está corrompido.");
  console.error(`Erro: ${e.message}`);
  console.error("Ação necessária: O arquivo deve ser deletado e recriado como texto puro (ASCII).");
  process.exit(1);
}
