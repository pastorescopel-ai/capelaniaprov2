
import { ProStaff, Unit } from '../types';
import { normalizeString, cleanID } from './formatters';

export interface AuditResult {
  unit: Unit;
  dbCount: number;
  expectedCount: number;
  difference: number;
  duplicates: { name: string; ids: string[]; records: ProStaff[] }[];
  inactiveButMarkedActive: ProStaff[];
  potentialOutdated: ProStaff[];
}

export const auditStaffData = (
  unit: Unit,
  proStaff: ProStaff[],
  expectedCount: number
): AuditResult => {
  const unitStaff = proStaff.filter(s => s.unit === unit);
  
  // 1. Contagem Básica de Ativos
  // Consideramos ativos aqueles que não têm leftAt ou leftAt no futuro
  const now = Date.now();
  const activeStaff = unitStaff.filter(s => {
    const leftAt = s.leftAt ? (typeof s.leftAt === 'number' ? s.leftAt : new Date(s.leftAt).getTime()) : null;
    return s.active !== false && (!leftAt || leftAt > now);
  });

  // 2. Detecção de Duplicatas por Nome
  const nameMap = new Map<string, ProStaff[]>();
  activeStaff.forEach(s => {
    const norm = normalizeString(s.name);
    if (!nameMap.has(norm)) nameMap.set(norm, []);
    nameMap.get(norm)?.push(s);
  });

  const duplicates: { name: string; ids: string[]; records: ProStaff[] }[] = [];
  nameMap.forEach((records, name) => {
    if (records.length > 1) {
      duplicates.push({
        name: records[0].name,
        ids: records.map(r => String(r.id)),
        records
      });
    }
  });

  // 3. Registros Inativos que podem estar sendo contados
  // No dashboard, a lógica às vezes é permissiva com datas de migração
  const inactiveButMarkedActive = unitStaff.filter(s => s.active === false && !s.leftAt);

  return {
    unit,
    dbCount: activeStaff.length,
    expectedCount,
    difference: activeStaff.length - expectedCount,
    duplicates,
    inactiveButMarkedActive,
    potentialOutdated: activeStaff.filter(s => {
        // Se foi criado há muito tempo e não tem movimentação recente (exemplo hipotético)
        // Mas o critério principal é a diferença de contagem
        return false; 
    })
  };
};
