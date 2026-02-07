
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
  // Remove prefixos conhecidos e qualquer caractere que não seja número
  return str.replace(/^(HAB|HABA|A)[-\s]*/i, '').replace(/\D/g, '').trim();
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
