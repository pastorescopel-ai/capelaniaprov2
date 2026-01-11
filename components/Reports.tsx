// ############################################################
// # VERSION: 1.0.8-RESTORE (PDF CHART + DETAILED MODAL)
// # STATUS: VERIFIED & FUNCTIONAL
// # DATE: 2025-04-10
// ############################################################

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
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
          const unitVisits = uVisits.filter(v => v.unit === unit);
          
          const unitUniqueNames = new Set<string>();
          unitStudies.forEach(s => { if (s.name) unitUniqueNames.add(s.name.trim().toLowerCase()); });
          unitClasses.forEach(c => { if (Array.isArray(c.students)) c.students.forEach(n => unitUniqueNames.add(n.trim().toLowerCase())); });

          return {
              students: unitUniqueNames.size,
              studies: unitStudies.length,
              classes: unitClasses.length,
              groups: unitGroups.length,
              visits: unitVisits.length,
              total: unitStudies.length + unitClasses.length + unitGroups.length + unitVisits.length,
              rawStudies: unitStudies,
              rawClasses: unitClasses
          };
      };

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
        totalActions: uStudies.length + uClasses.length + uVisits.length + uGroups.length,
        rawStudies: uStudies,
        rawClasses: uClasses
      };
    }).filter(s => {
        if (selectedChaplain !== 'all') return s.user.id === selectedChaplain;
        return s.totalActions > 0 || s.students > 0;
    }).sort((a, b) => b.totalActions - a.totalActions);
  }, [users, filteredData, selectedChaplain]);

  const summaryCards = [
    { label: 'Alunos Únicos', val: totalStats.totalStudents, icon: 'fa-user-graduate', color: 'bg-blue-600' },
    { label: 'Estudos Bíblicos', val: totalStats.studies, icon: 'fa-book', color: 'bg-blue-500' },
    { label: 'Classes Bíblicas', val: totalStats.classes, icon: 'fa-users', color: 'bg-indigo-500' },
    { label: 'Pequenos Grupos', val: totalStats.groups, icon: 'fa-house-user', color: 'bg-emerald-500' },
    { label: 'Visitas Colab.', val: totalStats.visits, icon: 'fa-handshake', color: 'bg-rose-500' },
  ];

  const chartData = [
    { name: 'Alunos', value: totalStats.totalStudents, color: '#2563eb' },
    { name: 'Estudos', value: totalStats.studies, color: '#3b82f6' },
    { name: 'Classes', value: totalStats.classes, color: '#6366f1' },
    { name: 'PGs', value: totalStats.groups, color: '#10b981' },
    { name: 'Visitas', value: totalStats.visits, color: '#f43f5e' },
  ];

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-500">
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Relatórios e Estatísticas</h1>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onRefresh && onRefresh()} className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl flex items-center gap-3 uppercase text-[10px] tracking-widest active:scale-95 hover:bg-emerald-700">
              <i className="fas fa-sync-alt"></i> Sincronizar Banco
            </button>
            <button onClick={() => setShowPdfPreview(true)} className="px-8 py-4 bg-[#005a9c] text-white font-black rounded-2xl shadow-xl flex items-center gap-3 uppercase text-[10px] tracking-widest active:scale-95">
              <i className="fas fa-file-pdf"></i> Gerar Relatório PDF
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-[2.5rem]">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Início</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Fim</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Capelão</label>
            <select value={selectedChaplain} onChange={e => setSelectedChaplain(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs">
              <option value="all">Todos os Capelães</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Unidade</label>
            <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value as any)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs">
              <option value="all">Unidades HAB + HABA</option>
              <option value={Unit.HAB}>Unidade HAB</option>
              <option value={Unit.HABA}>Unidade HABA</option>
            </select>
          </div>
        </div>

        {/* Cards de Resumo Azul */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {summaryCards.map((card, i) => (
            <div key={i} className={`${card.color} p-6 rounded-[2.5rem] text-white shadow-xl shadow-blue-100/20 group hover:scale-[1.03] transition-all`}>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-xl shadow-inner"><i className={`fas ${card.icon}`}></i></div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-70 leading-none">{card.label}</p>
                  <p className="text-3xl font-black leading-none">{card.val}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lista de Capelães Clicável */}
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter flex items-center gap-3">
          <i className="fas fa-id-card-alt text-blue-600"></i> Desempenho por Capelão
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {chaplainStats.map((stat, idx) => (
            <div 
              key={idx} 
              onClick={() => setSelectedDetailUser(stat.user)}
              className="p-6 bg-slate-50 rounded-[2.5rem] border-2 border-transparent hover:border-blue-200 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 text-2xl font-black shadow-sm border border-slate-100 group-hover:shadow-md transition-shadow">
                  {stat.name[0]}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 uppercase tracking-tight leading-none">{stat.name}</h4>
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">Total: {stat.totalActions} Ações</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-3 rounded-xl border border-slate-100">
                  <span className="block text-[8px] font-black text-slate-400 uppercase leading-none">Alunos</span>
                  <span className="text-lg font-black text-slate-800">{stat.students}</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100">
                  <span className="block text-[8px] font-black text-slate-400 uppercase leading-none">Estudos</span>
                  <span className="text-lg font-black text-slate-800">{stat.studies}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Detalhes do Capelão Selecionado */}
      {selectedDetailUser && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[900] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-4xl rounded-[3rem] p-10 space-y-8 animate-in zoom-in duration-300 relative overflow-hidden flex flex-col max-h-[90vh]">
              <button onClick={() => setSelectedDetailUser(null)} className="absolute top-8 right-8 w-12 h-12 bg-slate-50 rounded-2xl text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center z-10"><i className="fas fa-times"></i></button>
              
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-blue-200">{selectedDetailUser.name[0]}</div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{selectedDetailUser.name}</h3>
                  <p className="text-slate-400 font-bold">{selectedDetailUser.email}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-8">
                {/* Atividades Detalhadas por Unidade */}
                {['HAB', 'HABA'].map(u => {
                  const stat = chaplainStats.find(s => s.user.id === selectedDetailUser.id)?.[u.toLowerCase() as 'hab' | 'haba'];
                  if (!stat || (stat.studies === 0 && stat.classes === 0)) return null;

                  return (
                    <div key={u} className="space-y-6">
                      <div className="flex items-center gap-3 border-b-2 border-slate-100 pb-2">
                        <i className={`fas fa-hospital text-xl ${u === 'HAB' ? 'text-blue-500' : 'text-indigo-500'}`}></i>
                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Atividades Unidade {u}</h4>
                      </div>

                      {stat.rawStudies.length > 0 && (
                        <div className="space-y-3">
                          <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] ml-2">Estudos Bíblicos</h5>
                          <div className="grid gap-3">
                            {stat.rawStudies.map((item, idx) => (
                              <div key={idx} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-blue-200 transition-all">
                                <div className="space-y-1">
                                  <p className="font-black text-slate-800 uppercase text-sm">{item.name}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{item.sector}</p>
                                </div>
                                <div className="text-right space-y-1">
                                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">{item.guide}</p>
                                  <p className="text-xs font-black text-slate-700">Lição {item.lesson}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {stat.rawClasses.length > 0 && (
                        <div className="space-y-3">
                          <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] ml-2">Classes Bíblicas</h5>
                          <div className="grid gap-3">
                            {stat.rawClasses.map((item, idx) => (
                              <div key={idx} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-all">
                                <div className="space-y-1 max-w-[60%]">
                                  <p className="font-black text-slate-800 uppercase text-xs line-clamp-1">{item.students.join(', ')}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{item.sector}</p>
                                </div>
                                <div className="text-right space-y-1">
                                  <p className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">{item.guide}</p>
                                  <p className="text-xs font-black text-slate-700">Lição {item.lesson}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
           </div>
        </div>
      )}

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
            <div className="p-8 border-b border-slate-100 flex justify-between items-center no-print">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center"><i className="fas fa-file-pdf"></i></div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Visualização de Impressão</h2>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="px-8 py-3.5 bg-[#005a9c] text-white font-black rounded-xl shadow-2xl uppercase text-[12px] tracking-widest active:scale-95 transition-all flex items-center gap-3">
                  <i className="fas fa-print"></i> Imprimir Agora
                </button>
                <button onClick={() => setShowPdfPreview(false)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all"><i className="fas fa-times"></i></button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-4 md:p-10 overflow-y-auto no-scrollbar">
              <div id="pdf-content" className="bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[15mm] flex flex-col gap-6 text-slate-900 border border-slate-100">
                
                {/* CABEÇALHO DENTRO DO PDF */}
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

                <section className="space-y-8 mt-4">
                   {/* Gráfico de Barras no PDF */}
                   <div className="w-full bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <h3 className="text-[11px] font-black uppercase text-[#005a9c] mb-6 text-center tracking-widest">Resumo Estatístico Consolidado</h3>
                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                              {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                              <LabelList dataKey="value" position="top" style={{ fontSize: '10px', fontWeight: '900', fill: '#0f172a' }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                   </div>

                   {(selectedUnit === 'all' || selectedUnit === Unit.HAB) && (
                    <div>
                      <h3 className="text-[11px] font-black uppercase text-[#005a9c] mb-3 border-b-2 border-slate-100 pb-1 flex items-center gap-2">
                        <i className="fas fa-hospital"></i> Tabela de Atividades - Unidade HAB
                      </h3>
                      <table className="w-full text-left text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-[#005a9c] text-white font-black uppercase">
                            <th className="p-3">Capelão</th>
                            <th className="p-3 text-center">Alunos Únicos</th>
                            <th className="p-3 text-center">Estudos</th>
                            <th className="p-3 text-center">Classes</th>
                            <th className="p-3 text-center">PGs</th>
                            <th className="p-3 text-center">Visitas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {chaplainStats.filter(s => s.hab.total > 0 || s.hab.students > 0).map((stat, idx) => (
                            <tr key={`hab-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-3 font-bold text-slate-700 uppercase tracking-tight">{stat.name}</td>
                              <td className="p-3 text-center font-bold text-slate-800">{stat.hab.students}</td>
                              <td className="p-3 text-center font-bold text-blue-600">{stat.hab.studies}</td>
                              <td className="p-3 text-center font-bold text-indigo-600">{stat.hab.classes}</td>
                              <td className="p-3 text-center font-bold text-emerald-600">{stat.hab.groups}</td>
                              <td className="p-3 text-center font-bold text-rose-600">{stat.hab.visits}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(selectedUnit === 'all' || selectedUnit === Unit.HABA) && (
                    <div className="mt-4">
                      <h3 className="text-[11px] font-black uppercase text-[#005a9c] mb-3 border-b-2 border-slate-100 pb-1 flex items-center gap-2">
                        <i className="fas fa-hospital-alt"></i> Tabela de Atividades - Unidade HABA
                      </h3>
                      <table className="w-full text-left text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-[#005a9c] text-white font-black uppercase">
                            <th className="p-3">Capelão</th>
                            <th className="p-3 text-center">Alunos Únicos</th>
                            <th className="p-3 text-center">Estudos</th>
                            <th className="p-3 text-center">Classes</th>
                            <th className="p-3 text-center">PGs</th>
                            <th className="p-3 text-center">Visitas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {chaplainStats.filter(s => s.haba.total > 0 || s.haba.students > 0).map((stat, idx) => (
                            <tr key={`haba-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-3 font-bold text-slate-700 uppercase tracking-tight">{stat.name}</td>
                              <td className="p-3 text-center font-bold text-slate-800">{stat.haba.students}</td>
                              <td className="p-3 text-center font-bold text-blue-600">{stat.haba.studies}</td>
                              <td className="p-3 text-center font-bold text-indigo-600">{stat.haba.classes}</td>
                              <td className="p-3 text-center font-bold text-emerald-600">{stat.haba.groups}</td>
                              <td className="p-3 text-center font-bold text-rose-600">{stat.haba.visits}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <footer className="mt-auto border-t-2 border-slate-100 pt-4 flex flex-col gap-4">
                  <div className="flex justify-between items-center text-[8px] font-black text-slate-300 uppercase italic">
                    <span>Sistema de Gestão Capelania Hospitalar v1.0.8</span>
                    <span>Documento Oficial de Registro de Atividades</span>
                  </div>
                  <div className="flex justify-center gap-20 pt-8 opacity-40">
                    <div className="text-center">
                      <div className="w-48 border-b border-slate-400 mb-1"></div>
                      <p className="text-[8px] font-bold text-slate-500 uppercase">Responsável pela Emissão</p>
                    </div>
                    <div className="text-center">
                      <div className="w-48 border-b border-slate-400 mb-1"></div>
                      <p className="text-[8px] font-bold text-slate-500 uppercase">Gestor da Unidade</p>
                    </div>
                  </div>
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