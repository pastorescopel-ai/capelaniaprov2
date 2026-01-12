
// ############################################################
// # VERSION: 1.0.7-FILTER-INTEGRITY (STABLE)
// # STATUS: CLICKABLE CARDS + FULL FILTER SYNC
// ############################################################

import React, { useState, useMemo } from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Unit, RecordStatus, Config } from '../types';
import { REPORT_LOGO_BASE64 } from '../constants';

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
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedChaplain, setSelectedChaplain] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState<'all' | Unit>('all');

  const pColor = config.primaryColor || '#005a9c';

  // DADOS FILTRADOS POR PERÍODO, UNIDADE E CAPELÃO
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

  // ESTATÍSTICAS TOTAIS RESPEITANDO OS FILTROS
  const totalStats = useMemo(() => {
    const uniqueStudentsInFilter = new Set<string>();
    
    filteredData.studies.forEach(s => {
      if (s.name) uniqueStudentsInFilter.add(s.name.trim().toLowerCase());
    });
    
    filteredData.classes.forEach(c => {
      if (Array.isArray(c.students)) {
        c.students.forEach(name => {
          if (name) uniqueStudentsInFilter.add(name.trim().toLowerCase());
        });
      }
    });

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

      const missingForms = [];
      if (uStudiesFiltered.length === 0) missingForms.push("Estudo Bíblico");
      if (uClassesFiltered.length === 0) missingForms.push("Classe Bíblica");
      if (uGroupsFiltered.length === 0) missingForms.push("Pequeno Grupo");
      if (uVisitsFiltered.length === 0) missingForms.push("Visita Colaborador");

      const totalActions = uStudiesFiltered.length + uClassesFiltered.length + uVisitsFiltered.length + uGroupsFiltered.length;
      
      let flag = null;
      if (totalActions === 0) flag = 'red';
      else if (missingForms.length > 0) flag = 'yellow';

      const getUnitStats = (unit: Unit) => {
          const unitStudies = uStudiesFiltered.filter(s => (s.unit || Unit.HAB) === unit);
          const unitClasses = uClassesFiltered.filter(c => (c.unit || Unit.HAB) === unit);
          const unitGroups = uGroupsFiltered.filter(g => (g.unit || Unit.HAB) === unit);
          const unitVisits = uVisitsFiltered.filter(v => (v.unit || Unit.HAB) === unit);
          
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
              rawStudies: unitStudies.sort((a,b) => b.createdAt - a.createdAt),
              rawClasses: unitClasses.sort((a,b) => b.createdAt - a.createdAt)
          };
      };

      return { 
        user: userObj, name: userObj.name, students: uniqueNames.size, 
        studies: uStudiesFiltered.length, classes: uClassesFiltered.length, 
        visits: uVisitsFiltered.length, groups: uGroupsFiltered.length,
        hab: getUnitStats(Unit.HAB), haba: getUnitStats(Unit.HABA), 
        totalActions, flag, missingForms
      };
    })
    .filter(s => selectedChaplain === 'all' || s.user.id === selectedChaplain)
    .sort((a, b) => b.totalActions - a.totalActions);
  }, [users, filteredData, selectedChaplain]);

  const handlePrintIsolated = () => {
    const printContent = document.getElementById('pdf-root');
    if (!printContent) return;
    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) return;
    const styles = Array.from(document.querySelectorAll('link, style')).map(s => s.outerHTML).join('\n');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Capelania Hospitalar - Filtro Ativo</title>
          ${styles}
          <style>
            @media print {
              @page { size: A4; margin: 0mm !important; }
              html, body { margin: 0 !important; padding: 0 !important; width: 210mm !important; background: white !important; }
              .no-print { display: none !important; }
            }
            body { background: #f1f5f9; display: flex; justify-content: center; padding: 20px 0; margin: 0; }
            #pdf-isolated-container { background: white !important; width: 210mm !important; min-height: 297mm !important; padding: 15mm !important; box-shadow: 0 0 40px rgba(0,0,0,0.1); }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          </style>
        </head>
        <body>
          <div id="pdf-isolated-container">${printContent.innerHTML}</div>
          <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 800); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const summaryCards = [
    { label: 'Alunos no Período', val: totalStats.totalStudents, icon: 'fa-user-graduate', color: 'bg-blue-600' },
    { label: 'Estudos Bíblicos', val: totalStats.studies, icon: 'fa-book', color: 'bg-blue-500' },
    { label: 'Classes Bíblicas', val: totalStats.classes, icon: 'fa-users', color: 'bg-indigo-500' },
    { label: 'Pequenos Grupos', val: totalStats.groups, icon: 'fa-house-user', color: 'bg-emerald-500' },
    { label: 'Visitas Colab.', val: totalStats.visits, icon: 'fa-handshake', color: 'bg-rose-500' },
  ];

  const PdfTemplate = () => (
    <div id="pdf-root" className="bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto p-[15mm] flex flex-col gap-6 text-slate-900 border border-slate-100">
      <header className="relative border-b-4 flex-shrink-0" style={{ height: '140px', borderColor: pColor }}>
        {REPORT_LOGO_BASE64 && <img src={REPORT_LOGO_BASE64} style={{ position: 'absolute', left: `${config.reportLogoX}px`, top: `${config.reportLogoY}px`, width: `${config.reportLogoWidth}px`, zIndex: 10 }} alt="Logo" />}
        <div style={{ position: 'absolute', left: `${config.headerLine1X}px`, top: `${config.headerLine1Y}px`, width: '450px', textAlign: config.headerTextAlign }}>
          <h1 style={{ fontSize: `${config.fontSize1}px`, color: pColor }} className="font-black uppercase m-0">{config.headerLine1}</h1>
        </div>
        <div style={{ position: 'absolute', left: `${config.headerLine2X}px`, top: `${config.headerLine2Y}px`, width: '450px', textAlign: config.headerTextAlign }}>
          <h2 style={{ fontSize: `${config.fontSize2}px` }} className="font-bold text-slate-600 uppercase m-0">{config.headerLine2}</h2>
        </div>
        <div style={{ position: 'absolute', left: `${config.headerLine3X}px`, top: `${config.headerLine3Y}px`, width: '450px', textAlign: config.headerTextAlign }}>
          <h3 style={{ fontSize: `${config.fontSize3}px` }} className="font-medium text-slate-400 uppercase m-0">{config.headerLine3}</h3>
        </div>
        <div style={{ position: 'absolute', right: 0, top: '10px', textAlign: 'right' }}>
          <p className="text-[9px] font-bold uppercase text-slate-300">Emissão: {new Date().toLocaleDateString()}</p>
          <p className="text-[8px] font-black uppercase" style={{ color: pColor }}>Filtro: {startDate.split('-').reverse().join('/')} a {endDate.split('-').reverse().join('/')}</p>
        </div>
      </header>

      <section className="space-y-10 mt-4 flex-1">
        {(selectedUnit === 'all' || selectedUnit === Unit.HAB) && (
          <div className="space-y-4">
            <h3 className="text-[11px] font-black uppercase border-b-2 border-slate-100 pb-1 flex items-center gap-2" style={{ color: pColor }}><i className="fas fa-hospital"></i> Atividades HAB</h3>
            <table className="w-full text-left text-[9px] border-collapse">
              <thead>
                <tr className="text-white font-black uppercase" style={{ backgroundColor: pColor }}>
                  <th className="p-3">Capelão</th>
                  <th className="p-3 text-center">Alunos</th>
                  <th className="p-3 text-center">Estudos</th>
                  <th className="p-3 text-center">Classes</th>
                  <th className="p-3 text-center">PGs</th>
                  <th className="p-3 text-center">Visitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chaplainStats.map((stat, idx) => (
                  <tr key={`hab-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-3 font-bold text-slate-700 uppercase">{stat.name}</td>
                    <td className="p-3 text-center font-black text-sm text-slate-900">{stat.hab.students}</td>
                    <td className="p-3 text-center font-black text-sm text-blue-800">{stat.hab.studies}</td>
                    <td className="p-3 text-center font-black text-sm text-indigo-800">{stat.hab.classes}</td>
                    <td className="p-3 text-center font-black text-sm text-emerald-800">{stat.hab.groups}</td>
                    <td className="p-3 text-center font-black text-sm text-rose-800">{stat.hab.visits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(selectedUnit === 'all' || selectedUnit === Unit.HABA) && (
          <div className="space-y-4">
            <h3 className="text-[11px] font-black uppercase border-b-2 border-slate-100 pb-1 flex items-center gap-2" style={{ color: pColor }}><i className="fas fa-hospital-alt"></i> Atividades HABA</h3>
            <table className="w-full text-left text-[9px] border-collapse">
              <thead>
                <tr className="text-white font-black uppercase" style={{ backgroundColor: pColor }}>
                  <th className="p-3">Capelão</th>
                  <th className="p-3 text-center">Alunos</th>
                  <th className="p-3 text-center">Estudos</th>
                  <th className="p-3 text-center">Classes</th>
                  <th className="p-3 text-center">PGs</th>
                  <th className="p-3 text-center">Visitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chaplainStats.map((stat, idx) => (
                  <tr key={`haba-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-3 font-bold text-slate-700 uppercase">{stat.name}</td>
                    <td className="p-3 text-center font-black text-sm text-slate-900">{stat.haba.students}</td>
                    <td className="p-3 text-center font-black text-sm text-blue-800">{stat.haba.studies}</td>
                    <td className="p-3 text-center font-black text-sm text-indigo-800">{stat.haba.classes}</td>
                    <td className="p-3 text-center font-black text-sm text-emerald-800">{stat.haba.groups}</td>
                    <td className="p-3 text-center font-black text-sm text-rose-800">{stat.haba.visits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-8 border-t-2 border-slate-100 page-break-inside-avoid">
          <h3 className="text-[11px] font-black uppercase mb-6 text-center tracking-widest" style={{ color: pColor }}>Resumo Geral do Período</h3>
          <div className="grid grid-cols-5 gap-3">
            <div className="p-4 rounded-xl text-white text-center shadow-lg border" style={{ backgroundColor: pColor, borderColor: pColor }}>
              <p className="text-[7px] font-black uppercase tracking-widest opacity-80 mb-1 leading-none">Total Alunos</p>
              <p className="text-2xl font-black leading-none">{totalStats.totalStudents}</p>
            </div>
            {[
              { label: 'Estudos', val: totalStats.studies },
              { label: 'Classes', val: totalStats.classes },
              { label: 'P. Grupos', val: totalStats.groups },
              { label: 'Visitas', val: totalStats.visits }
            ].map((s, i) => (
              <div key={i} className="bg-slate-50 p-4 rounded-xl text-slate-800 border border-slate-100 text-center">
                <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-none">{s.label}</p>
                <p className="text-xl font-black leading-none">{s.val}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t-2 border-slate-100 pt-4 flex flex-col gap-4 flex-shrink-0">
        <div className="flex justify-between items-center text-[8px] font-black text-slate-300 uppercase italic">
          <span>Capelania Hospitalar Pro - Auditoria: {config.lastModifiedBy || 'Admin'}</span>
          <span>SISTEMA ESTÁVEL V2.0</span>
        </div>
      </footer>
    </div>
  );

  const currentDetailStat = chaplainStats.find(s => s.user.id === selectedDetailUser?.id);

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-500">
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Relatórios e Estatísticas</h1>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onRefresh && onRefresh()} className="px-6 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95">
              <i className="fas fa-sync-alt"></i> Sincronizar
            </button>
            <button onClick={handlePrintIsolated} className="px-6 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95">
              <i className="fas fa-print"></i> Impressão Direta
            </button>
            <button onClick={() => setShowPdfPreview(true)} className="px-6 py-4 text-white font-black rounded-2xl shadow-xl flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95" style={{ backgroundColor: pColor }}>
              <i className="fas fa-file-pdf"></i> Visualizar PDF
            </button>
          </div>
        </div>

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
              <option value="all">Todas as Unidades</option>
              <option value={Unit.HAB}>HAB</option>
              <option value={Unit.HABA}>HABA</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {summaryCards.map((card, i) => (
            <div key={i} className={`${card.color} p-6 rounded-[2.5rem] text-white shadow-xl`}>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-lg shadow-inner"><i className={`fas ${card.icon}`}></i></div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-70 leading-none">{card.label}</p>
                  <p className="text-2xl font-black leading-none">{card.val}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter flex items-center gap-3">
          <i className="fas fa-id-card-alt" style={{ color: pColor }}></i> Monitoramento da Equipe
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {chaplainStats.map((stat, idx) => (
            <div key={idx} onClick={() => setSelectedDetailUser(stat.user)} className="p-6 bg-slate-50 rounded-[2.5rem] border-2 border-transparent hover:border-blue-200 cursor-pointer transition-all relative group">
              
              <div className="absolute top-6 right-6 flex gap-2">
                {stat.flag === 'red' && (
                  <div className="bg-rose-500 text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-lg animate-pulse" title="Sem registros no período">
                    <i className="fas fa-flag text-xs"></i>
                  </div>
                )}
                {stat.flag === 'yellow' && (
                  <div className="bg-amber-400 text-slate-900 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg" title="Faltam alguns formulários">
                    <i className="fas fa-exclamation-triangle text-xs"></i>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-sm border border-slate-100" style={{ color: pColor }}>
                  {stat.name[0]}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 uppercase tracking-tight leading-none text-xs">{stat.name}</h4>
                  <p className="text-[9px] font-black uppercase tracking-widest mt-1" style={{ color: pColor }}>{stat.totalActions} Ações no Filtro</p>
                </div>
              </div>

              {stat.missingForms.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1">Ainda não lançou:</p>
                  <div className="flex flex-wrap gap-1">
                    {stat.missingForms.map((f, i) => (
                      <span key={i} className="text-[7px] font-bold bg-white text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 uppercase">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                  <span className="block text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Alunos Período</span>
                  <span className="text-lg font-black text-slate-800">{stat.students}</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                  <span className="block text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Total Ações</span>
                  <span className="text-lg font-black text-slate-800">{stat.totalActions}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODAL DE DETALHES DO CAPELÃO */}
      {selectedDetailUser && currentDetailStat && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl font-black shadow-sm border border-slate-100" style={{ color: pColor }}>
                  {selectedDetailUser.name[0]}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{selectedDetailUser.name}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Detalhes de Alunos no Período</p>
                </div>
              </div>
              <button onClick={() => setSelectedDetailUser(null)} className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm transition-all"><i className="fas fa-times text-xl"></i></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">
              {['HAB', 'HABA'].map((unitKey) => {
                const uStat = unitKey === 'HAB' ? currentDetailStat.hab : currentDetailStat.haba;
                if (uStat.total === 0) return null;
                return (
                  <div key={unitKey} className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="h-px bg-slate-100 flex-1"></div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Unidade {unitKey}</h4>
                      <div className="h-px bg-slate-100 flex-1"></div>
                    </div>

                    <div className="grid gap-4">
                      {uStat.rawStudies.map((s, i) => (
                        <div key={`study-${i}`} className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-book-open"></i></div>
                            <div>
                              <p className="font-black text-slate-800 uppercase text-xs">{s.name}</p>
                              <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">{s.whatsapp || 'Sem WhatsApp'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Guia / Lição</p>
                              <p className="text-[10px] font-bold text-slate-700">{s.guide} - Lição {s.lesson}</p>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-blue-100 text-[8px] font-black text-blue-600 uppercase shadow-sm">Estudo</div>
                          </div>
                        </div>
                      ))}

                      {uStat.rawClasses.map((c, i) => (
                        <div key={`class-${i}`} className="p-5 bg-indigo-50/50 rounded-3xl border border-indigo-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-users"></i></div>
                              <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">{c.guide} - Lição {c.lesson}</p>
                                <p className="font-black text-indigo-700 uppercase text-xs">Classe Bíblica ({c.students?.length || 0} Alunos)</p>
                              </div>
                            </div>
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-indigo-100 text-[8px] font-black text-indigo-600 uppercase shadow-sm">Classe</div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-indigo-100/50">
                            {c.students?.map((name, si) => (
                              <span key={si} className="text-[8px] font-bold bg-white text-slate-600 px-2.5 py-1 rounded-full border border-indigo-50 uppercase shadow-sm">{name}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {currentDetailStat.totalActions === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center text-4xl">
                    <i className="fas fa-folder-open"></i>
                  </div>
                  <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Nenhum aluno registrado neste filtro</p>
                </div>
              )}
            </div>
            
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-center">
               <button onClick={() => setSelectedDetailUser(null)} className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest hover:bg-black transition-all">Fechar Detalhamento</button>
            </div>
          </div>
        </div>
      )}

      {showPdfPreview && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[950] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl my-auto rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center no-print">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Relatório PDF</h2>
              <div className="flex items-center gap-3">
                <button onClick={handlePrintIsolated} className="px-8 py-3.5 bg-slate-900 text-white font-black rounded-xl shadow-2xl uppercase text-[12px] tracking-widest active:scale-95 transition-all flex items-center gap-3"><i className="fas fa-print"></i> Imprimir</button>
                <button onClick={() => setShowPdfPreview(false)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all"><i className="fas fa-times"></i></button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-4 md:p-10 overflow-y-auto no-scrollbar">
              <PdfTemplate />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
