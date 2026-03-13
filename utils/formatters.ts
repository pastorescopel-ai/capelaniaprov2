
/**
 * NUCLEO_LOGICO V4.0
 * Motor central de utilidades para garantir integridade de dados e consistência visual.
 */

/**
 * Limpa matrículas e IDs de PGs removendo prefixos (HAB/HABA/A) e caracteres não numéricos.
 * Essencial para unificação de registros vindos de diferentes fontes (Excel vs Form).
 */
export const cleanID = (val: any): string => {
  if (val === undefined || val === null) return "";
  let str = String(val).trim().toUpperCase();
  
  // 1. Remove prefixos conhecidos (HAB-, HABA-, A-)
  str = str.replace(/^(HAB|HABA|A)[-\s]*/i, '');
  
  // 2. Se for puramente numérico, remove zeros à esquerda para unificar "0123" e "123"
  // Mas mantém pelo menos um dígito se for "0"
  if (/^\d+$/.test(str)) {
    return str.replace(/^0+(?!$)/, '');
  }
  
  // 3. Se for alfanumérico, remove apenas caracteres especiais (espaços, barras, traços)
  // Mantendo letras e números para evitar colisões indevidas (ex: M123 vs F123)
  return str.replace(/[^A-Z0-9]/g, '');
};

/**
 * Formata números para o padrão WhatsApp Brasil (XX) XXXXX-XXXX.
 */
export const formatWhatsApp = (value: string) => {
  const nums = String(value || "").replace(/\D/g, "");
  if (nums.length === 0) return "";
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`;
};

/**
 * Retorna o primeiro dia do mês em formato ISO (YYYY-MM-DD) de forma segura para o fuso horário local.
 */
export const getMonthStartISO = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = firstDay.getTimezoneOffset() * 60000;
  return new Date(firstDay.getTime() - offset).toISOString().split('T')[0];
};

/**
 * Normaliza datas para armazenamento no banco de dados.
 * Adiciona T12:00:00 para evitar que o fuso horário (UTC) altere o dia no banco (corrupção de data).
 */
export const toSafeDateISO = (dateStr: string): string => {
  if (!dateStr) return "";
  const base = dateStr.split('T')[0]; // Garante apenas YYYY-MM-DD
  return `${base}T12:00:00`;
};

/**
 * Formata data ISO para exibição amigável PT-BR (DD/MM/YYYY).
 */
export const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return "";
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const getFirstName = (fullName: string) => {
  if (!fullName) return "";
  return fullName.split(' ')[0];
};

export const resolveDynamicName = (val: string, list: string[] = []) => {
  if (!val || !val.includes('_')) return val;
  const prefix = val.split('_')[0] + '_';
  const currentMatch = list.find(item => item.startsWith(prefix));
  return currentMatch || val;
};

/**
 * Normaliza string para comparação: remove acentos, coloca em minúsculo e limpa espaços.
 */
export const normalizeString = (str: string) => {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

/**
 * Verifica se todos os tokens de busca estão presentes no texto alvo (independente da ordem).
 */
export const tokenMatch = (target: string, search: string): boolean => {
  const normTarget = normalizeString(target);
  const normSearch = normalizeString(search);
  if (!normSearch) return true;
  
  const searchTerms = normSearch.split(' ').filter(t => t.trim() !== '');
  return searchTerms.every(term => normTarget.includes(term));
};

/**
 * Calcula o 5º dia útil de um dado mês e ano.
 * Sábados (6) e Domingos (0) não são dias úteis.
 */
export const getFifthBusinessDay = (year: number, month: number): Date => {
  let businessDaysCount = 0;
  let currentDay = 1;
  let date = new Date(year, month, currentDay);

  while (businessDaysCount < 5) {
    date = new Date(year, month, currentDay);
    const dayOfWeek = date.getDay();
    
    // Se não for sábado (6) nem domingo (0), é dia útil
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDaysCount++;
    }
    
    if (businessDaysCount < 5) {
      currentDay++;
    }
  }

  // Retorna a data do 5º dia útil às 23:59:59 para cobrir todo o dia
  date.setHours(23, 59, 59, 999);
  return date;
};
