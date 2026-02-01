
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Unit, RecordStatus, Config, MasterLists, ActivityFilter } from '../types';
import { REPORT_LOGO_BASE64, STATUS_OPTIONS } from '../constants';
import { useReportLogic } from '../hooks/useReportLogic';
import Button from './Shared/Button';
import ChaplainStatCard from './Shared/ChaplainStatCard'; 
import { resolveDynamicName } from '../utils/formatters';
import * as XLSX from 'xlsx';

interface ReportsProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  users: User[];
  currentUser: User;
  masterLists: MasterLists; 
  config: Config;
  onRefresh?: () => Promise<any>;
}

const PageFooter: React.FC<{ pageNum: number, total: number }> = ({ pageNum, total }) => (
  <div className="absolute bottom-[10mm] left-[10mm] right-[10mm] border-t border-slate-200 pt-2 flex justify-between items-center">
    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Gerado pelo Sistema Capelania Pro em {new Date().toLocaleString('pt-BR')}</p>
    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Página {pageNum} de {total}</p>
  </div>
);

const Reports: React.FC<ReportsProps> = ({ studies, classes, groups, visits, users, currentUser, masterLists, config, onRefresh }) => {
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showStudentsAudit, setShowStudentsAudit] = useState(false);
  const [showStaffAudit, setShowStaffAudit] = useState(false);
  
  const [visibleChaplains, setVisibleChaplains] = useState(8);
  const loaderRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<{
    startDate: string; endDate: string; selectedChaplain: string; selectedUnit: 'all' | Unit;
    selectedActivity: ActivityFilter; selectedStatus: 'all' | RecordStatus;
  }>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    selectedChaplain: 'all', selectedUnit: 'all', selectedActivity: ActivityFilter.TODAS, selectedStatus: 'all'
  });

  const { filteredData, auditList, totalStats } = useReportLogic(studies, classes, groups, visits, users, filters);
  const pColor = config.primaryColor || '#005a9c';
  const reportLogoSrc = config.reportLogoUrl || REPORT_LOGO_BASE64;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { 
      if (e.key === 'Escape') { setShowPdfPreview(false); setShowStudentsAudit(false); setShowStaffAudit(false); } 
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

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
        uS.forEach(s => s.name && names.add(s.name.trim().toLowerCase()));
        uC.forEach(c => c.students?.forEach((n: any) => n && names.add(n.trim().toLowerCase())));
        return { students: names.size, studies: uS.length, classes: uC.length, groups: uG.length, visits: uV.length, total: uS.length + uC.length + uG.length + uV.length };
      };
      const hab = getUnitStats(Unit.HAB);
      const haba = getUnitStats(Unit.HABA);
      return { user: userObj, name: userObj.name, totalActions: hab.total + haba.total, hab, haba, students: hab.students + haba.students, maxVal: Math.max(hab.total + haba.total, 1) };
    }).filter(s => filters.selectedChaplain === 'all' || s.user.id === filters.selectedChaplain)
      .filter(s => filters.selectedChaplain !== 'all' || s.totalActions > 0 || s.students > 0).sort((a, b) => b.totalActions - a.totalActions);
  }, [users, filteredData, filters.selectedChaplain]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleChaplains < chaplainStats.length) {
        setVisibleChaplains(prev => prev + 6);
      }
    }, { threshold: 0.1 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [visibleChaplains, chaplainStats.length]);

  const handleExportAuditExcel = (type: 'students' | 'visits') => {
    const dataToExport = type === 'students' ? auditList : filteredData.visits;
    const filename = `Auditoria_${type === 'students' ? 'Alunos' : 'Visitas'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    const ws = XLSX.utils.json_to_sheet(dataToExport.map(item => {
      if (type === 'students') {
        const i = item as any;
        return {
          'Data': new Date(i.date).toLocaleDateString(),
          'Setor': resolveDynamicName(i.sector),
          'Unidade': i.unit,
          'Nome(s)': i.isClass ? i.studentsList.join(', ') : i.name,
          'Tipo Atividade': i.type,
          'Status': i.status,
          'Capelão': i.chaplain
        };
      } else {
        const i = item as any;
        return {
          'Data': new Date(i.date).toLocaleDateString(),
          'Colaborador': i.staffName,
          'Setor': resolveDynamicName(i.sector),
          'Unidade': i.unit,
          'Motivo': i.reason,
          'Capelão': users.find(u => u.id === i.userId)?.name || 'N/I',
          'Status Retorno': i.requiresReturn ? (i.returnCompleted ? 'Concluído' : 'Pendente') : 'N/A'
        };
      }
    }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, filename);
  };

  const renderTable = (unit: Unit) => (
    <div className="space-y-2">
      <h5 className="text-[10px] font-black uppercase tracking-widest border-b-2 pb-1 mb-2" style={{ color: pColor, borderColor: `${pColor}30` }}>Resumo Executivo - Unidade {unit}</h5>
      <table className="w-full border-collapse">
        <thead style={{ backgroundColor: pColor }}>
          <tr>
            <th className="p-2 text-[8px] font-black uppercase text-white text-left w-[35%] rounded-tl-md">Capelão</th>
            <th className="p-2 text-[8px] font-black uppercase text-white text-center w-[13%]">Alunos</th>
            <th className="p-2 text-[8px] font-black uppercase text-white text-center w-[13%]">Estudos</th>
            <th className="p-2 text-[8px] font-black uppercase text-white text-center w-[13%]">Classes</th>
            <th className="p-2 text-[8px] font-black uppercase text-white text-center w-[13%]">PGs</th>
            <th className="p-2 text-[8px] font-black uppercase text-white text-center w-[13%] rounded-tr-md">Visitas</th>
          </tr>
        </thead>
        <tbody>
          {chaplainStats.map((s, idx) => {
            const data = unit === Unit.HAB ? s.hab : s.haba;
            if (data.total === 0 && data.students === 0) return null;
            return (
              <tr key={idx} className="border-b border-slate-100 last:border-none">
                <td className="p-1.5 text-[9px] font-bold text-slate-700 truncate border-l border-slate-100">{s.name}</td>
                <td className="p-1.5 text-[9px] font-black text-rose-600 text-center bg-blue-50/50">{data.students}</td>
                <td className="p-1.5 text-[9px] font-medium text-slate-600 text-center">{data.studies}</td>
                <td className="p-1.5 text-[9px] font-medium text-slate-600 text-center">{data.classes}</td>
                <td className="p-1.5 text-[9px] font-medium text-slate-600 text-center">{data.groups}</td>
                <td className="p-1.5 text-[9px] font-medium text-slate-600 text-center border-r border-slate-100">{data.visits}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  
  const renderProgressBar = (label: string, value: number, total: number, colorClass: string) => {
    if (value === 0) return null;
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
      <div className="flex items-center gap-2 mb-1">
        <div className="w-12 text-[8px] font-bold text-slate-600 uppercase text-right">{label}</div>
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
           <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percentage}%`, printColorAdjust: 'exact' }}></div>
        </div>
        <div className="w-6 text-[9px] font-black text-slate-800 text-right">{value}</div>
      </div>
    );
  };
  
  const renderSmallUnitTable = (unitName: string, data: any, bgColor: string, txtColor: string) => (
    <div className={`flex-1 rounded-xl p-3 ${bgColor} border border-slate-100/50`}>
      <div className="flex justify-between items-center mb-2 border-b border-black/5 pb-1">
        <span className={`text-[9px] font-black uppercase tracking-widest ${txtColor}`}>{unitName}</span>
        <span className="text-[10px] font-bold text-slate-800">{data.total}</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[9px]"><span className="text-slate-500 uppercase">Estudos</span><span className="font-bold">{data.studies}</span></div>
        <div className="flex justify-between text-[9px]"><span className="text-slate-500 uppercase">Classes</span><span className="font-bold">{data.classes}</span></div>
        <div className="flex justify-between text-[9px]"><span className="text-slate-500 uppercase">PGs</span><span className="font-bold">{data.groups}</span></div>
        <div className="flex justify-between text-[9px]"><span className="text-slate-500 uppercase">Visitas</span><span className="font-bold">{data.visits}</span></div>
      </div>
    </div>
  );

  const handlePrint = () => {
    const content = document.getElementById('print-container');
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Relatório de Atividades</title><style>@media print { @page { size: A4 portrait; margin: 0; } body { margin:0; padding:0; background:white!important; print-color-adjust: exact!important; -webkit-print-color-adjust: exact!important; } #print-container { width:100%!important; } .a4-page { width:210mm; height:297mm; page-break-after:always; } * { box-shadow:none!important; } } body { font-family: 'Inter', sans-serif; }</style>${Array.from(document.querySelectorAll('link, style')).map(s => s.outerHTML).join('')}</head><body><div id="print-container">${content.innerHTML}</div><script>window.onload=()=>{window.print();setTimeout(window.close,1000);}</script></body></html>`);
    win.document.close();
  };

  const formatDate = (d: string) => d.split('T')[0].split('-').reverse().join('/');
  
  const ITEMS_PER_PAGE = 6; 
  const totalPages = 1 + Math.ceil(chaplainStats.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-500">
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Relatórios Executivos</h1>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setShowStudentsAudit(true)} icon={<i className="fas fa-list-ul"></i>}>Audit Alunos</Button>
            <Button variant="secondary" onClick={() => setShowStaffAudit(true)} icon={<i className="fas fa-id-badge"></i>}>Audit Visitas</Button>
            <Button variant="primary" style={{backgroundColor: pColor}} onClick={() => setShowPdfPreview(true)} icon={<i className="fas fa-file-pdf"></i>}>Gerar PDF Oficial</Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 p-6 bg-slate-50 rounded-[2.5rem]">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Início</label><input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Fim</label><input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Capelão</label><select value={filters.selectedChaplain} onChange={e => setFilters({...filters, selectedChaplain: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs"><option value="all">Todos</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Unidade</label><select value={filters.selectedUnit} onChange={e => setFilters({...filters, selectedUnit: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs"><option value="all">Todas</option><option value={Unit.HAB}>HAB</option><option value={Unit.HABA}>HABA</option></select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Atividade</label><select value={filters.selectedActivity} onChange={e => setFilters({...filters, selectedActivity: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs">{Object.values(ActivityFilter).map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status</label><select value={filters.selectedStatus} onChange={e => setFilters({...filters, selectedStatus: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs"><option value="all">Todos</option>{STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[{l:'Alunos',v:totalStats.totalStudents,c:'bg-blue-600'}, {l:'Estudos',v:totalStats.studies,c:'bg-blue-500'}, {l:'Classes',v:totalStats.classes,c:'bg-indigo-500'}, {l:'PGs',v:totalStats.groups,c:'bg-emerald-500'}, {l:'Visitas',v:totalStats.visits,c:'bg-rose-500'}].map((card, i) => (
            <div key={i} className={`${card.c} p-6 rounded-[2.5rem] text-white shadow-xl flex flex-col items-center hover:scale-105 transition-all`}>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">{card.l}</p><p className="text-2xl font-black">{card.v}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {chaplainStats.slice(0, visibleChaplains).map((stat) => {
           const hasHab = stat.hab.total > 0;
           const hasHaba = stat.haba.total > 0;
           const showBoth = (hasHab && hasHaba) || (!hasHab && !hasHaba);
           return (
              <div key={stat.user.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col space-y-6 hover:border-blue-300 transition-all animate-in fade-in duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-2xl">{stat.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter truncate">{stat.name}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[8px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">Alunos: {stat.students}</span>
                      <span className="text-[8px] font-black uppercase bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md">Ações: {stat.totalActions}</span>
                    </div>
                  </div>
                </div>
                 <div className="flex gap-3 pt-2 border-t border-slate-50">
                   {(hasHab || showBoth) && renderSmallUnitTable('HAB', stat.hab, 'bg-blue-50', 'text-blue-700')}
                   {(hasHaba || showBoth) && renderSmallUnitTable('HABA', stat.haba, 'bg-amber-50', 'text-amber-700')}
                 </div>
              </div>
           );
        })}
      </div>
      
      {visibleChaplains < chaplainStats.length && (
        <div ref={loaderRef} className="py-10 flex justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}

      {/* MODAL ALUNOS - CENTRO ABSOLUTO */}
      {showStudentsAudit && (
        <div className="fixed inset-0 z-[5000]">
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md" onClick={() => setShowStudentsAudit(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-6xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Lista de Auditoria (Alunos)</h3>
              <div className="flex gap-3">
                <Button variant="success" onClick={() => handleExportAuditExcel('students')} icon={<i className="fas fa-file-excel"></i>}>Exportar Excel</Button>
                <Button variant="dark" onClick={() => {
                  const content = document.getElementById('audit-print-root');
                  if (content) { const win = window.open('','_blank'); if(win) { win.document.write(`<html><head><title>Auditoria de Alunos</title><link href="https://cdn.tailwindcss.com" rel="stylesheet"></head><body>${content.outerHTML}<script>window.onload=()=>{window.print();window.close();}</script></body></html>`); win.document.close(); } }
                }} icon={<i className="fas fa-print"></i>}>Imprimir</Button>
                <button onClick={() => setShowStudentsAudit(false)} className="w-12 h-12 rounded-2xl bg-white border flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm"><i className="fas fa-times text-xl"></i></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto no-scrollbar p-6" id="audit-print-root">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100"><tr className="text-slate-500 font-black uppercase text-[10px] tracking-widest border-b"><th className="p-6">Setor</th><th className="p-6">Nomes</th><th className="p-6">Tipo</th><th className="p-6">Capelão</th><th className="p-6">Status</th></tr></thead>
                <tbody className="divide-y">{auditList.map((item, idx) => (
                  <tr key={idx} className={`hover:bg-slate-50/50 ${item.status === RecordStatus.TERMINO ? 'bg-rose-50/30' : ''}`}>
                    <td className="p-6 text-xs font-bold">{resolveDynamicName(item.sector)}</td>
                    <td className="p-6 text-sm font-black uppercase">{item.isClass ? item.studentsList.join(', ') : item.name}</td>
                    <td className="p-6 text-[10px] font-bold text-slate-500 uppercase">{item.icon} {item.type}</td>
                    <td className="p-6 text-xs font-bold text-slate-600 uppercase">{item.chaplain}</td>
                    <td className="p-6 font-black text-[10px] uppercase text-blue-500">{item.status}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COLABORADORES - CENTRO ABSOLUTO */}
      {showStaffAudit && (
        <div className="fixed inset-0 z-[5000]">
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md" onClick={() => setShowStaffAudit(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-full max-w-6xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="space-y-1"><h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Relatório de Visitas</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período: {formatDate(filters.startDate)} a {formatDate(filters.endDate)}</p></div>
              <div className="flex gap-3">
                <Button variant="success" onClick={() => handleExportAuditExcel('visits')} icon={<i className="fas fa-file-excel"></i>}>Exportar Excel</Button>
                <Button variant="dark" onClick={() => {
                  const content = document.getElementById('staff-audit-print-root');
                  if (content) { const win = window.open('','_blank'); if(win) { win.document.write(`<html><head><title>Relatório de Visitas</title><link href="https://cdn.tailwindcss.com" rel="stylesheet"></head><body>${content.outerHTML}<script>window.onload=()=>{window.print();window.close();}</script></body></html>`); win.document.close(); } }
                }} icon={<i className="fas fa-print"></i>}>Imprimir</Button>
                <button onClick={() => setShowStaffAudit(false)} className="w-12 h-12 rounded-2xl bg-white border flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm"><i className="fas fa-times text-xl"></i></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto no-scrollbar p-6" id="staff-audit-print-root">
              <div className="mb-6 hidden print:block text-center border-b pb-4"><h2 className="text-2xl font-black uppercase text-slate-800">Relatório de Visitas a Colaboradores</h2></div>
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100"><tr className="text-slate-500 font-black uppercase text-[10px] tracking-widest border-b"><th className="p-4">Data</th><th className="p-4">Colaborador</th><th className="p-4">Setor</th><th className="p-4">Motivo</th><th className="p-4">Capelão</th></tr></thead>
                <tbody className="divide-y">{filteredData.visits.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-4 text-xs font-bold text-slate-600">{formatDate(item.date)}</td>
                    <td className="p-4 text-sm font-black uppercase text-slate-800">{item.staffName}</td>
                    <td className="p-4 text-xs font-bold text-slate-600 uppercase">{resolveDynamicName(item.sector)}</td>
                    <td className="p-4 text-[10px] font-black uppercase text-blue-600 bg-blue-50/30 rounded-lg inline-block mt-2 mx-4">{item.reason}</td>
                    <td className="p-4 text-xs font-bold text-slate-600 uppercase">{users.find(u => u.id === item.userId)?.name || 'N/I'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PDF PREVIEW - MANTÉM FULLSCREEN */}
      {showPdfPreview && (
        <div className="fixed inset-0 bg-slate-900 flex flex-col items-center overflow-hidden z-[9000]">
          <div className="w-full bg-slate-900 p-4 flex justify-between items-center shadow-lg z-[9100] border-b border-slate-800">
            <h2 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2"><i className="fas fa-print"></i> Visualização do Documento Oficial</h2>
            <div className="flex items-center gap-3">
               <button onClick={handlePrint} className="px-6 py-2 bg-[#005a9c] text-white font-black uppercase text-xs rounded-xl hover:bg-blue-600 transition-all shadow-xl">Imprimir / Salvar PDF</button>
               <button onClick={() => setShowPdfPreview(false)} className="w-10 h-10 rounded-xl bg-slate-800 text-white hover:bg-rose-500 transition-all flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
          </div>
          <div className="flex-1 w-full overflow-y-auto p-10 flex flex-col items-center gap-8 no-scrollbar bg-slate-900">
            <div id="print-container" className="flex flex-col gap-8">
              <div className="bg-white shadow-2xl mx-auto overflow-hidden relative flex flex-col" style={{ width: '210mm', height: '297mm', padding: '15mm 10mm' }}>
                <header className="relative border-b-4 mb-8 h-[140px]" style={{ borderColor: pColor }}>
                  {reportLogoSrc && <img src={reportLogoSrc} style={{ position: 'absolute', left: `${config.reportLogoX}px`, top: `${config.reportLogoY}px`, width: `${config.reportLogoWidth}px` }} alt="Logo" />}
                  <div className="absolute top-4 right-0 text-right"><p className="text-[12px] font-black uppercase" style={{ color: pColor }}>{filters.selectedActivity}</p><p className="text-[9px] font-bold text-slate-500 uppercase">Período: {filters.startDate} a {filters.endDate}</p></div>
                  <div className="absolute" style={{ left: `${config.headerLine1X}px`, top: `${config.headerLine1Y}px`, width: '500px', textAlign: config.headerTextAlign }}><h1 style={{ fontSize: `${config.fontSize1}px`, color: pColor }} className="font-black uppercase m-0 leading-tight">{config.headerLine1}</h1></div>
                  <div className="absolute" style={{ left: `${config.headerLine2X}px`, top: `${config.headerLine2Y}px`, width: '500px', textAlign: config.headerTextAlign }}><h2 style={{ fontSize: `${config.fontSize2}px` }} className="font-bold text-slate-600 uppercase m-0 leading-tight">{config.headerLine2}</h2></div>
                  <div className="absolute" style={{ left: `${config.headerLine3X}px`, top: `${config.headerLine3Y}px`, width: '500px', textAlign: config.headerTextAlign }}><h3 style={{ fontSize: `${config.fontSize3}px` }} className="font-medium text-slate-400 uppercase m-0 leading-tight">{config.headerLine3}</h3></div>
                </header>
                <div className="mb-6 p-4 rounded-2xl border-2 border-blue-100 bg-blue-50/50 flex items-center justify-between">
                  <div className="space-y-1"><h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Estudantes Atendidos</h4><p className="text-[9px] font-bold text-blue-600/70 uppercase">Total Geral (Estudos + Classes)</p></div>
                  <div className="text-right"><span className="text-4xl font-black tracking-tighter text-rose-600">{totalStats.totalStudents}</span><p className="text-[8px] font-black text-blue-400 uppercase">Vidas sob Cuidado</p></div>
                </div>
                <div className="flex-1 space-y-6">{renderTable(Unit.HAB)}{renderTable(Unit.HABA)}</div>
                <div className="grid grid-cols-4 gap-4 mt-auto mb-6 pt-4">
                  {[{l:'Estudos',v:totalStats.studies,bg:'bg-blue-500'}, {l:'Classes',v:totalStats.classes,bg:'bg-indigo-500'}, {l:'PGs',v:totalStats.groups,bg:'bg-emerald-500'}, {l:'Visitas',v:totalStats.visits,bg:'bg-rose-500'}].map((item, i) => (
                    <div key={i} className={`${item.bg} p-4 rounded-xl text-white flex flex-col items-center justify-center shadow-sm`}><span className="text-3xl font-black">{item.v}</span><span className="text-[8px] font-black uppercase tracking-widest opacity-80 text-center leading-tight">{item.l}</span></div>
                  ))}
                </div>
                <PageFooter pageNum={1} total={totalPages} />
              </div>
              
              {Array.from({ length: totalPages - 1 }).map((_, pageIdx) => (
                <div key={pageIdx} className="bg-white shadow-2xl mx-auto overflow-hidden relative" style={{ width: '210mm', height: '297mm', padding: '15mm 10mm' }}>
                   <div className="h-[10mm]"></div>
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-6 border-b pb-2">Resultados Individuais</h3>
                   <div className="grid grid-cols-2 gap-6 auto-rows-fr">
                     {chaplainStats.slice(pageIdx * ITEMS_PER_PAGE, (pageIdx + 1) * ITEMS_PER_PAGE).map((stat, idx) => {
                       const habActive = stat.hab.total > 0;
                       const habaActive = stat.haba.total > 0;
                       return (
                         <div key={idx} className="h-[60mm] p-4 rounded-[2rem] border border-slate-200 flex flex-col justify-between" style={{ breakInside: 'avoid' }}>
                           <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-blue-600 flex items-center justify-center font-black text-xs">{stat.name[0]}</div>
                                <span className="text-xs font-black text-slate-800 uppercase tracking-tighter truncate max-w-[150px]">{stat.name}</span>
                              </div>
                              <span className="text-[9px] font-black bg-slate-800 text-white px-2 py-0.5 rounded-md">{stat.totalActions} Ações</span>
                           </div>
                           <div className="grid grid-cols-2 gap-4 flex-1">
                              <div className={`rounded-xl p-2 ${habActive ? 'bg-blue-50/50' : 'opacity-30'}`}>
                                 <div className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-2 border-b border-blue-100 pb-1">HAB</div>
                                 <div className="flex flex-col gap-1">
                                    {renderProgressBar('Estudos', stat.hab.studies, stat.hab.total, 'bg-blue-500')}
                                    {renderProgressBar('Classes', stat.hab.classes, stat.hab.total, 'bg-blue-500')}
                                    {renderProgressBar('PGs', stat.hab.groups, stat.hab.total, 'bg-blue-500')}
                                    {renderProgressBar('Visitas', stat.hab.visits, stat.hab.total, 'bg-blue-500')}
                                 </div>
                              </div>
                              <div className={`rounded-xl p-2 ${habaActive ? 'bg-amber-50/50' : 'opacity-30'}`}>
                                 <div className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-2 border-b border-amber-100 pb-1">HABA</div>
                                 <div className="flex flex-col gap-1">
                                    {renderProgressBar('Estudos', stat.haba.studies, stat.haba.total, 'bg-amber-500')}
                                    {renderProgressBar('Classes', stat.haba.classes, stat.haba.total, 'bg-amber-500')}
                                    {renderProgressBar('PGs', stat.haba.groups, stat.haba.total, 'bg-amber-500')}
                                    {renderProgressBar('Visitas', stat.haba.visits, stat.haba.total, 'bg-amber-500')}
                                 </div>
                              </div>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                   <PageFooter pageNum={pageIdx + 2} total={totalPages} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
