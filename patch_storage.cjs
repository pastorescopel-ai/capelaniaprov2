const fs = require('fs');
const file = 'src/services/dataRepository.ts';
let code = fs.readFileSync(file, 'utf8');

const replacement = `function safeSetLocalStorage(key: string, value: any, tableName: string) {
  try {
    const heavyTables = ['pro_history_records', 'pro_monthly_stats', 'staff_visits', 'bible_class_attendees', 'activity_schedules', 'daily_activity_reports'];
    
    // Não salvar tabelas pesadas no localStorage para evitar QuotaExceededError
    if (heavyTables.includes(tableName)) {
      MEMORY_CACHE[key] = value;
      return;
    }

    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (e: any) {
    MEMORY_CACHE[key] = value;
    
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      if (typeof window !== 'undefined' && !(window as any).__quotaExceededLogged) {
        (window as any).__quotaExceededLogged = true;
        console.info(
          \`[Capelania OS] ℹ️ Cota de armazenamento local offline do navegador excedida (~5MB atingidos). \` +
          \`Os dados excedentes de tabelas históricas de auditoria foram direcionados ao cache de memória temporária com sucesso.\`
        );
      }
    } else {
      console.warn(\`[DataRepository] Falha ao salvar cache para \${tableName}:\`, e);
    }
  }
}`;

code = code.replace(/function safeSetLocalStorage[\s\S]*?\}\s*\}/, replacement);
fs.writeFileSync(file, code);
