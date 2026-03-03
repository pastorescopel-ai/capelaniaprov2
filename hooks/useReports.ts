import { useState, useMemo } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Unit, RecordStatus, Config, ActivityFilter } from '../types';
import { useReportLogic } from './useReportLogic';
import { resolveDynamicName, normalizeString } from '../utils/formatters';
import { generateExecutiveHTML } from '../utils/pdfTemplates';
import { useDocumentGenerator } from './useDocumentGenerator';
import { useApp } from '../contexts/AppContext';
import { getBrandedHeaderByProfile } from '../utils/reportTemplates';

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
  const { proGroups, proGroupMembers, proStaff, proSectors, proProviders, proGroupProviderMembers } = useApp();
  
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

  const { filteredData, auditList, totalStats } = useReportLogic(studies, classes, groups, visits, users, filters as any);
  const pColor = config.primaryColor || '#005a9c';

  const chaplainStats = useMemo(() => {
    return users.map(userObj => {
      const uid = userObj.id;
      const filterByUid = (list: any[]) => list.filter(i => i.userId === uid);
      const getUnitStats = (unit: Unit) => {
        const uS = filterByUid(filteredData.studies).filter(i => (i.unit || Unit.HAB) === unit);
        const uC = filterByUid(filteredData.classes).filter(i => (i.unit || Unit.HAB) === unit);
        const uG = filterByUid(filteredData.groups).filter(i => (i.unit || Unit.HAB) === unit);
        const uV = filterByUid(filteredData.visits).filter(i => (i.unit || Unit.HAB) === unit);
        const names = new Set<string>();
        uS.forEach(s => s.name && names.add(normalizeString(s.name)));
        uC.forEach(c => c.students?.forEach((n: any) => n && names.add(normalizeString(n))));
        return { students: names.size, studies: uS.length, classes: uC.length, groups: uG.length, visits: uV.length, total: uS.length + uC.length + uG.length + uV.length };
      };
      const hab = getUnitStats(Unit.HAB);
      const haba = getUnitStats(Unit.HABA);
      return { user: userObj, name: userObj.name, totalActions: hab.total + haba.total, hab, haba, students: hab.students + haba.students, maxVal: Math.max(hab.total + haba.total, 1) };
    }).filter(s => filters.selectedChaplain === 'all' || s.user.id === filters.selectedChaplain)
      .filter(s => filters.selectedChaplain !== 'all' || s.totalActions > 0 || s.students > 0).sort((a, b) => b.totalActions - a.totalActions);
  }, [users, filteredData, filters.selectedChaplain]);

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
    
    const targetPGs = filters.selectedPG === 'all' 
      ? proGroups.filter(g => g.unit === filters.selectedUnit || filters.selectedUnit === 'all')
      : proGroups.filter(g => g.id === filters.selectedPG);

    targetPGs.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    let html = `<div style="background: #f1f5f9; padding: 20px;">`;

    for (const pg of targetPGs) {
      const activeStaffMembers = proGroupMembers.filter(m => m.groupId === pg.id && !m.leftAt);
      const activeProviderMembers = proGroupProviderMembers.filter(m => m.groupId === pg.id && !m.leftAt);

      const membersList = [
        ...activeStaffMembers.map(m => {
          const staff = proStaff.find(s => s.id === m.staffId);
          const sector = proSectors.find(s => s.id === staff?.sectorId);
          return {
            name: staff?.name || 'Desconhecido',
            sectorName: sector?.name || 'Sem Setor',
            isLeader: normalizeString(staff?.name || '') === normalizeString(pg.currentLeader || ''),
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

      membersList.sort((a, b) => {
        if (a.isLeader && !b.isLeader) return -1;
        if (!a.isLeader && b.isLeader) return 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

      const leaderName = pg.currentLeader || 'Sem Líder Definido';

      html += `
        <div class="pdf-page" style="width: 210mm; min-height: 297mm; padding: 15mm; background: white; box-sizing: border-box; font-family: sans-serif; position: relative; margin-bottom: 20px;">
          ${getBrandedHeaderByProfile(config, 'smallGroups', `Unidade: ${pg.unit || 'Todas'}`)}
          
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
    pColor,
    proGroups,
    totalStats,
    chaplainStats,
    handleExportExcel,
    handleGenerateOfficialReport,
    handleGeneratePGReport,
    handleGenerateAudit
  };
};
