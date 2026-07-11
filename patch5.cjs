const fs = require('fs');
let code = fs.readFileSync('src/services/dataRepository.ts', 'utf8');

const regex = /async syncAll\(\) \{[\s\S]*?return \{[\s\S]*?\};\n    \} catch \(error\) \{\n      console.error\("Erro fatal ao sincronizar com Supabase:", error\);\n      return null;\n    \}\n  \},/;

const newSyncAll = `async syncAll() {
    try {
      const core = await this.syncCore();
      const bg = await this.syncBackground();
      if (!core && !bg) return null;
      return { ...(core || {}), ...(bg || {}) };
    } catch (e) {
      console.error("Erro fatal ao sincronizar com Supabase:", e);
      return null;
    }
  },`;

code = code.replace(regex, newSyncAll);
fs.writeFileSync('src/services/dataRepository.ts', code);
