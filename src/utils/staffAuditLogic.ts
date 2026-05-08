
import { ProStaff, Unit } from '../types';
import { normalizeString, cleanID } from './formatters';

export interface AuditResult {
  unit: Unit;
  dbCount: number;
  expectedCount: number;
  difference: number;
  duplicates: { name: string; ids: string[]; records: ProStaff[] }[];
  crossUnitDuplicates: { id: string; name: string; units: string[] }[];
  futureRecords: ProStaff[];
  inactiveButMarkedActive: ProStaff[];
}

export const auditStaffData = (
  unit: Unit,
  proStaff: ProStaff[],
  expectedCount: number
): AuditResult => {
  const allStaff = proStaff;
  const unitStaff = allStaff.filter(s => s.unit === unit);
  
  const now = Date.now();
  const activeUnitStaff = unitStaff.filter(s => {
    const leftAt = s.leftAt ? (typeof s.leftAt === 'number' ? s.leftAt : new Date(s.leftAt).getTime()) : null;
    return s.active === true && (!leftAt || leftAt > now);
  });

  // 1. Duplicatas por Nome (In-Unit)
  const nameMap = new Map<string, ProStaff[]>();
  activeUnitStaff.forEach(s => {
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

  // 2. Duplicatas de ID entre Unidades (Pessoa transferida mas ativa em ambas)
  const idCrossMap = new Map<string, Set<string>>();
  const idNameMap = new Map<string, string>();
  
  allStaff.forEach(s => {
    if (s.active !== false) {
      const cid = cleanID(s.id);
      if (!idCrossMap.has(cid)) idCrossMap.set(cid, new Set());
      idCrossMap.get(cid)?.add(s.unit || 'Sem Unidade');
      idNameMap.set(cid, s.name);
    }
  });

  const crossUnitDuplicates: { id: string; name: string; units: string[] }[] = [];
  idCrossMap.forEach((units, id) => {
    if (units.size > 1 && units.has(unit)) {
      crossUnitDuplicates.push({
        id,
        name: idNameMap.get(id) || 'N/A',
        units: Array.from(units)
      });
    }
  });

  // 3. Registros de "Futuro" ou Criados após Abril mas aparecendo (Cálculo de competitência)
  // Baseando em Abril/2026 como limite
  const aprilEnd = new Date('2026-04-30T23:59:59Z').getTime();
  const futureRecords = activeUnitStaff.filter(s => {
    const created = s.createdAt ? new Date(s.createdAt).getTime() : 0;
    return created > aprilEnd && created < now;
  });

  return {
    unit,
    dbCount: activeUnitStaff.length,
    expectedCount,
    difference: activeUnitStaff.length - expectedCount,
    duplicates,
    crossUnitDuplicates,
    futureRecords,
    inactiveButMarkedActive: unitStaff.filter(s => s.active === false && !s.leftAt)
  };
};
