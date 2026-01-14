
// ############################################################
// # VERSION: 2.10.0-REPORTS-WEEKLY (STABLE)
// # STATUS: WEEKLY ACCORDION + PDF INTEGRITY
// ############################################################

import React, { useState, useMemo, useEffect } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Unit, RecordStatus, Config, MasterLists } from '../types';
import { REPORT_LOGO_BASE64 } from '../constants';

interface ReportsProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  users: User[];
  masterLists: MasterLists; 
  config: Config;
  onRefresh?: () => Promise<void>;
}

const resolveDynamicName = (val: string, list: string[] = []) => {
  if (!val || !val.includes('_')) return val;
  const prefix = val.split('_')[0] + '_';
  const currentMatch = list.find(item => item.startsWith(prefix));
  return currentMatch || val;
};

// Auxiliar para calcular o intervalo de datas da semana (Segunda a Domingo)
const getWeekRangeLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  // Ajuste para segunda-feira como início da semana
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const fmt = (date: Date) => date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `Semana de ${fmt(monday)} a ${fmt(sunday)}`;
};

const Reports: React.FC<ReportsProps> = ({ studies, classes, groups, visits, users, masterLists, config, onRefresh }) => {
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [selectedDetailUser, setSelectedDetailUser] = useState<User | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<string[]>([]);
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedChaplain, setSelectedChaplain] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState<'all' | Unit>('all');

  const pColor = config.primaryColor || '#005a9c';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPdfPreview(false);
        setSelectedDetailUser(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredData = useMemo(() => {
    const filterFn = (item: any) => {
      if (!item || !item.date) return false;
      const itemDate = item.date.split('T')[0];
      const dateMatch = itemDate >= startDate && itemDate <= endDate;
      const chaplainMatch = selectedChaplain === 'all' || item.userId === selectedChaplain;
      const itemUnit = item.unit || Unit.HAB;
      const unitMatch = selectedUnit === 'all' || itemUnit === selectedUnit;
      return dateMatch && chaplainMatch && unitMatch;
    };

    return {
      studies: (studies || []).filter(filterFn),
      classes: (classes || []).filter(filterFn),
      groups: (groups || []).filter(filterFn),
      visits: (visits || []).filter(filterFn),
    };
  }, [studies, classes, groups, visits, startDate, endDate, selectedChaplain, selectedUnit]);

  const totalStats = useMemo(() => {
    const uniqueStudentsInFilter = new Set<string>();
    filteredData.studies.forEach(s => { if (s.name) uniqueStudentsInFilter.add(s.name.trim().toLowerCase()); });
    filteredData.classes.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(name => { if (name) uniqueStudentsInFilter.add(name.trim().toLowerCase()); }); });
    return {
      studies: filteredData.studies.length,
      classes: filteredData.classes.length,
      groups: filteredData.groups.length,
      visits: filteredData.visits.length,
      totalStudents: uniqueStudentsInFilter.size
    };
  }, [filteredData]);

  const chaplainStats = useMemo(() => {
    return users.map(userObj => {
      const uid = userObj.id;
      const uStudiesFiltered = filteredData.studies.filter(s => s.userId === uid);
      const uClassesFiltered = filteredData.classes.filter(c => c.userId === uid);
      const uVisitsFiltered = filteredData.visits.filter(v => v.userId === uid);
      const uGroupsFiltered = filteredData.groups.filter(g => g.userId === uid);
      
      const uniqueNames = new Set<string>();
      uStudiesFiltered.forEach(s => { if (s.name) uniqueNames.add(s.name.trim().toLowerCase()); });
      uClassesFiltered.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(n => uniqueNames.add(n.trim().toLowerCase())); });

      const getUnitStats = (unit: Unit) => {
          const uS = uStudiesFiltered.filter(s => (s.unit || Unit.HAB) === unit);
          const uC = uClassesFiltered.filter(c => (c.unit || Unit.HAB) === unit);
          const uG = uGroupsFiltered.filter(g => (g.unit || Unit.HAB) === unit);
          const uV = uVisitsFiltered.filter(v => (v.unit || Unit.HAB) === unit);
          
          const unitUniqueNames = new Set<string>();
          uS.forEach(s => { if (s.name) unitUniqueNames.add(s.name.trim().toLowerCase()); });
          uC.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(n => unitUniqueNames.add(n.trim().toLowerCase())); });
          
          return {
              students: unitUniqueNames.size,
              studies: uS.length,
              classes: uC.length,
              groups: uG.length,
              visits: uV.length,
              total: uS.length + uC.length + uG.length + uV.length,
              rawStudies: uS.sort((a,b) => b.createdAt - a.createdAt),
              rawClasses: uC.sort((a,b) => b.createdAt - a.createdAt),
              rawGroups: uG.sort((a,b) => b.createdAt - a.createdAt),
              rawVisits: uV.sort((a,b) => b.createdAt - a.createdAt)
          };
      };

      const totalActions = uStudiesFiltered.length + uClassesFiltered.length + uVisitsFiltered.length + uGroupsFiltered.length;

      return { 
        user: userObj, name: userObj.name, totalActions, 
        hab: getUnitStats(Unit.HAB), haba: getUnitStats(Unit.HABA), 
        students: uniqueNames.size
      };
    })
    .filter(s => selectedChaplain === 'all' || s.user.id === selectedChaplain)
    .filter(s => s.totalActions > 0 || s.students > 0)
    .sort((a, b) => b.totalActions - a.totalActions);
  }, [users, filteredData, selectedChaplain]);

  const toggleWeek = (week: string) => {
    setExpandedWeeks(prev => prev.includes(week) ? prev.filter(w => w !== week) : [...prev, week]);
  };

  const handlePrintIsolated = () => {
    const printContent = document.getElementById('pdf-root');
    if (!printContent) return;
    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;
    const styles = Array.from(document.querySelectorAll('link, style')).map(s => s.outerHTML).join('\n');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Oficial de Atividades</title>
          ${styles}
          <style>
            @media print { 
              @page { size: A4; margin: 12mm; } 
              .no-print { display: none; } 
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            } 
            body { background: #fff; padding: 0; margin: 0; -webkit-print-color-adjust: exact !important; }
            .pdf-wrap { width: 210mm; margin: auto; padding: 5mm; }
          </style>
        </head>
        <body>
          <div class="pdf-wrap">${printContent.innerHTML}</div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const PdfTemplate = () => {
    const formatDate = (date: string) => date.split('-').reverse().join('/');
    return (
      <div id="pdf-root" className="bg-white p-[5mm] flex flex-col gap-6 text-slate-900">
        <header className="relative border-b-4 flex-shrink-0" style={{ height: '140px', borderColor: pColor }}>
          {REPORT_LOGO_BASE64 && <img src={REPORT_LOGO_BASE64} style={{ position: 'absolute', left: `${config.reportLogoX}px`, top: `${config.reportLogoY}px`, width: `${config.reportLogoWidth}px` }} alt="Logo" />}
          <div className="absolute top-4 right-0 text-right">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Relatório Consolidado</p>
             <p className="text-[12px] font-black text-slate-800 uppercase" style={{ color: pColor }}>Período: {formatDate(startDate)} - {formatDate(endDate)}</p>
          </div>
          <div style={{ position: 'absolute', left: `${config.headerLine1X}px`, top: `${config.headerLine1Y}px`, width: '450px', textAlign: config.headerTextAlign }}>
            <h1 style={{ fontSize: `${config.fontSize1}px`, color: pColor }} className="font-black uppercase">{config.headerLine1}</h1>
          </div>
          <div style={{ position: 'absolute', left: `${config.headerLine2X}px`, top: `${config.headerLine2Y}px`, width: '450px', textAlign: config.headerTextAlign }}>
            <h2 style={{ fontSize: `${config.fontSize2}px` }} className="font-bold text-slate-600 uppercase">{config.headerLine2}</h2>
          </div>
          <div style={{ position: 'absolute', left: `${config.headerLine3X}px`, top: `${config.headerLine3Y}px`, width: '450px', textAlign: config.headerTextAlign }}>
            <h3 style={{ fontSize: `${config.fontSize3}px` }} className="font-medium text-slate-400 uppercase">{config.headerLine3}</h3>
          </div>
        </header>

        <section className="space-y-8 mt-4">
          {[Unit.HAB, Unit.HABA].map(unitKey => {
              if (selectedUnit !== 'all' && selectedUnit !== unitKey) return null;
              return (
                <div key={unitKey} className="space-y-2">
                  <h3 className="text-[10px] font-black uppercase border-b border-slate-200 pb-1" style={{ color: pColor }}>Unidade {unitKey}</h3>
                  <table className="w-full text-left text-[9px] border-collapse">
                    <thead>
                      <tr className="text-white font-black uppercase" style={{ backgroundColor: pColor }}>
                        <th className="p-2">Capelão</th>
                        <th className="p-2 text-center">Alunos</th>
                        <th className="p-2 text-center">Estudos</th>
                        <th className="p-2 text-center">Classes</th>
                        <th className="p-2 text-center">PGs</th>
                        <th className="p-2 text-center">Visitas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chaplainStats.map((stat, idx) => {
                        const uS = unitKey === Unit.HAB ? stat.hab : stat.haba;
                        if (uS.total === 0 && uS.students === 0) return null;
                        return (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="p-2 font-bold text-slate-700 uppercase border-b border-slate-100">{stat.name}</td>
                            <td className="p-2 text-center font-black border-b border-slate-100">{uS.students}</td>
                            <td className="p-2 text-center font-black border-b border-slate-100">{uS.studies}</td>
                            <td className="p-2 text-center font-black border-b border-slate-100">{uS.classes}</td>
                            <td className="p-2 text-center font-black border-b border-slate-100">{uS.groups}</td>
                            <td className="p-2 text-center font-black border-b border-slate-100">{uS.visits}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
          })}
          <div className="pt-6 border-t-2 border-slate-100">
             <h3 className="text-[11px] font-black uppercase text-center mb-6 tracking-widest text-slate-400">Indicadores Gráficos (Total HAB + HABA)</h3>
             <div className="grid grid-cols-4 gap-x-4 gap-y-10">
                {chaplainStats.map((stat) => {
                  const totalS = stat.students;
                  const totalE = stat.hab.studies + stat.haba.studies;
                  const totalC = stat.hab.classes + stat.haba.classes;
                  const totalP = stat.hab.groups + stat.haba.groups;
                  const totalV = stat.hab.visits + stat.haba.visits;
                  const maxVal = Math.max(totalS, totalE, totalC, totalP, totalV, 5);
                  const bars = [{ label: 'ALU', val: totalS, color: '#3b82f6' }, { label: 'EST', val: totalE, color: '#6366f1' }, { label: 'CLA', val: totalC, color: '#8b5cf6' }, { label: 'PGS', val: totalP, color: pColor }, { label: 'VIS', val: totalV, color: '#f43f5e' }];
                  return (
                    <div key={stat.user.id} className="flex flex-col items-center">
                      <p className="text-[7px] font-black uppercase mb-3 text-slate-600 border-b w-full text-center pb-1 border-slate-100 truncate">{stat.name}</p>
                      <div className="flex items-end justify-center h-[70px] w-full px-1 gap-0.5">
                         {bars.map((bar, bi) => {
                           const heightPerc = (bar.val / maxVal) * 100;
                           return (
                             <div key={bi} className="flex flex-col items-center justify-end h-full w-[18%]">
                                <span className="text-[7px] font-black mb-0.5" style={{ color: bar.color }}>{bar.val}</span>
                                <div style={{ height: `${Math.max(heightPerc, 2)}%`, backgroundColor: bar.color }} className="w-full rounded-t-sm shadow-sm"></div>
                                <span className="text-[4px] font-black uppercase mt-1 text-slate-400 truncate w-full text-center">{bar.label}</span>
                             </div>
                           );
                         })}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
          <div className="pt-10 mt-auto">
            <div className="grid grid-cols-5 gap-3">
              {[{ label: 'Total Alunos', val: totalStats.totalStudents, color: pColor }, { label: 'Total Estudos', val: totalStats.studies, color: '#3b82f6' }, { label: 'Total Classes', val: totalStats.classes, color: '#6366f1' }, { label: 'Total PGs', val: totalStats.groups, color: '#10b981' }, { label: 'Total Visitas', val: totalStats.visits, color: '#f43f5e' }].map((card, ci) => (
                <div key={ci} className="p-4 rounded-3xl text-center shadow-md border-2 border-white" style={{ backgroundColor: card.color }}>
                  <p className="text-[8px] font-black uppercase tracking-tighter text-white opacity-80 mb-0.5 leading-none">{card.label}</p>
                  <p className="text-xl font-black text-white leading-none">{card.val}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-between items-center px-2">
              <p className="text-[6px] text-slate-300 uppercase font-black tracking-[0.4em]">Emissão: {new Date().toLocaleString('pt-BR')}</p>
              <p className="text-[6px] text-slate-300 uppercase font-black tracking-[0.4em]">Gerado via Capelania Pro</p>
            </div>
          </div>
        </section>
      </div>
    );
  };

  const AccordionSection = ({ title, items, colorClass }: { title: string, items: any[], colorClass: string }) => {
    if (items.length === 0) return null;
    
    // Agrupa itens por semana
    const groupedByWeek = items.reduce((acc: any, item) => {
      const weekLabel = getWeekRangeLabel(item.date);
      if (!acc[weekLabel]) acc[weekLabel] = [];
      acc[weekLabel].push(item);
      return acc;
    }, {});

    const sortedWeekLabels = Object.keys(groupedByWeek).sort((a, b) => b.localeCompare(a));
    
    // Auto-expande a primeira semana se nada estiver expandido ainda
    useEffect(() => {
      if (expandedWeeks.length === 0 && sortedWeekLabels.length > 0) {
        setExpandedWeeks([sortedWeekLabels[0]]);
      }
    }, [sortedWeekLabels]);

    return (
      <div className="space-y-4">
        <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full border bg-white ${colorClass.replace('bg-', 'text-').replace('-50/50', '')} border-slate-100 w-fit shadow-sm`}>
          {title} ({items.length})
        </h4>
        <div className="space-y-3">
          {sortedWeekLabels.map(weekLabel => {
            const isOpen = expandedWeeks.includes(weekLabel);
            return (
              <div key={weekLabel} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden transition-all">
                <button 
                  onClick={() => toggleWeek(weekLabel)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{weekLabel}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{groupedByWeek[weekLabel].length} Atendimentos</span>
                    <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-slate-300 text-xs`}></i>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 pt-2 space-y-3 animate-in slide-in-from-top duration-300">
                    {groupedByWeek[weekLabel].map((item: any, idx: number) => (
                      <div key={idx} className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${colorClass}`}>
                         <div>
                            <p className="font-black text-slate-800 uppercase text-[11px]">{item.name || item.guide || resolveDynamicName(item.groupName, masterLists.groupsHAB) || resolveDynamicName(item.staffName, masterLists.staffHAB)}</p>
                            <p className="text-[9px] font-bold opacity-70 uppercase">
                              {resolveDynamicName(item.sector, item.unit === 'HAB' ? masterLists.sectorsHAB : masterLists.sectorsHABA)}
                              {item.lesson ? ` • Lição ${item.lesson}` : ''}
                            </p>
                         </div>
                         <div className="text-right">
                            <span className="text-[8px] font-black text-slate-400 uppercase">{new Date(item.date).toLocaleDateString()}</span>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-500">
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Relatórios e Estatísticas</h1>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onRefresh && onRefresh()} className="px-6 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl uppercase text-[9px] tracking-widest active:scale-95 transition-all"><i className="fas fa-sync-alt"></i> Sincronizar</button>
            <button onClick={handlePrintIsolated} className="px-6 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[9px] tracking-widest active:scale-95 transition-all"><i className="fas fa-print"></i> Imprimir Relatório</button>
            <button onClick={() => setShowPdfPreview(true)} className="px-6 py-4 text-white font-black rounded-2xl shadow-xl uppercase text-[9px] tracking-widest active:scale-95 transition-all" style={{ backgroundColor: pColor }}><i className="fas fa-file-pdf"></i> Visualizar PDF</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-[2.5rem]">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Início</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Fim</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Capelão</label>
            <select value={selectedChaplain} onChange={e => setSelectedChaplain(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm">
              <option value="all">Todos os Capelães</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Unidade</label>
            <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value as any)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm">
              <option value="all">Todas as Unidades</option>
              <option value={Unit.HAB}>HAB</option>
              <option value={Unit.HABA}>HABA</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[{label: 'Alunos', val: totalStats.totalStudents, color: 'bg-blue-600'}, {label: 'Estudos', val: totalStats.studies, color: 'bg-blue-500'}, {label: 'Classes', val: totalStats.classes, color: 'bg-indigo-500'}, {label: 'PGs', val: totalStats.groups, color: 'bg-emerald-500'}, {label: 'Visitas', val: totalStats.visits, color: 'bg-rose-500'}].map((card, i) => (
            <div key={i} className={`${card.color} p-6 rounded-[2.5rem] text-white shadow-xl flex flex-col items-center group hover:scale-105 transition-all`}>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1">{card.label}</p>
              <p className="text-2xl font-black">{card.val}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {chaplainStats.map((stat) => (
          <div key={stat.user.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6 group hover:border-blue-300 transition-all flex flex-col">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-2xl shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all">
                {stat.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter truncate">{stat.name}</h3>
                <div className="flex gap-2 mt-1">
                  <span className="text-[8px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-100">Alunos: {stat.students}</span>
                  <span className="text-[8px] font-black uppercase bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md border border-slate-100">Total: {stat.totalActions}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <p className="text-[8px] font-black uppercase text-slate-400 text-center tracking-widest border-b border-slate-200 pb-1 mb-2">Unidade HAB</p>
                <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-500">Estudos</span><span className="text-xs font-black text-slate-800">{stat.hab.studies}</span></div>
                <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-500">Classes</span><span className="text-xs font-black text-slate-800">{stat.hab.classes}</span></div>
                <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-500">PGs</span><span className="text-xs font-black text-slate-800">{stat.hab.groups}</span></div>
                <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-500">Visitas</span><span className="text-xs font-black text-slate-800">{stat.hab.visits}</span></div>
              </div>
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-2">
                <p className="text-[8px] font-black uppercase text-blue-400 text-center tracking-widest border-b border-blue-200 pb-1 mb-2">Unidade HABA</p>
                <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-blue-500">Estudos</span><span className="text-xs font-black text-blue-800">{stat.haba.studies}</span></div>
                <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-blue-500">Classes</span><span className="text-xs font-black text-blue-800">{stat.haba.classes}</span></div>
                <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-blue-500">PGs</span><span className="text-xs font-black text-blue-800">{stat.haba.groups}</span></div>
                <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-blue-500">Visitas</span><span className="text-xs font-black text-blue-800">{stat.haba.visits}</span></div>
              </div>
            </div>
            <button onClick={() => setSelectedDetailUser(stat.user)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest hover:bg-black active:scale-95 transition-all mt-auto">Ver Detalhamento</button>
          </div>
        ))}
      </div>

      {selectedDetailUser && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[1000] flex items-center justify-center p-4" onClick={(e) => { if(e.target === e.currentTarget) setSelectedDetailUser(null); }}>
          <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{selectedDetailUser.name}</h3>
                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Cronograma Semanal de Atividades</p>
              </div>
              <button onClick={() => setSelectedDetailUser(null)} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm transition-all"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-12 no-scrollbar">
              {['HAB', 'HABA'].map((unitKey) => {
                const currentStat = chaplainStats.find(s => s.user.id === selectedDetailUser.id);
                if (!currentStat) return null;
                const uStat = unitKey === 'HAB' ? currentStat.hab : currentStat.haba;
                if (uStat.total === 0) return null;
                return (
                  <div key={unitKey} className="space-y-8">
                    <h4 className="text-[12px] font-black uppercase tracking-[0.5em] text-slate-300 text-center flex items-center gap-4">
                      <div className="h-[1px] bg-slate-100 flex-1"></div>
                      Unidade {unitKey}
                      <div className="h-[1px] bg-slate-100 flex-1"></div>
                    </h4>
                    
                    <AccordionSection title="Estudos Bíblicos" items={uStat.rawStudies} colorClass="bg-blue-50/50" />
                    <AccordionSection title="Classes Bíblicas" items={uStat.rawClasses} colorClass="bg-indigo-50/50" />
                    <AccordionSection title="Pequenos Grupos" items={uStat.rawGroups} colorClass="bg-emerald-50/50" />
                    <AccordionSection title="Visitas a Colaboradores" items={uStat.rawVisits} colorClass="bg-rose-50/50" />
                  </div>
                );
              })}
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-center">
               <button onClick={() => setSelectedDetailUser(null)} className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest active:scale-95 transition-all">Fechar Detalhamento (Esc)</button>
            </div>
          </div>
        </div>
      )}

      {showPdfPreview && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[950] flex items-center justify-center p-4 overflow-y-auto" onClick={(e) => { if(e.target === e.currentTarget) setShowPdfPreview(false); }}>
          <div className="bg-white w-full max-w-5xl my-auto rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center no-print bg-slate-50/80">
              <h2 className="text-xl font-black text-slate-800 uppercase">Pré-visualização do Relatório Oficial</h2>
              <div className="flex items-center gap-3">
                <button onClick={handlePrintIsolated} className="px-8 py-3.5 bg-slate-900 text-white font-black rounded-xl shadow-2xl uppercase text-[12px] tracking-widest hover:bg-black transition-all">Imprimir Relatório</button>
                <button onClick={() => setShowPdfPreview(false)} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm transition-all"><i className="fas fa-times"></i></button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-4 md:p-10 overflow-y-auto no-scrollbar"><PdfTemplate /></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
