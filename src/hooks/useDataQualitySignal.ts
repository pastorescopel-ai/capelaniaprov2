
import { useMemo } from 'react';
import { normalizeString } from '../utils/formatters';
import { Unit } from '../types/enums';

// Sinal leve pra decidir se o item "Auditoria de Qualidade" aparece no menu -- não é uma
// reimplementação completa da auditoria (que vive em useHealerCalculations.ts, com todas as
// regras finas de exceção). É uma versão simplificada e propositalmente mais sensível: prefere
// dar falso positivo (mostrar o menu quando na real já está tudo certo) a dar falso negativo
// (esconder o menu com um problema real ainda não visto por ninguém). Quem quiser o resultado
// preciso, com todas as exceções, sempre pode abrir a aba -- ela é que manda de verdade.
//
// Memoizado só nos arrays de dados brutos (sem depender de busca, unidade selecionada ou itens
// já dispensados na tela de auditoria), pra não recalcular a cada troca de aba do app.
export const useDataQualitySignal = (appData: any) => {
  const {
    bibleStudies = [], bibleClasses = [], staffVisits = [], smallGroups = [], visitRequests = [],
    proStaff = [], proPatients = [], proProviders = [], proSectors = [], proGroups = [],
    proGroupMembers = [], proGroupProviderMembers = []
  } = appData;

  const hasQualityIssues = useMemo(() => {
    for (const unit of [Unit.HAB, Unit.HABA]) {
      const staffInUnit = proStaff.filter((s: any) => s.unit === unit);
      const officialNames = new Set([
        ...staffInUnit.map((s: any) => normalizeString(s.name)),
        ...proPatients.filter((p: any) => p.unit === unit).map((p: any) => normalizeString(p.name)),
        ...proProviders.filter((p: any) => p.unit === unit).map((p: any) => normalizeString(p.name)),
      ]);

      const isOrphanName = (raw: string | null | undefined) => {
        const trimmed = raw?.trim();
        if (!trimmed) return false;
        // "Nome (123)" já está vinculado por ID ao cadastro oficial -- não é órfão mesmo que o
        // texto do nome tenha ficado levemente diferente do cadastro atual (mesma exceção que
        // a auditoria completa aplica em useHealerCalculations.ts).
        if (trimmed.match(/\((\d+)\)$/)) return false;
        const clean = trimmed.split(' (')[0].trim();
        return !!clean && !officialNames.has(normalizeString(clean));
      };

      const namesToCheck: (string | null | undefined)[] = [
        ...bibleClasses.filter((c: any) => c.unit === unit).flatMap((c: any) => c.students || []),
        ...bibleStudies.filter((s: any) => s.unit === unit).map((s: any) => s.name),
        ...staffVisits.filter((v: any) => v.unit === unit).map((v: any) => v.staffName),
        ...smallGroups.filter((g: any) => g.unit === unit).map((g: any) => g.leader),
        ...visitRequests.filter((v: any) => v.unit === unit).map((v: any) => v.leaderName),
        ...proGroups.filter((g: any) => g.unit === unit).flatMap((g: any) => [g.currentLeader, g.leader]),
      ];
      if (namesToCheck.some(isOrphanName)) return true;

      // Setor referenciado por ID que não existe mais no cadastro oficial da unidade.
      const officialSectorIds = new Set(proSectors.filter((s: any) => s.unit === unit).map((s: any) => String(s.id)));
      const sectorIdsToCheck: (string | number | null | undefined)[] = [
        ...bibleStudies.filter((s: any) => s.unit === unit).map((s: any) => s.sectorId),
        ...staffVisits.filter((v: any) => v.unit === unit).map((v: any) => v.sectorId),
        ...smallGroups.filter((g: any) => g.unit === unit).map((g: any) => g.sectorId),
        ...bibleClasses.filter((c: any) => c.unit === unit).map((c: any) => c.sectorId),
        ...visitRequests.filter((v: any) => v.unit === unit).map((v: any) => v.sectorId),
        ...proGroups.filter((g: any) => g.unit === unit).map((g: any) => g.sectorId),
      ];
      if (sectorIdsToCheck.some(id => id != null && !officialSectorIds.has(String(id)))) return true;

      // PGs duplicados (mesmo nome normalizado, ativos, na mesma unidade).
      const pgNameCounts = new Map<string, number>();
      proGroups.filter((g: any) => g.unit === unit && g.active !== false).forEach((g: any) => {
        const norm = normalizeString(g.name);
        pgNameCounts.set(norm, (pgNameCounts.get(norm) || 0) + 1);
      });
      if ([...pgNameCounts.values()].some(count => count > 1)) return true;

      // Matrículas duplicadas (mesmo colaborador/prestador em mais de um PG ativo ao mesmo tempo).
      const staffIdsInUnit = new Set(staffInUnit.map((s: any) => String(s.id)));
      const activeMembershipCounts = new Map<string, number>();
      proGroupMembers.forEach((m: any) => {
        if (m.leftAt || m.isError) return;
        const sid = String(m.staffId);
        if (!staffIdsInUnit.has(sid)) return;
        activeMembershipCounts.set(sid, (activeMembershipCounts.get(sid) || 0) + 1);
      });
      if ([...activeMembershipCounts.values()].some(count => count > 1)) return true;

      const providerIdsInUnit = new Set(proProviders.filter((p: any) => p.unit === unit).map((p: any) => String(p.id)));
      const activeProviderMembershipCounts = new Map<string, number>();
      proGroupProviderMembers.forEach((m: any) => {
        if (m.leftAt || m.isError) return;
        const pid = String(m.providerId);
        if (!providerIdsInUnit.has(pid)) return;
        activeProviderMembershipCounts.set(pid, (activeProviderMembershipCounts.get(pid) || 0) + 1);
      });
      if ([...activeProviderMembershipCounts.values()].some(count => count > 1)) return true;
    }

    return false;
  }, [
    bibleStudies, bibleClasses, staffVisits, smallGroups, visitRequests,
    proStaff, proPatients, proProviders, proSectors, proGroups, proGroupMembers, proGroupProviderMembers
  ]);

  return { hasQualityIssues };
};
