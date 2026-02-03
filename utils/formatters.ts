
export const formatWhatsApp = (value: string) => {
  const nums = String(value || "").replace(/\D/g, "");
  if (nums.length === 0) return "";
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`;
};

export const getFirstName = (fullName: string) => {
  if (!fullName) return "";
  const parts = fullName.split(' ');
  return parts[0];
};

export const resolveDynamicName = (val: string, list: string[] = []) => {
  if (!val || !val.includes('_')) return val;
  const prefix = val.split('_')[0] + '_';
  const currentMatch = list.find(item => item.startsWith(prefix));
  return currentMatch || val;
};

export const getWeekRangeLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const fmt = (date: Date) => date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `Semana de ${fmt(monday)} a ${fmt(sunday)}`;
};
