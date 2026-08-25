import { useState, useMemo, useEffect, useRef } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Unit, RecordStatus, Config, ActivityFilter } from '../types';
import { useReportLogic } from './useReportLogic';
import { resolveDynamicName, normalizeString, countUniqueClasses, countUniqueStudents, getStudentKey } from '../utils/formatters';
import { generateExecutiveHTML } from '../utils/pdfTemplates';
import { useDocumentGenerator } from './useDocumentGenerator';
import { usePro } from '../contexts/ProContext';
import { getBrandedHeaderByProfile } from '../utils/reportTemplates';
import { supabase } from '../services/supabaseClient';
import { toCamel } from '../utils/transformers';

// A sincronização geral do app só mantém as presenças de classes bíblicas (bible_class_attendees)
// dos últimos ~45 dias em memória (ver dataRepository.ts syncBackground). Quando o relatório usa
// um período mais antigo que isso, buscamos as presenças daquele período direto do banco aqui,
// sem mexer no cache global do app, para não perder alunos de classes mais antigas.
const SYNC_WINDOW_DAYS = 45;

// Alunos de verdade (bible_class_attendees) e adventistas (bible_class_adventists) vivem em
// tabelas separadas de propósito -- busca as duas pro mesmo período.
const fetchRowsForRange = async (tableName: 'bible_class_attendees' | 'bible_class_adventists', startDate: string, endDate: string): Promise<any[]> => {
  if (!supabase) return [];
  const allRows: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .range(from, from + step - 1);

    if (error) {
      console.error(`[useReports] Erro ao buscar ${tableName} sob demanda:`, error);
      break;
    }
    if (!data || data.length === 0) { hasMore = false; break; }
    allRows.push(...data);
    if (data.length < step) hasMore = false;
    else from += step;
  }

  return toCamel(allRows);
};

interface UseReportsProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  users: User[];
  config: Config;
}

export const useReports = ({ studies, classes, groups, visits, users, config }: UseReportsProps) => {
  const { generatePdf, generateExcel, isGenerating } = useDocumentGenerator();
  const { proGroups, proGroupMembers, proStaff, proSectors, proProviders, proGroupProviderMembers, proMonthlyStats, proHistoryRecords } = usePro();
  
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const getStartOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  };

  const [filters, setFilters] = useState({
    startDate: getStartOfMonth(),
    endDate: new Date().toISOString().split('T')[0],
    selectedChaplain: 'all', 
    selectedUnit: 'all', 
    selectedActivity: ActivityFilter.TODAS, 
    selectedStatus: 'all', 
    selectedPG: 'all'
  });

  // --- BUSCA SOB DEMANDA DE PRESENÇAS ANTIGAS ---
  // Se o período do relatório começa antes da janela de sincronização (45 dias), as presenças
  // das classes bíblicas mais antigas não estão carregadas no app — busca direto do banco.
  const [extendedAttendeesByClass, setExtendedAttendeesByClass] = useState<Map<string, any[]> | null>(null);
  const [extendedAdventistsByClass, setExtendedAdventistsByClass] = useState<Map<string, any[]> | null>(null);
  const [isLoadingHistoricalAttendees, setIsLoadingHistoricalAttendees] = useState(false);
  const fetchRequestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++fetchRequestIdRef.current;

    const run = async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - SYNC_WINDOW_DAYS);
      const cutoffISO = cutoff.toISOString().split('T')[0];

      if (filters.startDate >= cutoffISO) {
        // Período inteiro já dentro da janela sincronizada — usa os dados já carregados.
        if (requestId !== fetchRequestIdRef.current) return;
        setExtendedAttendeesByClass(null);
        setExtendedAdventistsByClass(null);
        setIsLoadingHistoricalAttendees(false);
        return;
      }

      setIsLoadingHistoricalAttendees(true);
      const [studentRows, adventistRows] = await Promise.all([
        fetchRowsForRange('bible_class_attendees', filters.startDate, filters.endDate),
        fetchRowsForRange('bible_class_adventists', filters.startDate, filters.endDate),
      ]);
      if (requestId !== fetchRequestIdRef.current) return; // filtro mudou antes da resposta chegar

      const groupByClass = (rows: any[]) => {
        const byClass = new Map<string, any[]>();
        rows.forEach(row => {
          const list = byClass.get(row.classId) || [];
          list.push(row);
          byClass.set(row.classId, list);
        });
        return byClass;
      };
      setExtendedAttendeesByClass(groupByClass(studentRows));
      setExtendedAdventistsByClass(groupByClass(adventistRows));
      setIsLoadingHistoricalAttendees(false);
    };

    run();
  }, [filters.startDate, filters.endDate]);

  // Reconstrói o roster (students) das classes usando as presenças buscadas sob demanda,
  // quando disponíveis, em vez do students já sintetizado (que pode estar incompleto).
  const effectiveClasses = useMemo(() => {
    if (!extendedAttendeesByClass) return classes;
    const nameFor = (a: any) => {
      const id = a.staffId || a.participantId;
      if (id && !String(a.studentName).includes(`(${id})`)) {
        return `${a.studentName} (${id})`;
      }
      return a.studentName;
    };
    return classes.map(cls => {
      const attendees = extendedAttendeesByClass.get(cls.id) || [];
      const adventistRows = extendedAdventistsByClass?.get(cls.id) || [];
      return { ...cls, students: attendees.map(nameFor), adventistStudents: adventistRows.map(nameFor) };
    });
  }, [classes, extendedAttendeesByClass, extendedAdventistsByClass]);

  const { filteredData, auditList, totalStats: liveStats } = useReportLogic(studies, effectiveClasses, groups, visits, users, filters as any);
  const pColor = config.primaryColor || '#005a9c';

  // --- LÓGICA DE TRAVAMENTO DE DADOS (SNAPSHOTS) ---
  const finalStats = useMemo(() => {
    // 1. Verificar se o período é um mês cheio (ex: 2024-03-01 até 2024-03-31)
    const start = new Date(filters.startDate + 'T12:00:00');
    const end = new Date(filters.endDate + 'T12:00:00');
    
    const isFullMonth = start.getDate() === 1 && 
                       end.getDate() >= 28 && 
                       start.getMonth() === end.getMonth() && 
                       start.getFullYear() === end.getFullYear();

    if (isFullMonth) {
      const monthISO = filters.startDate;
      // Buscar snapshots de sumário para o mês. O fechamento (PGClosing.tsx) grava a foto
      // global do mês com type:'pg' + targetId:'all' (mesma tag que usePGMembership.ts usa
      // pra saber se o mês está fechado) — nunca existiu um type:'summary' de verdade, então
      // esse filtro sempre vinha vazio e o relatório de QUALQUER mês fechado caía, sem avisar,
      // pro cálculo ao vivo (dados de HOJE, não do mês do filtro — inclusive causando % de
      // adesão a PG impossíveis, tipo >100%, quando o quadro de colaboradores mudou desde
      // então). Ver `pro_monthly_stats_backfill_summary_...` para o backfill dos meses já
      // fechados sem os dados de `snapshot_data`.
      const snapshots = proMonthlyStats.filter(s => s.month === monthISO && s.type === 'pg' && s.targetId === 'all' && s.snapshotData);
      
      // Filtrar pela unidade selecionada
      const targetSnapshots = filters.selectedUnit === 'all' 
        ? snapshots 
        : snapshots.filter(s => s.unit === filters.selectedUnit);

      if (targetSnapshots.length > 0) {
        // Agregar dados dos snapshots (caso seja 'all units')
        const aggregated = targetSnapshots.reduce((acc, s) => {
          const metrics = s.snapshotData?.performanceMetrics;
          if (metrics) {
            acc.studies += metrics.totalBibleStudies || 0;
            acc.classes += metrics.totalBibleClasses || 0;
            acc.groups += metrics.totalSmallGroups || 0;
            acc.visits += metrics.totalStaffVisits || 0;
            acc.students += metrics.totalUniqueStudents || 0;
            acc.pgPercentages.push(metrics.pgPercentage || 0);
          }
          return acc;
        }, { studies: 0, classes: 0, groups: 0, visits: 0, students: 0, pgPercentages: [] as number[] });

        const avgPgPercentage = aggregated.pgPercentages.length > 0 
          ? aggregated.pgPercentages.reduce((a, b) => a + b, 0) / aggregated.pgPercentages.length 
          : 0;

        // Agregar estatísticas por capelão dos snapshots
        const aggregatedChaplainStatsMap = new Map<string, any>();
        targetSnapshots.forEach(s => {
          s.snapshotData?.performanceMetrics.chaplainStats?.forEach((cs: any) => {
            if (!aggregatedChaplainStatsMap.has(cs.userId)) {
              aggregatedChaplainStatsMap.set(cs.userId, { ...cs, hab: { total: 0, students: 0 }, haba: { total: 0, students: 0 } });
            }
            const entry = aggregatedChaplainStatsMap.get(cs.userId);
            if (s.unit === Unit.HAB) {
              entry.hab = { total: cs.total, students: cs.students, studies: cs.studies, classes: cs.classes, groups: cs.groups, visits: cs.visits };
            } else {
              entry.haba = { total: cs.total, students: cs.students, studies: cs.studies, classes: cs.classes, groups: cs.groups, visits: cs.visits };
            }
          });
        });

        const finalChaplainStats = Array.from(aggregatedChaplainStatsMap.values())
          .map(s => ({
            ...s,
            name: s.userName,
            user: users.find(u => u.id === s.userId) || { id: s.userId, name: s.userName },
            totalActions: (s.hab?.total || 0) + (s.haba?.total || 0),
            students: (s.hab?.students || 0) + (s.haba?.students || 0),
            maxVal: Math.max((s.hab?.total || 0) + (s.haba?.total || 0), 1)
          }))
          .filter(s => filters.selectedChaplain === 'all' || s.userId === filters.selectedChaplain)
          .sort((a, b) => b.totalActions - a.totalActions);

        return {
          stats: {
            ...liveStats,
            studies: aggregated.studies,
            classes: aggregated.classes,
            groups: aggregated.groups,
            visits: aggregated.visits,
            totalStudentsPeriod: aggregated.students,
            pgPercentage: avgPgPercentage,
            isLocked: true
          },
          chaplainStats: finalChaplainStats
        };
      }
    }

    // Se não for mês cheio ou não houver snapshot, usa liveStats + cálculo de PG atual
    const unitStaff = proStaff.filter(s => (filters.selectedUnit === 'all' || s.unit === filters.selectedUnit) && s.active !== false);
    const enrolledStaffIds = new Set(
      proGroupMembers
        .filter(m => {
            const staff = proStaff.find(s => String(s.id) === String(m.staffId));
            // O denominador (unitStaff) já exige "ativo" — sem essa mesma checagem aqui, um
            // colaborador desligado cuja matrícula de PG nunca foi fechada continua contando
            // como matriculado sem contar no total, o que já gerou % de adesão acima de 100%.
            return staff && staff.active !== false && (filters.selectedUnit === 'all' || staff.unit === filters.selectedUnit) && !m.leftAt;
        })
        .map(m => String(m.staffId))
    );
    const enrolledStaffCount = enrolledStaffIds.size;
    const currentPgPercentage = unitStaff.length > 0 ? (enrolledStaffCount / unitStaff.length) * 100 : 0;

    return {
      stats: {
        ...liveStats,
        pgPercentage: currentPgPercentage,
        isLocked: false
      },
      chaplainStats: null // Indica que deve usar o cálculo live
    };
  }, [filters.startDate, filters.endDate, filters.selectedUnit, filters.selectedChaplain, proMonthlyStats, liveStats, proStaff, proGroupMembers, users]);

  const totalStats = finalStats.stats;

  const chaplainStats = useMemo(() => {
    if (finalStats.chaplainStats) return finalStats.chaplainStats;

    return users.map(userObj => {
      const uid = userObj.id;
      const filterByUid = (list: any[]) => list.filter(i => i.userId === uid);
      const getUnitStats = (unit: Unit) => {
        const uS = filterByUid(filteredData.studies).filter(i => (i.unit || Unit.HAB) === unit);
        const uC = filterByUid(filteredData.classes).filter(i => (i.unit || Unit.HAB) === unit);
        const uG = filterByUid(filteredData.groups).filter(i => (i.unit || Unit.HAB) === unit);
        const uV = filterByUid(filteredData.visits).filter(i => (i.unit || Unit.HAB) === unit);
        const names = new Set<string>();
        uS.forEach(s => { const key = getStudentKey(s.name, (s as any).staffId || (s as any).participantId); if (key) names.add(key); });
        uC.forEach(c => {
          const adventistSet = new Set(c.adventistStudents || []);
          c.students?.forEach((n: any) => { if (adventistSet.has(n)) return; const key = getStudentKey(n); if (key) names.add(key); });
        });
        const uniqueClasses = countUniqueClasses(uC);
        // "studies" mostra alunos únicos (não sessões) -- "total" continua somando as sessões
        // brutas porque é usado como indicador de volume de trabalho (Vs. Média Equipe), não de
        // alcance de pessoas.
        return { students: names.size, studies: countUniqueStudents(uS), classes: uniqueClasses, groups: uG.length, visits: uV.length, total: uS.length + uniqueClasses + uG.length + uV.length };
      };
      const hab = getUnitStats(Unit.HAB);
      const haba = getUnitStats(Unit.HABA);
      return { user: userObj, name: userObj.name, totalActions: hab.total + haba.total, hab, haba, students: hab.students + haba.students, maxVal: Math.max(hab.total + haba.total, 1) };
    }).filter(s => filters.selectedChaplain === 'all' || s.user.id === filters.selectedChaplain)
      .filter(s => filters.selectedChaplain !== 'all' || s.totalActions > 0 || s.students > 0).sort((a, b) => b.totalActions - a.totalActions);
  }, [users, filteredData, filters.selectedChaplain, finalStats.chaplainStats]);

  const formatDate = (d: string) => d.split('T')[0].split('-').reverse().join('/');

  const handleExportExcel = () => {
    const studiesData = filteredData.studies.map(s => ({ Data: formatDate(s.date), Aluno: s.name, WhatsApp: s.whatsapp, Unidade: s.unit, Setor: s.sector, Guia: s.guide, Licao: s.lesson, Status: s.status, Capelao: users.find(u => u.id === s.userId)?.name }));
    generateExcel(studiesData, "Estudos", `Relatorio_Estudos_${filters.startDate}`);
  };

  const handleGenerateOfficialReport = async () => {
    setLoadingAction('official');
    let habTotal = 0, habaTotal = 0;
    chaplainStats.forEach(s => { habTotal += s.hab.total; habaTotal += s.haba.total; });
    
    const html = generateExecutiveHTML({
      config, filters, totalStats, chaplainStats, 
      unitTotals: { hab: habTotal, haba: habaTotal }, 
      pColor
    });
    
    await generatePdf(html);
    setLoadingAction(null);
  };

  const handleGeneratePGReport = async () => {
    setLoadingAction('pg_report');
    
    // Identificar se o período selecionado corresponde a um mês fechado (snapshot)
    // Usamos a data de início como referência para buscar o histórico
    const historyForPeriod = proHistoryRecords.filter(r => 
      r.month === filters.startDate && 
      (filters.selectedUnit === 'all' || r.unit === filters.selectedUnit)
    );

    const isUsingHistory = historyForPeriod.length > 0;

    const targetPGs = filters.selectedPG === 'all' 
      ? proGroups.filter(g => g.unit === filters.selectedUnit || filters.selectedUnit === 'all')
      : proGroups.filter(g => g.id === filters.selectedPG);

    targetPGs.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    let html = `<div style="background: #f1f5f9; padding: 20px;">`;

    for (const pg of targetPGs) {
      let membersList: any[] = [];

      if (isUsingHistory) {
        // Usar dados do histórico (Snapshot imutável)
        const historyMembers = historyForPeriod.filter(r => r.groupId === pg.id);
        membersList = historyMembers.map(r => ({
          name: r.staffName,
          sectorName: r.sectorName,
          isLeader: normalizeString(r.staffName || '') === normalizeString(pg.currentLeader || ''),
          type: 'Colaborador'
        }));
      } else {
        // Usar dados atuais (Mês aberto)
        const activeStaffMembers = proGroupMembers.filter(m => m.groupId === pg.id && !m.leftAt);
        const activeProviderMembers = proGroupProviderMembers.filter(m => m.groupId === pg.id && !m.leftAt);

        membersList = [
          ...activeStaffMembers.map(m => {
            const staff = proStaff.find(s => s.id === m.staffId);
            const sector = proSectors.find(s => s.id === staff?.sectorId);
            return {
              name: staff?.name || 'Desconhecido',
              sectorName: sector?.name || 'Sem Setor',
              isLeader: pg.leaderStaffId ? pg.leaderStaffId === staff?.id : normalizeString(staff?.name || '') === normalizeString(pg.currentLeader || ''),
              type: 'Colaborador'
            };
          }),
          ...activeProviderMembers.map(m => {
            const provider = proProviders.find(p => p.id === m.providerId);
            return {
              name: provider?.name || 'Desconhecido',
              sectorName: 'Prestador',
              isLeader: normalizeString(provider?.name || '') === normalizeString(pg.currentLeader || ''),
              type: 'Prestador'
            };
          })
        ];
      }

      membersList.sort((a, b) => {
        if (a.isLeader && !b.isLeader) return -1;
        if (!a.isLeader && b.isLeader) return 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

      const leaderName = pg.currentLeader || 'Sem Líder Definido';

      html += `
        <div class="pdf-page" style="width: 210mm; min-height: 297mm; padding: 15mm; background: white; box-sizing: border-box; font-family: sans-serif; position: relative; margin-bottom: 20px;">
          ${getBrandedHeaderByProfile(config, 'smallGroups', `Unidade: ${pg.unit || 'Todas'} | Referência: ${isUsingHistory ? 'Histórico Fechado' : 'Dados Atuais'}`)}
          
          <div style="background: #f8fafc; padding: 20px; border-left: 8px solid ${pColor}; border-radius: 0 12px 12px 0; margin-bottom: 25px;">
            <h2 style="font-size: 24px; font-weight: 900; color: #1e293b; margin: 0 0 5px 0; text-transform: uppercase;">${pg.name}</h2>
            <p style="font-size: 14px; color: #475569; margin: 0; font-weight: bold;">Líder: <span style="color: ${pColor};">${leaderName}</span></p>
            <p style="font-size: 10px; color: #94a3b8; margin: 5px 0 0 0; text-transform: uppercase;">Total de Membros: ${membersList.length}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase;">
                <th style="padding: 12px; text-align: left; width: 50%;">Nome do Membro</th>
                <th style="padding: 12px; text-align: left; width: 30%;">Setor / Vínculo</th>
                <th style="padding: 12px; text-align: center; width: 20%;">Assinatura</th>
              </tr>
            </thead>
            <tbody>
              ${membersList.length > 0 ? membersList.map((m, index) => `
                <tr style="border-bottom: 1px solid #e2e8f0; background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                  <td style="padding: 12px; font-weight: ${m.isLeader ? '900' : '500'}; color: ${m.isLeader ? pColor : '#334155'}; text-transform: uppercase;">
                    ${m.name} ${m.isLeader ? '<span style="font-size: 8px; background: #dbeafe; color: #1d4ed8; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">LÍDER</span>' : ''}
                  </td>
                  <td style="padding: 12px; font-weight: 700; color: #64748b;">
                    ${m.sectorName}
                  </td>
                  <td style="padding: 12px; border-left: 1px solid #e2e8f0;">
                    <!-- Espaço para assinatura -->
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="3" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">Nenhum membro matriculado neste PG.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    }

    if (targetPGs.length === 0) {
      html += `
        <div class="pdf-page" style="width: 210mm; height: 297mm; padding: 15mm; background: white; box-sizing: border-box; font-family: sans-serif; display: flex; align-items: center; justify-content: center;">
          <h2 style="color: #94a3b8;">Nenhum PG encontrado para os filtros selecionados.</h2>
        </div>
      `;
    }

    html += `</div>`;
    
    await generatePdf(html);
    setLoadingAction(null);
  };

  const handleGenerateAudit = async (type: 'students' | 'visits') => {
    setLoadingAction(type);
    const data = type === 'students' ? auditList : filteredData.visits.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const ROWS_PER_PAGE = 22;
    const totalPages = Math.ceil(data.length / ROWS_PER_PAGE) || 1;
    let html = `<div style="background: #f1f5f9; padding: 20px;">`;
    
    for (let p = 0; p < totalPages; p++) {
      html += `<div class="pdf-page" style="width: 210mm; height: 297mm; padding: 15mm; background: white; box-sizing: border-box; font-family: sans-serif; position: relative;">
          ${getBrandedHeaderByProfile(config, 'chaplaincy', `Página ${p + 1} de ${totalPages}`)}
          <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
            <thead><tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #64748b; text-transform: uppercase;"><th style="padding: 10px; text-align: left;">Data</th><th style="padding: 10px; text-align: left;">Setor / Unid</th><th style="padding: 10px; text-align: left;">Nome / Motivo</th><th style="padding: 10px; text-align: left;">Capelão</th><th style="padding: 10px; text-align: right;">Status</th></tr></thead>
            <tbody>
              ${data.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE).map((item: any) => {
                const dateFmt = new Date(item.date).toLocaleDateString();
                const nameStr = type === 'students' ? (item.isClass ? item.studentsList.join(', ') : item.name) : item.staffName;
                const chaplainStr = type === 'students' ? item.chaplain : (users.find(u => u.id === item.userId)?.name || 'N/I');
                return `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px;">${dateFmt}</td><td style="padding: 8px; font-weight: 700;">${resolveDynamicName(item.sector)}<br/><span style="font-size: 7px; color: #94a3b8;">${item.unit}</span></td><td style="padding: 8px; font-weight: 900; text-transform: uppercase;">${nameStr}</td><td style="padding: 8px;">${chaplainStr.split(' ')[0]}</td><td style="padding: 8px; text-align: right; font-weight: 900; color: ${item.status === RecordStatus.TERMINO ? '#f43f5e' : '#10b981'};">${item.status || 'OK'}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
      </div>`;
    }
    html += `</div>`;
    
    await generatePdf(html);
    setLoadingAction(null);
  };

  return {
    filters,
    setFilters,
    loadingAction,
    isGenerating,
    isLoadingHistoricalAttendees,
    pColor,
    proGroups,
    totalStats: finalStats.stats,
    chaplainStats,
    handleExportExcel,
    handleGenerateOfficialReport,
    handleGeneratePGReport,
    handleGenerateAudit
  };
};
