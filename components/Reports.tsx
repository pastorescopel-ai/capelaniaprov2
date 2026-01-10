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

  const activeDetails = useMemo(() => {
    if (!selectedDetailUser) return { items: [] };
    
    const sList = filteredData.studies.filter(s => s.userId === selectedDetailUser.id && s.status !== RecordStatus.TERMINO);
    const cList = filteredData.classes.filter(c => c.userId === selectedDetailUser.id && c.status !== RecordStatus.TERMINO);

    const items = [
      ...sList.map(s => ({ ...s, type: 'study' })),
      ...cList.map(c => ({ ...c, type: 'class' }))
    ].sort((a: any, b: any) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

    return { items };
  }, [filteredData, selectedDetailUser]);

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
          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 ml-2 uppercase">Início</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs" /></div>
          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 ml-2 uppercase">Fim</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs" /></div>
          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 ml-2 uppercase">Capelão</label>
            <select value={selectedChaplain} onChange={e => setSelectedChaplain(e.target.value)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs">
              <option value="all">Todos</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 ml-2 uppercase">Unidade</label>
            <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value as any)} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs">
              <option value="all">Ambas</option>
              <option value={Unit.HAB}>HAB</option>
              <option value={Unit.HABA}>HABA</option>
            </select>
          </div>
        </div>
      </section>

      <section className="bg-[#005a9c] text-white p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-8">
          <h2 className="text-3xl font-black tracking-tighter uppercase tracking-tight italic">Relatório Geral</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20 backdrop-blur-sm">
              <p className="text-[9px] font-black text-white/70 uppercase mb-2">Total de Estudantes</p>
              <p className="text-4xl font-black">{totalStats.totalStudents}</p>
            </div>
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20"><p className="text-[9px] font-black text-white/70 uppercase mb-2">Estudos</p><p className="text-3xl font-black">{totalStats.studies}</p></div>
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20"><p className="text-[9px] font-black text-white/70 uppercase mb-2">Classes</p><p className="text-3xl font-black">{totalStats.classes}</p></div>
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20"><p className="text-[9px] font-black text-white/70 uppercase mb-2">PGs</p><p className="text-3xl font-black">{totalStats.groups}</p></div>
            <div className="bg-emerald-500/20 p-6 rounded-3xl border border-emerald-500/30"><p className="text-[9px] font-black text-emerald-300 uppercase mb-2">Visitas Colab.</p><p className="text-3xl font-black">{totalStats.visits}</p></div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-black text-slate-800 px-4 flex items-center gap-3 uppercase tracking-tight">
          <i className="fas fa-user-tie text-[#005a9c]"></i> Detalhamento por Equipe
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {chaplainStats.map((stat) => (
            <div key={stat.user.id} onClick={() => setSelectedDetailUser(stat.user)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 group-hover:bg-blue-100 transition-colors"></div>
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-14 h-14 bg-[#005a9c] rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg overflow-hidden">
                  {stat.user.profilePic ? <img src={stat.user.profilePic} className="w-full h-full object-cover" alt="Foto" /> : stat.name[0]}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 truncate text-lg">{stat.name}</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.user.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 relative z-10">
                <div className="bg-blue-50 p-3 rounded-2xl text-center"><p className="text-[8px] font-black text-blue-400 uppercase mb-1">Alunos</p><p className="text-lg font-black text-blue-700">{stat.students}</p></div>
                <div className="bg-indigo-50 p-3 rounded-2xl text-center"><p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Ações</p><p className="text-lg font-black text-indigo-700">{stat.studies + stat.classes}</p></div>
                <div className="bg-rose-50 p-3 rounded-2xl text-center"><p className="text-[8px] font-black text-rose-400 uppercase mb-1">Visitas</p><p className="text-lg font-black text-rose-700">{stat.visits}</p></div>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-slate-300 group-hover:text-[#005a9c] transition-colors">
                <span className="text-[10px] font-black uppercase tracking-widest">Ver Atendimentos Ativos</span>
                <i className="fas fa-arrow-right text-xs"></i>
              </div>
            </div>
          ))}
        </div>
      </section>

      {selectedDetailUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[900] flex items-center justify-center p-4">
          <div className="bg-slate-50 w-full max-w-4xl max-h-[85vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 bg-white border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg"><i className="fas fa-book-reader"></i></div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Atendimentos Ativos</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Capelão: {selectedDetailUser.name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedDetailUser(null)} className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
              {activeDetails.items.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeDetails.items.map((item: any) => (
                    <div key={item.id} className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'class' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                          <i className={`fas ${item.type === 'class' ? 'fa-users' : 'fa-user'}`}></i>
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800 text-base leading-tight uppercase">{item.type === 'class' ? 'Classe Bíblica' : (item.name || 'Sem Nome')}</h4>
                          <div className="flex items-center gap-2">
                             <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{item.status}</span>
                             {item.type === 'study' && item.whatsapp && (
                               <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                                 <i className="fab fa-whatsapp"></i> {item.whatsapp}
                               </span>
                             )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {item.type === 'class' && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Setor:</span>
                              <span className="text-[10px] font-black text-slate-700 uppercase">{item.sector}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Alunos ({item.students?.length || 0}):</span>
                              <div className="flex flex-wrap gap-1">
                                {(item.students || []).map((s: string, idx: number) => (
                                  <span key={idx} className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-lg text-slate-600">
                                    {s.split(' ')[0]}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase">Guia:</span><span className="text-sm font-bold text-[#005a9c]">{item.guide || 'Não informado'}</span></div>
                        <div className="flex flex-col bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-[9px] font-black text-slate-400 uppercase">Lição Atual:</span><span className="text-sm font-black italic text-slate-700">"{item.lesson || 'Início do curso'}"</span></div>
                        <div className="flex items-center gap-3 text-slate-400 pt-2 border-t border-slate-100"><span className="text-[10px] font-black uppercase tracking-widest">{item.sector} • {item.unit}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 text-4xl"><i className="fas fa-folder-open"></i></div>
                  <h4 className="text-xl font-black text-slate-400 uppercase tracking-tighter">Nenhum atendimento ativo</h4>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPdfPreview && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[800] flex items-center justify-center p-4">
          <style>
            {`
              @media print {
                @page { size: A4; margin: 0; }
                
                /* Esconde tudo exceto o modal de PDF */
                body * { display: none !important; }
                #pdf-modal-container, #pdf-modal-container * { display: block !important; }
                
                /* Reseta o container do modal para ocupar a página toda sem ser fixo */
                #pdf-modal-container {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100vw !important;
                  height: auto !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                  box-shadow: none !important;
                  display: block !important;
                }

                /* Garante que o conteúdo interno seja renderizado como vetor/texto e não imagem */
                #pdf-content {
                  width: 210mm !important;
                  min-height: 297mm !important;
                  padding: 10mm !important;
                  margin: 0 auto !important;
                  background: white !important;
                  display: flex !important;
                  flex-direction: column !important;
                  box-sizing: border-box !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  box-shadow: none !important;
                }

                /* Força o conteúdo a não ser rasterizado (evita o efeito de "imagem") */
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  backdrop-filter: none !important;
                  filter: none !important;
                }

                .no-print { display: none !important; }
                .recharts-responsive-container { min-width: 100% !important; }
              }
            `}
          </style>

          <div id="pdf-modal-container" className="bg-white w-full max-w-5xl h-[95vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center no-print">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Relatório PDF</h2>
              <button onClick={() => setShowPdfPreview(false)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500"><i className="fas fa-times"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-100 p-10 no-scrollbar">
              <div id="pdf-content" className="bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[10mm] flex flex-col gap-4 text-slate-900">
                <header className="relative flex items-start border-b-4 border-[#005a9c] pb-4 min-h-[120px]" style={{ paddingTop: `${config.headerPaddingTop}px` }}>
                  {config.reportLogo && <div className="absolute" style={{ left: `${config.reportLogoX}px`, top: `${config.reportLogoY}px` }}><img src={config.reportLogo} style={{ width: `${config.reportLogoWidth}px`, height: 'auto' }} alt="Logo" /></div>}
                  <div className="w-full" style={{ textAlign: config.headerTextAlign }}>
                    <h1 style={{fontSize: `${config.fontSize1}px`, color: '#005a9c'}} className="font-black uppercase leading-none">{config.headerLine1}</h1>
                    <h2 style={{fontSize: `${config.fontSize2}px`}} className="font-bold text-slate-600 uppercase mt-2">{config.headerLine2}</h2>
                    <p className="text-[10px] font-bold mt-1">Período: {startDate.split('-').reverse().join('/')} até {endDate.split('-').reverse().join('/')}</p>
                    <p className="text-[9px] font-bold text-blue-600 mt-0.5 uppercase">Unidade: {selectedUnit === 'all' ? 'HAB + HABA' : selectedUnit}</p>
                  </div>
                </header>

                <section className="space-y-4">
                  {(selectedUnit === 'all' || selectedUnit === Unit.HAB) && (
                    <div>
                      <h3 className="text-[10px] font-black uppercase text-[#005a9c] mb-2 border-b border-slate-100 pb-0.5 italic">Resumo de Atividades por Capelão - Unidade HAB</h3>
                      <table className="w-full text-left text-[7px] border-collapse shadow-sm mb-2">
                        <thead><tr className="bg-[#005a9c] text-white uppercase"><th className="p-1">Capelão</th><th className="p-1 text-center">Total Estudantes</th><th className="p-1 text-center">Estudos</th><th className="p-1 text-center">Classes</th><th className="p-1 text-center">PGs</th><th className="p-1 text-center">Visitas</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {chaplainStats.filter(s => s.hab.total > 0 || s.hab.students > 0).map((stat, idx) => (
                            <tr key={`hab-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1 font-bold text-slate-700">{stat.name}</td>
                              <td className="p-1 text-center font-bold text-slate-800">{stat.hab.students}</td>
                              <td className="p-1 text-center font-bold text-blue-600">{stat.hab.studies}</td>
                              <td className="p-1 text-center font-bold text-indigo-600">{stat.hab.classes}</td>
                              <td className="p-1 text-center font-bold text-emerald-600">{stat.hab.groups}</td>
                              <td className="p-1 text-center font-bold text-rose-600">{stat.hab.visits}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(selectedUnit === 'all' || selectedUnit === Unit.HABA) && (
                    <div>
                      <h3 className="text-[10px] font-black uppercase text-[#005a9c] mb-2 border-b border-slate-100 pb-0.5 italic">Resumo de Atividades por Capelão - Unidade HABA</h3>
                      <table className="w-full text-left text-[7px] border-collapse shadow-sm">
                        <thead><tr className="bg-[#005a9c] text-white uppercase"><th className="p-1">Capelão</th><th className="p-1 text-center">Total Estudantes</th><th className="p-1 text-center">Estudos</th><th className="p-1 text-center">Classes</th><th className="p-1 text-center">PGs</th><th className="p-1 text-center">Visitas</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {chaplainStats.filter(s => s.haba.total > 0 || s.haba.students > 0).map((stat, idx) => (
                            <tr key={`haba-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1 font-bold text-slate-700">{stat.name}</td>
                              <td className="p-1 text-center font-bold text-slate-800">{stat.haba.students}</td>
                              <td className="p-1 text-center font-bold text-blue-600">{stat.haba.studies}</td>
                              <td className="p-1 text-center font-bold text-indigo-600">{stat.haba.classes}</td>
                              <td className="p-1 text-center font-bold text-emerald-600">{stat.haba.groups}</td>
                              <td className="p-1 text-center font-bold text-rose-600">{stat.haba.visits}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="flex flex-col items-center gap-4 mt-2">
                  <div className="w-full max-w-md mx-auto">
                    <h3 className="text-[9px] font-black uppercase text-slate-500 mb-2 text-center">Distribuição de Atividades</h3>
                    <div className="h-[120px] w-full flex items-center justify-center">
                      <PieChart width={350} height={120}>
                        <Pie
                          data={activityPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={50}
                          paddingAngle={3}
                          dataKey="value"
                          isAnimationActive={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={true}
                        >
                          {activityPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip isAnimationActive={false} />
                        <Legend wrapperStyle={{fontSize: '7px', fontWeight: 'bold'}} verticalAlign="bottom" align="center" />
                      </PieChart>
                    </div>
                  </div>
                  <div className="w-full max-w-2xl mx-auto">
                    <h3 className="text-[9px] font-black uppercase text-slate-500 mb-2 text-center">Desempenho da Equipe</h3>
                    <div className="h-[150px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chaplainStats} margin={{top: 20, right: 10, left: -20, bottom: 5}}>
                          <XAxis dataKey="name" tick={{fontSize: 6, fontWeight: 'bold'}} interval={0} axisLine={false} tickLine={false} />
                          <YAxis tick={{fontSize: 6}} axisLine={false} tickLine={false} />
                          <Tooltip isAnimationActive={false} contentStyle={{borderRadius: '8px', fontSize: '8px'}} />
                          <Legend verticalAlign="bottom" wrapperStyle={{fontSize: '6px', fontWeight: 'bold', paddingTop: '5px'}} iconSize={6} />
                          <Bar dataKey="students" name="Alunos" fill="#005a9c" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                            <LabelList dataKey="students" position="top" style={{fontSize: '6px', fontWeight: 'bold', fill: '#005a9c'}} />
                          </Bar>
                          <Bar dataKey="studies" name="Estudos" fill="#3b82f6" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                            <LabelList dataKey="studies" position="top" style={{fontSize: '6px', fontWeight: 'bold', fill: '#3b82f6'}} />
                          </Bar>
                          <Bar dataKey="classes" name="Classes" fill="#6366f1" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                            <LabelList dataKey="classes" position="top" style={{fontSize: '6px', fontWeight: 'bold', fill: '#6366f1'}} />
                          </Bar>
                          <Bar dataKey="groups" name="PGs" fill="#10b981" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                            <LabelList dataKey="groups" position="top" style={{fontSize: '6px', fontWeight: 'bold', fill: '#10b981'}} />
                          </Bar>
                          <Bar dataKey="visits" name="Visitas" fill="#f43f5e" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                            <LabelList dataKey="visits" position="top" style={{fontSize: '6px', fontWeight: 'bold', fill: '#f43f5e'}} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>

                <div className="mt-auto grid grid-cols-5 gap-2 border-t border-slate-200 pt-4">
                    <div className="bg-[#005a9c] p-2 rounded-xl text-center text-white shadow-sm"><p className="text-[6px] font-black text-white/70 uppercase">Total Estudantes</p><p className="text-base font-black">{totalStats.totalStudents}</p></div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100"><p className="text-[6px] font-black text-slate-400 uppercase">Estudos Bíblicos</p><p className="text-base font-black text-blue-600">{totalStats.studies}</p></div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100"><p className="text-[6px] font-black text-slate-400 uppercase">Classes Bíblicas</p><p className="text-base font-black text-indigo-600">{totalStats.classes}</p></div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100"><p className="text-[6px] font-black text-slate-400 uppercase">PGs Assistidos</p><p className="text-base font-black text-emerald-600">{totalStats.groups}</p></div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center border border-slate-100"><p className="text-[6px] font-black text-slate-400 uppercase">Visitas Colab.</p><p className="text-base font-black text-rose-600">{totalStats.visits}</p></div>
                </div>

                <footer className="mt-2 border-t border-slate-100 pt-1 flex justify-between text-[6px] font-bold text-slate-300 uppercase italic">
                  <span>Gerado eletronicamente em: {new Date().toLocaleString('pt-BR')}</span>
                  <span>Sistema Capelania Pro - Gestão Eficiente</span>
                </footer>
              </div>
            </div>
            <div className="p-8 bg-white border-t border-slate-100 flex justify-end no-print">
              <button onClick={() => window.print()} className="px-12 py-4 bg-[#005a9c] text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest">Imprimir / Salvar PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;