
import React, { useState, useMemo } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Unit, RecordStatus, Config, ActivityFilter } from '../types';
import { useReportLogic } from '../hooks/useReportLogic';
import { resolveDynamicName, normalizeString } from '../utils/formatters';
import { generateExecutiveHTML } from '../utils/pdfTemplates';
import { useDocumentGenerator } from '../hooks/useDocumentGenerator';

import ReportStats from './Reports/ReportStats';
import ReportActions from './Reports/ReportActions';
import ChaplainCard from './Reports/ChaplainCard';

interface ReportsProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  users: User[];
  currentUser: User;
  config: Config;
  onRefresh?: () => Promise<any>;
}

const Reports: React.FC<ReportsProps> = ({ studies, classes, groups, visits, users, currentUser, config }) => {
  const { generatePdf, generateExcel, isGenerating } = useDocumentGenerator();
  // Estado local para controle visual de qual botão está carregando
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const getStartOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  };

  const [filters, setFilters] = useState({
    startDate: getStartOfMonth(),
    endDate: new Date().toISOString().split('T')[0],
    selectedChaplain: 'all', selectedUnit: 'all', selectedActivity: ActivityFilter.TODAS, selectedStatus: 'all'
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
    // Nota: Em uma implementação ideal, o hook suportaria multiplas abas. 
    // Aqui faremos simples para o exemplo ou expandiriamos o hook.
    // Usando apenas estudos como exemplo ou combinando.
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

  const handleGenerateAudit = async (type: 'students' | 'visits') => {
    setLoadingAction(type);
    const data = type === 'students' ? auditList : filteredData.visits.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const ROWS_PER_PAGE = 22;
    const totalPages = Math.ceil(data.length / ROWS_PER_PAGE) || 1;
    let html = `<div style="background: #f1f5f9; padding: 20px;">`;
    
    const renderAuditHeader = () => `
      <header style="border-bottom: 4px solid ${pColor}; padding-bottom: 10px; margin-bottom: 20px; display: flex; align-items: center;">
        <img src="${config.reportLogoUrl || ''}" style="width: 80px; margin-right: 20px;" />
        <div>
          <h1 style="font-size: 16px; color: ${pColor}; margin: 0; text-transform: uppercase;">${config.headerLine1}</h1>
          <h2 style="font-size: 10px; color: #475569; margin: 0;">Auditoria de ${type === 'students' ? 'Alunos' : 'Visitas'}</h2>
        </div>
      </header>
    `;

    for (let p = 0; p < totalPages; p++) {
      html += `<div class="pdf-page" style="width: 210mm; height: 297mm; padding: 15mm; background: white; box-sizing: border-box; font-family: sans-serif; position: relative;">
          ${renderAuditHeader()}
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

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-500">
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Relatórios Digitais</h1>
          <ReportActions 
            pColor={pColor} 
            generating={isGenerating ? loadingAction : null} 
            onPdf={handleGenerateOfficialReport} 
            onExcel={handleExportExcel} 
            onAuditVidas={() => handleGenerateAudit('students')} 
            onAuditVisitas={() => handleGenerateAudit('visits')}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 p-6 bg-slate-50 rounded-[2.5rem]">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Início</label><input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Fim</label><input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Capelão</label><select value={filters.selectedChaplain} onChange={e => setFilters({...filters, selectedChaplain: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm"><option value="all">Todos</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Unidade</label><select value={filters.selectedUnit} onChange={e => setFilters({...filters, selectedUnit: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm"><option value="all">Todas</option><option value={Unit.HAB}>HAB</option><option value={Unit.HABA}>HABA</option></select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Atividade</label><select value={filters.selectedActivity} onChange={e => setFilters({...filters, selectedActivity: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm">{Object.values(ActivityFilter).map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status</label><select value={filters.selectedStatus} onChange={e => setFilters({...filters, selectedStatus: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm"><option value="all">Todos</option>{Object.values(RecordStatus).map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
        </div>

        <ReportStats totalStats={totalStats} />
      </section>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {chaplainStats.map((stat) => (
          <ChaplainCard key={stat.user.id} stat={stat} />
        ))}
      </div>
    </div>
  );
};

export default Reports;
