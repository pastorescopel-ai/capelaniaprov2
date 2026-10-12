import { normalizeString } from './formatters';

interface StaffLike { id: string | number; name: string; unit: string; active?: boolean }

const cleanId = (id: string | number) => String(id).split('-').pop() || String(id);

// Devolve um detector de "colaborador inativo" (desligado, férias ou afastado: fora da última
// lista importada) pra esconder nome na lista de chamada e na busca de formulários NOVOS.
// Aceita o texto "Nome (ID)" ou só o nome. Quem não é colaborador cadastrado (paciente,
// prestador, nome digitado à mão) nunca é considerado inativo. O histórico dos formulários
// passados não passa por aqui, então segue intacto.
export const buildInactiveStaffDetector = (proStaff: StaffLike[], unit: string) => {
  const byId = new Map<string, boolean>();
  const activeNames = new Set<string>();
  const inactiveNames = new Set<string>();
  proStaff.forEach(s => {
    if (s.unit !== unit) return;
    const active = s.active !== false;
    byId.set(cleanId(s.id), active);
    (active ? activeNames : inactiveNames).add(normalizeString(s.name));
  });
  return (raw: string): boolean => {
    if (!raw) return false;
    const m = raw.match(/\((\d+)\)\s*$/);
    if (m && byId.has(m[1])) return byId.get(m[1]) === false;
    const name = normalizeString(raw.split(' (')[0].trim());
    return inactiveNames.has(name) && !activeNames.has(name);
  };
};
