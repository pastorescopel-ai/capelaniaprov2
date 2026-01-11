
// ############################################################
// # VERSION: 1.0.6-STABLE (RESTORE POINT)
// # STATUS: VERIFIED & FUNCTIONAL
// # DATE: 2025-04-10
// ############################################################

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Unit, RecordStatus, Config } from '../types';

interface ReportsProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  users: User[];
  config: Config;
  onRefresh?: () => Promise<void>;
}

const Reports: React.FC<ReportsProps> = ({ studies, classes, groups, visits, users, config, onRefresh }) => {
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [selectedDetailUser, setSelectedDetailUser] = useState<User | null>(null);
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedChaplain, setSelectedChaplain] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState<'all' | Unit>('all');

  const filteredData = useMemo(() => {
    const sList = Array.isArray(studies) ? studies : [];
    const cList = Array.isArray(classes) ? classes : [];
    const gList = Array.isArray(groups) ? groups : [];
    const vList = Array.isArray(visits) ? visits : [];

    const filterFn = (item: any) => {
      if (!item || !item.date) return false;
      const dateMatch = item.date >= startDate && item.date <= endDate;
      const chaplainMatch = selectedChaplain === 'all' || item.userId === selectedChaplain;
      const itemUnit = item.unit || Unit.HAB;
      const unitMatch = selectedUnit === 'all' || itemUnit === selectedUnit;
      return dateMatch && chaplainMatch && unitMatch;
    };

    return {
      studies: sList.filter(filterFn),
      classes: cList.filter(filterFn),
      groups: gList.filter(filterFn),
      visits: vList.filter(filterFn),
    };
  }, [studies, classes, groups, visits, startDate, endDate, selectedChaplain, selectedUnit]);

  const totalStats = useMemo(() => {
    const uniqueStudents = new Set<string>();
    
    filteredData.studies.forEach(s => {
      if (s.name) uniqueStudents.add(s.name.trim().toLowerCase());
    });

    filteredData.classes.forEach(c => {
      if (Array.isArray(c.students)) {
        c.students.forEach(name => uniqueStudents.add(name.trim().toLowerCase()));
      }
    });

    return {
      studies: filteredData.studies.length,
      classes: filteredData.classes.length,
      groups: filteredData.groups.length,
      visits: filteredData.visits.length,
      totalStudents: uniqueStudents.size,
      totalAll: filteredData.studies.length + filteredData.classes.length + filteredData.groups.length + filteredData.visits.length
    };
  }, [filteredData]);

  const chaplainStats = useMemo(() => {
    const uList = Array.isArray(users) ? users : [];

    return uList.map(user => {
      const uStudies = filteredData.studies.filter(s => s.userId === user.id);
      const uClasses = filteredData.classes.filter(c => c.userId === user.id);
      const uVisits = filteredData.visits.filter(v => v.userId === user.id);
      const uGroups = filteredData.groups.filter(g => g.userId === user.id);
      
      const uniqueNames = new Set<string>();
      uStudies.forEach(s => { if (s.name) uniqueNames.add(s.name.trim().toLowerCase()); });
      uClasses.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(n => uniqueNames.add(n.trim().toLowerCase())); });

      const getUnitStats = (unit: Unit) => {
          const unitStudies = uStudies.filter(s => s.unit === unit);
          const unitClasses = uClasses.filter(c => c.unit === unit);
          const unitGroups = uGroups.filter(g => g.unit === unit);
          const unitVisits = uVisits.filter(v => v.userId === user.id && v.unit === unit);
          
          const unitUniqueNames = new Set<string>();
          unitStudies.forEach(s => { if (s.name) unitUniqueNames.add(s.name.trim().toLowerCase()); });
          unitClasses.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(n => unitUniqueNames.add(n.trim().toLowerCase())); });

          return {
              students: unitUniqueNames.size,
              studies: unitStudies.length,
              classes: unitClasses.length,
              groups: unitGroups.length,
              visits: unitVisits.length,
              total: unitStudies.length + unitClasses.length + unitGroups.length + unitVisits.length
          };
      };

      const totalActions = uStudies.length + uClasses.length + uVisits.length + uGroups.length;

      return { 
        user, 
        name: user.name || "Sem Nome", 
        students: uniqueNames.size, 
        studies: uStudies.length, 
        classes: uClasses.length, 
        visits: uVisits.length, 
        groups: uGroups.length,
        hab: getUnitStats(Unit.HAB),
        haba: getUnitStats(Unit.HABA),
        totalActions 
      };
    }).filter(s => {
        if (selectedChaplain !== 'all') return s.user.id === selectedChaplain;
        return s.totalActions > 0 || s.students > 0;
    }).sort((a, b) => b.totalActions - a.totalActions);
  }, [users, filteredData, selectedChaplain]);

  const activityPieData = [
    { name: 'Estudos', value: totalStats.studies, color: '#3b82f6' },
    { name: 'Classes', value: totalStats.classes, color: '#6366f1' },
    { name: 'PGs', value: totalStats.groups, color: '#10b981' },
    { name: 'Visitas', value: totalStats.visits, color: '#f43f5e' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-500">
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <h1 className="text-3xl font-black text-slate-800">Painel de Relatórios</h1>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onRefresh && onRefresh()} className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl flex items-center gap-3 uppercase text-[10px] tracking-widest active:scale-95 hover:bg-emerald-700">
              <i className="fas fa-sync-alt"></i> Sincronizar Banco
            </button>
            <button onClick={() => setShowPdfPreview(true)} className="px-8 py-4 bg-[#005a9c] text-white font-black rounded-2xl shadow-xl flex items-center gap-3 uppercase text-[10px] tracking-widest active:scale-95">
              <i className="fas fa-file-pdf"></i> Imprimir Relatório
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-[2.5rem]">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Início</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Fim</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Capelão</label>
            <select value={selectedChaplain} onChange={e => setSelectedChaplain(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs">
              <option value="all">Todos</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Unidade</label>
            <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value as any)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs">
              <option value="all">Ambas</option>
              <option value={Unit.HAB}>HAB</option>
              <option value={Unit.HABA}>HABA</option>
            </select>
          </div>
        </div>
      </section>

      {/* Preview PDF */}
      {showPdfPreview && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[950] flex items-center justify-center p-4 overflow-y-auto">
          <style>
            {`
              @media print {
                @page { size: A4; margin: 0 !important; }
                html, body { margin: 0 !important; padding: 0 !important; overflow: visible !important; }
                body * { visibility: hidden !important; }
                #pdf-content, #pdf-content * { visibility: visible !important; }
                #pdf-content { 
                  position: absolute !important; 
                  top: 0 !important; 
                  left: 0 !important; 
                  width: 210mm !important; 
                  padding: 15mm !important; 
                  background: white !important;
                }
                .no-print { display: none !important; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .bg-\\[\\#005a9c\\], table thead tr { background-color: #005a9c !important; box-shadow: inset 0 0 0 1000px #005a9c !important; }
              }
            `}
          </style>

          <div className="bg-white w-full max-w-5xl my-auto rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center no-print" style={{ zIndex: 9999, position: 'relative' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                  <i className="fas fa-file-pdf"></i>
                </div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Preview de Relatório</h2>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="px-8 py-3.5 bg-[#005a9c] text-white font-black rounded-xl shadow-2xl uppercase text-[12px] tracking-widest active:scale-95 transition-all flex items-center gap-3">
                  <i className="fas fa-print"></i> Imprimir
                </button>
                <button onClick={() => setShowPdfPreview(false)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-4 md:p-10 overflow-y-auto no-scrollbar">
              <div id="pdf-content" className="bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[15mm] flex flex-col gap-6 text-slate-900 border border-slate-100">
                
                {/* CABEÇALHO CUSTOMIZÁVEL - POSICIONAMENTO ABSOLUTO FIDEDIGNO */}
                <header className="relative border-b-4 border-[#005a9c]" style={{ height: '140px' }}>
                  {config.reportLogo && (
                    <img 
                      src={config.reportLogo} 
                      style={{ 
                        position: 'absolute',
                        left: `${config.reportLogoX}px`, 
                        top: `${config.reportLogoY}px`,
                        width: `${config.reportLogoWidth}px` 
                      }} 
                      alt="Logo" 
                    />
                  )}
                  
                  <div style={{ position: 'absolute', left: `${config.headerLine1X}px`, top: `${config.headerLine1Y}px`, width: '300px', textAlign: 'center' }}>
                    <h1 style={{fontSize: `${config.fontSize1}px`, color: '#005a9c', margin: 0}} className="font-black uppercase">{config.headerLine1}</h1>
                  </div>

                  <div style={{ position: 'absolute', left: `${config.headerLine2X}px`, top: `${config.headerLine2Y}px`, width: '300px', textAlign: 'center' }}>
                    <h2 style={{fontSize: `${config.fontSize2}px`, margin: 0}} className="font-bold text-slate-600 uppercase">{config.headerLine2}</h2>
                  </div>

                  <div style={{ position: 'absolute', left: `${config.headerLine3X}px`, top: `${config.headerLine3Y}px`, width: '300px', textAlign: 'center' }}>
                    <h3 style={{fontSize: `${config.fontSize3}px`, margin: 0}} className="font-medium text-slate-400 uppercase">{config.headerLine3}</h3>
                  </div>

                  <div style={{ position: 'absolute', right: 0, top: '10px', textAlign: 'right' }}>
                    <p className="text-[9px] font-bold uppercase text-slate-400">Emissão: {new Date().toLocaleDateString()}</p>
                    <p className="text-[8px] font-black text-blue-600 uppercase">Unidade: {selectedUnit === 'all' ? 'HAB + HABA' : selectedUnit}</p>
                  </div>
                </header>

                <section className="space-y-6 mt-4">
                   {/* Conteúdo das Tabelas e Gráficos do Relatório */}
                   {(selectedUnit === 'all' || selectedUnit === Unit.HAB) && (
                    <div>
                      <h3 className="text-[11px] font-black uppercase text-[#005a9c] mb-3 border-b border-slate-100 pb-1 italic">Resumo de Atividades - Unidade HAB</h3>
                      <table className="w-full text-left text-[8px] border-collapse shadow-sm">
                        <thead>
                          <tr className="bg-[#005a9c] text-white uppercase font-black">
                            <th className="p-2">Capelão</th>
                            <th className="p-2 text-center">Total Estudantes</th>
                            <th className="p-2 text-center">Estudos</th>
                            <th className="p-2 text-center">Classes</th>
                            <th className="p-2 text-center">PGs</th>
                            <th className="p-2 text-center">Visitas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {chaplainStats.filter(s => s.hab.total > 0 || s.hab.students > 0).map((stat, idx) => (
                            <tr key={`hab-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-2 font-bold text-slate-700">{stat.name}</td>
                              <td className="p-2 text-center font-bold text-slate-800">{stat.hab.students}</td>
                              <td className="p-2 text-center font-bold text-blue-600">{stat.hab.studies}</td>
                              <td className="p-2 text-center font-bold text-indigo-600">{stat.hab.classes}</td>
                              <td className="p-2 text-center font-bold text-emerald-600">{stat.hab.groups}</td>
                              <td className="p-2 text-center font-bold text-rose-600">{stat.hab.visits}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(selectedUnit === 'all' || selectedUnit === Unit.HABA) && (
                    <div>
                      <h3 className="text-[11px] font-black uppercase text-[#005a9c] mb-3 border-b border-slate-100 pb-1 italic">Resumo de Atividades - Unidade HABA</h3>
                      <table className="w-full text-left text-[8px] border-collapse shadow-sm">
                        <thead>
                          <tr className="bg-[#005a9c] text-white uppercase font-black">
                            <th className="p-2">Capelão</th>
                            <th className="p-2 text-center">Total Estudantes</th>
                            <th className="p-2 text-center">Estudos</th>
                            <th className="p-2 text-center">Classes</th>
                            <th className="p-2 text-center">PGs</th>
                            <th className="p-2 text-center">Visitas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {chaplainStats.filter(s => s.haba.total > 0 || s.haba.students > 0).map((stat, idx) => (
                            <tr key={`haba-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-2 font-bold text-slate-700">{stat.name}</td>
                              <td className="p-2 text-center font-bold text-slate-800">{stat.haba.students}</td>
                              <td className="p-2 text-center font-bold text-blue-600">{stat.haba.studies}</td>
                              <td className="p-2 text-center font-bold text-indigo-600">{stat.haba.classes}</td>
                              <td className="p-2 text-center font-bold text-emerald-600">{stat.haba.groups}</td>
                              <td className="p-2 text-center font-bold text-rose-600">{stat.haba.visits}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <footer className="mt-auto border-t border-slate-100 pt-2 flex justify-between text-[7px] font-bold text-slate-300 uppercase italic">
                  <span>Gerado pelo Sistema Capelania Pro</span>
                  <span>{new Date().toLocaleString()}</span>
                </footer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
