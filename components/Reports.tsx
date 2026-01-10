import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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
  
  // Data inicial padrão: 1º de Janeiro do ano atual para abranger o histórico existente
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedChaplain, setSelectedChaplain] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState<'all' | Unit>('all');

  const COLORS = ['#3b82f6', '#6366f1', '#10b981', '#f43f5e'];

  // Dados filtrados base - Fonte da Verdade para Relatórios
  const filteredData = useMemo(() => {
    const sList = Array.isArray(studies) ? studies : [];
    const cList = Array.isArray(classes) ? classes : [];
    const gList = Array.isArray(groups) ? groups : [];
    const vList = Array.isArray(visits) ? visits : [];

    const filterFn = (item: any) => {
      if (!item || !item.date) return false;
      const dateMatch = item.date >= startDate && item.date <= endDate;
      const chaplainMatch = selectedChaplain === 'all' || item.userId === selectedChaplain;
      
      // REGRA DE OURO: Se não houver unit no registro antigo, assume-se HAB para não zerar
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

  // Estatísticas do Card Superior (Total Geral Consolidado) - FÓRMULA CORRIGIDA
  const totalStats = useMemo(() => {
    const allStudentsSet = new Set<string>();
    
    // 1. Adiciona alunos de estudos individuais de TODOS os registros filtrados
    filteredData.studies.forEach(s => {
      if (s && s.name && typeof s.name === 'string') {
        const nameClean = s.name.trim().toLowerCase();
        if (nameClean) allStudentsSet.add(nameClean);
      }
    });

    // 2. Adiciona CADA aluno de CADA classe bíblica filtrada (Iteração profunda)
    filteredData.classes.forEach(c => {
      if (c && Array.isArray(c.students)) {
        c.students.forEach(studentName => {
          if (studentName && typeof studentName === 'string') {
            const nameClean = studentName.trim().toLowerCase();
            if (nameClean) allStudentsSet.add(nameClean);
          }
        });
      }
    });

    return {
      studies: filteredData.studies.length,
      classes: filteredData.classes.length,
      groups: filteredData.groups.length,
      visits: filteredData.visits.length,
      totalStudents: allStudentsSet.size
    };
  }, [filteredData]);

  // Estatísticas por Capelão (Cards Individuais)
  const chaplainStats = useMemo(() => {
    const uList = Array.isArray(users) ? users : [];

    return uList.map(user => {
      // Filtra atividades do usuário dentro do conjunto já filtrado por unidade e período
      const uStudies = filteredData.studies.filter(s => s.userId === user.id);
      const uClasses = filteredData.classes.filter(c => c.userId === user.id);
      const uVisits = filteredData.visits.filter(v => v.userId === user.id);
      
      const studentsSet = new Set<string>();
      
      // Soma nomes dos estudos individuais
      uStudies.forEach(s => {
        if(s.name && typeof s.name === 'string') {
          const nameClean = s.name.trim().toLowerCase();
          if (nameClean) studentsSet.add(nameClean);
        }
      });

      // Soma nomes de cada aluno dentro de cada classe
      uClasses.forEach(c => {
        if (Array.isArray(c.students)) {
          c.students.forEach(n => {
            if (n && typeof n === 'string') {
              const nameClean = n.trim().toLowerCase();
              if (nameClean) studentsSet.add(nameClean);
            }
          });
        }
      });

      const totalActions = uStudies.length + uClasses.length + uVisits.length;

      return { 
        user, 
        name: user.name || "Sem Nome", 
        students: studentsSet.size, 
        studies: uStudies.length, 
        classes: uClasses.length, 
        visits: uVisits.length, 
        totalActions 
      };
    }).filter(s => {
        if (selectedChaplain !== 'all') return s.user.id === selectedChaplain;
        return s.totalActions > 0 || s.students > 0;
    }).sort((a, b) => b.totalActions - a.totalActions);
  }, [users, filteredData, selectedChaplain]);

  // Detalhes do Modal: Respeitam rigorosamente o filtro de unidade selecionado no topo
  const activeDetails = useMemo(() => {
    if (!selectedDetailUser) return { items: [] };
    
    // Filtra detalhes respeitando a unidade selecionada (HAB, HABA ou Ambas)
    const sList = filteredData.studies.filter(s => s.userId === selectedDetailUser.id);
    const cList = filteredData.classes.filter(c => c.userId === selectedDetailUser.id);

    const studyMap: Record<string, any> = {};
    sList.forEach(s => {
      if (s && s.name) {
        const key = String(s.name).trim().toLowerCase();
        if (!studyMap[key] || (Number(s.createdAt) || 0) > (Number(studyMap[key].createdAt) || 0)) {
          studyMap[key] = { ...s, type: 'study' };
        }
      }
    });

    const classMap: Record<string, any> = {};
    cList.forEach(c => {
      const key = `${String(c.guide || "")}-${String(c.sector || "")}`.trim().toLowerCase();
      if (!classMap[key] || (Number(c.createdAt) || 0) > (Number(classMap[key].createdAt) || 0)) {
        classMap[key] = { ...c, type: 'class' };
      }
    });

    const finalStudies = Object.values(studyMap).filter((s: any) => s.status !== RecordStatus.TERMINO);
    const finalClasses = Object.values(classMap).filter((c: any) => c.status !== RecordStatus.TERMINO);

    return {
      items: [...finalStudies, ...finalClasses].sort((a: any, b: any) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    };
  }, [filteredData, selectedDetailUser]);

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
          <h2 className="text-3xl font-black tracking-tighter uppercase tracking-tight italic">Total Geral Consolidado</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20 backdrop-blur-sm">
              <p className="text-[9px] font-black text-white/70 uppercase mb-2">Total de Alunos</p>
              <p className="text-4xl font-black">{totalStats.totalStudents}</p>
            </div>
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20"><p className="text-[9px] font-black text-white/70 uppercase mb-2">Estudos</p><p className="text-3xl font-black">{totalStats.studies}</p></div>
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20"><p className="text-[9px] font-black text-white/70 uppercase mb-2">Classes</p><p className="text-3xl font-black">{totalStats.classes}</p></div>
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20"><p className="text-[9px] font-black text-white/70 uppercase mb-2">PGs</p><p className="text-3xl font-black">{totalStats.groups}</p></div>
            <div className="bg-emerald-500/20 p-6 rounded-3xl border border-emerald-500/30"><p className="text-[9px] font-black text-emerald-300 uppercase mb-2">Visitas Colab.</p><p className="text-3xl font-black text-emerald-300">{totalStats.visits}</p></div>
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
                  <h3 className="font-black text-slate-800 truncate text-lg">{stat.name}</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.user.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 relative z-10">
                <div className="bg-blue-50 p-3 rounded-2xl text-center"><p className="text-[8px] font-black text-blue-400 uppercase mb-1">Alunos</p><p className="text-lg font-black text-blue-700">{stat.students}</p></div>
                <div className="bg-indigo-50 p-3 rounded-2xl text-center"><p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Ações</p><p className="text-lg font-black text-indigo-700">{stat.studies + stat.classes}</p></div>
                <div className="bg-rose-50 p-3 rounded-2xl text-center"><p className="text-[8px] font-black text-rose-400 uppercase mb-1">Visitas</p><p className="text-lg font-black text-rose-700">{stat.visits}</p></div>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-slate-300 group-hover:text-[#005a9c] transition-colors">
                <span className="text-[10px] font-black uppercase tracking-widest">Ver Atendimentos Atuais</span>
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
                  <p className="text-[9px] text-blue-500 font-bold uppercase">Unidade Selecionada: {selectedUnit === 'all' ? 'Ambas' : selectedUnit}</p>
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
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{item.status}</span>
                        </div>
                      </div>
                      <div className="space-y-3">
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
                  <h4 className="text-xl font-black text-slate-400 uppercase tracking-tighter">Nenhum atendimento ativo nesta unidade/período</h4>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPdfPreview && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[800] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl h-[95vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Relatório PDF</h2>
              <button onClick={() => setShowPdfPreview(false)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500"><i className="fas fa-times"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-100 p-10 no-scrollbar">
              <div id="pdf-content" className="bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[20mm] flex flex-col gap-10 text-slate-900">
                <header className="relative flex items-start border-b-4 border-[#005a9c] pb-10 min-h-[140px]" style={{ paddingTop: `${config.headerPaddingTop}px` }}>
                  {config.reportLogo && <div className="absolute" style={{ left: `${config.reportLogoX}px`, top: `${config.reportLogoY}px` }}><img src={config.reportLogo} style={{ width: `${config.reportLogoWidth}px`, height: 'auto' }} alt="Logo" /></div>}
                  <div className="w-full" style={{ textAlign: config.headerTextAlign }}>
                    <h1 style={{fontSize: `${config.fontSize1}px`, color: '#005a9c'}} className="font-black uppercase leading-none">{config.headerLine1}</h1>
                    <h2 style={{fontSize: `${config.fontSize2}px`}} className="font-bold text-slate-600 uppercase mt-4">{config.headerLine2}</h2>
                    <p className="text-[10px] font-bold mt-2">Período: {startDate.split('-').reverse().join('/')} até {endDate.split('-').reverse().join('/')}</p>
                    <p className="text-[9px] font-bold text-blue-600 mt-1 uppercase">Unidade: {selectedUnit === 'all' ? 'HAB + HABA' : selectedUnit}</p>
                  </div>
                </header>
                <table className="w-full text-left text-[10px] border-collapse shadow-sm">
                  <thead><tr className="bg-[#005a9c] text-white uppercase"><th className="p-3">Capelão</th><th className="p-3 text-center">Atendimentos</th><th className="p-3 text-center">Total de Alunos</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {chaplainStats.map((stat, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-3 font-bold text-slate-700">{stat.name}</td>
                        <td className="p-3 text-center font-bold text-blue-600">{stat.studies + stat.classes}</td>
                        <td className="p-3 text-center font-bold text-indigo-600">{stat.students}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
                    <div className="bg-slate-50 p-4 rounded-xl text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Total Estudos</p><p className="text-xl font-black text-[#005a9c]">{totalStats.studies}</p></div>
                    <div className="bg-slate-50 p-4 rounded-xl text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Total Classes</p><p className="text-xl font-black text-[#005a9c]">{totalStats.classes}</p></div>
                    <div className="bg-slate-50 p-4 rounded-xl text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Total Geral Alunos</p><p className="text-xl font-black text-indigo-600">{totalStats.totalStudents}</p></div>
                </div>
                <footer className="mt-auto border-t border-slate-200 pt-4 flex justify-between text-[8px] font-bold text-slate-400 uppercase"><span>Gerado em: {new Date().toLocaleString('pt-BR')}</span><span>Sistema Capelania Pro</span></footer>
              </div>
            </div>
            <div className="p-8 bg-white border-t border-slate-100 flex justify-end"><button onClick={() => window.print()} className="px-12 py-4 bg-[#005a9c] text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest">Imprimir / Salvar PDF</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;