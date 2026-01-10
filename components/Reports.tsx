
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Unit, RecordStatus, Config } from '../types';

interface ReportsProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  users: User[];
  config: Config;
}

const Reports: React.FC<ReportsProps> = ({ studies, classes, groups, visits, users, config }) => {
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [selectedDetailUser, setSelectedDetailUser] = useState<User | null>(null);
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedChaplain, setSelectedChaplain] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState<'all' | Unit>('all');

  const COLORS = ['#3b82f6', '#6366f1', '#10b981', '#f43f5e'];

  const filteredData = useMemo(() => {
    const filterFn = (item: any) => {
      const dateMatch = item.date >= startDate && item.date <= endDate;
      const chaplainMatch = selectedChaplain === 'all' || item.userId === selectedChaplain;
      const unitMatch = selectedUnit === 'all' || item.unit === selectedUnit;
      return dateMatch && chaplainMatch && unitMatch;
    };
    return {
      studies: studies.filter(filterFn),
      classes: classes.filter(filterFn),
      groups: groups.filter(filterFn),
      visits: visits.filter(filterFn),
    };
  }, [studies, classes, groups, visits, startDate, endDate, selectedChaplain, selectedUnit]);

  const totalStats = useMemo(() => {
    const allStudentsSet = new Set<string>();
    filteredData.studies.forEach(item => { if (item.name) allStudentsSet.add(item.name.trim().toLowerCase()); });
    filteredData.classes.forEach(item => { if (item.students) item.students.forEach(name => { if (name) allStudentsSet.add(name.trim().toLowerCase()); }); });

    return {
      studies: filteredData.studies.length,
      classes: filteredData.classes.length,
      groups: filteredData.groups.length,
      visits: filteredData.visits.length,
      totalUniqueStudents: allStudentsSet.size
    };
  }, [filteredData]);

  const unitStats = useMemo(() => {
    const getStats = (u: Unit) => {
      const s = filteredData.studies.filter(x => x.unit === u);
      const c = filteredData.classes.filter(x => x.unit === u);
      const g = filteredData.groups.filter(x => x.unit === u);
      const v = filteredData.visits.filter(x => x.unit === u);
      const unitStudentsSet = new Set<string>();
      s.forEach(item => { if (item.name) unitStudentsSet.add(item.name.trim().toLowerCase()); });
      c.forEach(item => { if (item.students) item.students.forEach(n => { if (n) unitStudentsSet.add(n.trim().toLowerCase()); }); });
      return { studies: s.length, classes: c.length, groups: g.length, visits: v.length, totalUniqueStudents: unitStudentsSet.size };
    };
    return { HAB: getStats(Unit.HAB), HABA: getStats(Unit.HABA) };
  }, [filteredData]);

  const chaplainStats = useMemo(() => {
    return users.map(user => {
      const uStudies = studies.filter(s => s.userId === user.id && s.date >= startDate && s.date <= endDate && (selectedUnit === 'all' || s.unit === selectedUnit));
      const uClasses = classes.filter(c => c.userId === user.id && c.date >= startDate && c.date <= endDate && (selectedUnit === 'all' || c.unit === selectedUnit));
      const uGroups = groups.filter(g => g.userId === user.id && g.date >= startDate && g.date <= endDate && (selectedUnit === 'all' || g.unit === selectedUnit));
      const uVisits = visits.filter(v => v.userId === user.id && v.date >= startDate && v.date <= endDate && (selectedUnit === 'all' || v.unit === selectedUnit));
      const studentsSet = new Set<string>();
      uStudies.forEach(s => { if (s.name) studentsSet.add(s.name.trim().toLowerCase()); });
      uClasses.forEach(c => { if (c.students) c.students.forEach(n => { if (n) studentsSet.add(n.trim().toLowerCase()); }); });
      return { user, name: user.name, students: studentsSet.size, studies: uStudies.length, classes: uClasses.length, groups: uGroups.length, visits: uVisits.length, totalActions: uStudies.length + uClasses.length + uGroups.length + uVisits.length };
    }).filter(s => selectedChaplain === 'all' ? s.totalActions > 0 : s.user.id === selectedChaplain).sort((a, b) => b.totalActions - a.totalActions);
  }, [users, studies, classes, groups, visits, startDate, endDate, selectedUnit, selectedChaplain]);

  const chartData = useMemo(() => {
    const activities = [{ name: 'Estudos', value: filteredData.studies.length }, { name: 'Classes', value: filteredData.classes.length }, { name: 'PGs', value: filteredData.groups.length }, { name: 'Visitas', value: filteredData.visits.length }];
    const byChaplain = chaplainStats.map(s => ({ name: s.name.split(' ')[0], total: s.totalActions }));
    const monthlyMap: Record<string, any> = {};
    const allItems = [...filteredData.studies, ...filteredData.classes, ...filteredData.groups, ...filteredData.visits];
    allItems.forEach(item => { const month = item.date.substring(0, 7); if (!monthlyMap[month]) monthlyMap[month] = { month, total: 0 }; monthlyMap[month].total++; });
    const monthlyProgress = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
    return { activities, byChaplain, monthlyProgress };
  }, [filteredData, chaplainStats]);

  const chaplainProgress = useMemo(() => {
    if (!selectedDetailUser) return { activeStudies: [], activeClasses: [] };
    const studyMap: Record<string, BibleStudy> = {};
    const classMap: Record<string, BibleClass> = {};
    studies.filter(s => s.userId === selectedDetailUser.id).forEach(s => { const key = s.name.trim().toLowerCase(); if (!studyMap[key] || s.createdAt > studyMap[key].createdAt) studyMap[key] = s; });
    classes.filter(c => c.userId === selectedDetailUser.id).forEach(c => { const key = `${c.guide.trim().toLowerCase()}-${c.sector.trim().toLowerCase()}`; if (!classMap[key] || c.createdAt > classMap[key].createdAt) classMap[key] = c; });
    return { activeStudies: Object.values(studyMap).filter(s => s.status !== RecordStatus.TERMINO), activeClasses: Object.values(classMap).filter(c => c.status !== RecordStatus.TERMINO) };
  }, [studies, classes, selectedDetailUser]);

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-500">
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <h1 className="text-3xl font-black text-slate-800">Painel de Relatórios</h1>
          <button onClick={() => setShowPdfPreview(true)} className="px-8 py-4 bg-[#005a9c] text-white font-black rounded-2xl shadow-xl flex items-center gap-3 uppercase text-[10px] tracking-widest active:scale-95">
            <i className="fas fa-file-pdf"></i> Imprimir Relatório Analítico
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-[2.5rem]">
          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-2">Início</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 rounded-xl border-none text-xs font-bold" /></div>
          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-2">Fim</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 rounded-xl border-none text-xs font-bold" /></div>
          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-2">Capelão</label><select value={selectedChaplain} onChange={e => setSelectedChaplain(e.target.value)} className="w-full p-4 rounded-xl border-none text-xs font-bold"><option value="all">Todos os Capelães</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-2">Unidade</label><select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value as any)} className="w-full p-4 rounded-xl border-none text-xs font-bold"><option value="all">Ambas Unidades</option><option value={Unit.HAB}>HAB</option><option value={Unit.HABA}>HABA</option></select></div>
        </div>
      </section>

      <section className="bg-[#005a9c] text-white p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="relative z-10 space-y-8 text-center lg:text-left">
          <h2 className="text-3xl font-black tracking-tighter uppercase italic">Total Geral Consolidado</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20 backdrop-blur-sm"><p className="text-[9px] font-black text-white/70 uppercase mb-2">Alunos Únicos</p><p className="text-4xl font-black">{totalStats.totalUniqueStudents}</p></div>
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20"><p className="text-[9px] font-black text-white/70 uppercase mb-2">Estudos</p><p className="text-3xl font-black">{totalStats.studies}</p></div>
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20"><p className="text-[9px] font-black text-white/70 uppercase mb-2">Classes</p><p className="text-3xl font-black">{totalStats.classes}</p></div>
            <div className="bg-white/10 p-6 rounded-3xl border border-white/20"><p className="text-[9px] font-black text-white/70 uppercase mb-2">PGs</p><p className="text-3xl font-black">{totalStats.groups}</p></div>
            <div className="bg-emerald-500/20 p-6 rounded-3xl border border-emerald-500/30"><p className="text-[9px] font-black text-emerald-300 uppercase mb-2">Visitas</p><p className="text-3xl font-black text-emerald-300">{totalStats.visits}</p></div>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        {Object.entries(unitStats).map(([u, s]) => (
          <div key={u} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 ${u === 'HAB' ? 'bg-blue-600' : 'bg-indigo-600'} text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-lg`}>{u}</div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Resumo Unidade {u}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 col-span-2"><p className="text-[9px] font-black text-blue-400 uppercase">Alunos Únicos em {u}</p><p className="text-2xl font-black text-blue-800">{s.totalUniqueStudents}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center"><p className="text-[9px] font-black text-slate-400 uppercase">Estudos</p><p className="text-xl font-black">{s.studies}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center"><p className="text-[9px] font-black text-slate-400 uppercase">Classes</p><p className="text-xl font-black">{s.classes}</p></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center"><p className="text-[9px] font-black text-slate-400 uppercase">PGs</p><p className="text-xl font-black">{s.groups}</p></div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center"><p className="text-[9px] font-black text-emerald-400 uppercase">Visitas</p><p className="text-xl font-black">{s.visits}</p></div>
            </div>
          </div>
        ))}
      </div>

      {showPdfPreview && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[800] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl h-[95vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Visualização do PDF</h2>
              <button onClick={() => setShowPdfPreview(false)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500"><i className="fas fa-times"></i></button>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-slate-100 p-10 no-scrollbar">
              <div id="pdf-content" className="bg-white w-full max-w-[210mm] min-h-[297mm] mx-auto shadow-2xl p-[20mm] flex flex-col gap-10 text-slate-900">
                <header className="relative flex items-start border-b-4 border-[#005a9c] pb-10 min-h-[140px]" style={{ paddingTop: `${config.headerPaddingTop}px` }}>
                  <div className="absolute" style={{ left: `${config.reportLogoX}px`, top: `${config.reportLogoY}px` }}>
                    {config.reportLogo && <img src={config.reportLogo} style={{ width: `${config.reportLogoWidth}px`, height: 'auto' }} alt="Logo" />}
                  </div>
                  <div className="w-full" style={{ textAlign: config.headerTextAlign }}>
                    <h1 style={{fontSize: `${config.fontSize1}px`, color: '#005a9c'}} className="font-black uppercase leading-none">{config.headerLine1}</h1>
                    <h2 style={{fontSize: `${config.fontSize2}px`}} className="font-bold text-slate-600 uppercase mt-4">{config.headerLine2}</h2>
                    <h3 style={{fontSize: `${config.fontSize3}px`}} className="font-medium text-slate-500 uppercase mt-2">{config.headerLine3}</h3>
                    <p className="text-[10px] font-bold mt-2">Período: {startDate.split('-').reverse().join('/')} até {endDate.split('-').reverse().join('/')}</p>
                  </div>
                </header>

                <section>
                  <h3 className="text-xs font-black uppercase mb-4 border-l-4 border-[#005a9c] pl-2 text-[#005a9c]">1. Desempenho da Equipe</h3>
                  <table className="w-full text-left text-[10px] border-collapse shadow-sm">
                    <thead>
                      <tr className="bg-[#005a9c] text-white uppercase">
                        <th className="p-3">Capelão</th>
                        <th className="p-3 text-center">Atendimentos</th>
                        <th className="p-3 text-center">Alunos Únicos</th>
                        <th className="p-3 text-center">Visitas Colab.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {chaplainStats.map((stat, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-3 font-bold text-slate-700">{stat.name}</td>
                          <td className="p-3 text-center font-bold text-blue-600">{stat.studies + stat.classes}</td>
                          <td className="p-3 text-center font-bold text-indigo-600">{stat.students}</td>
                          <td className="p-3 text-center font-bold text-emerald-600">{stat.visits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <div className="grid grid-cols-2 gap-8">
                   <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200">
                      <h3 className="text-[9px] font-black uppercase mb-4 text-slate-500">Distribuição</h3>
                      <div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData.activities} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">{chartData.activities.map((e, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}</Pie><Tooltip /><Legend wrapperStyle={{fontSize: '9px'}} /></PieChart></ResponsiveContainer></div>
                   </div>
                   <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200">
                      <h3 className="text-[9px] font-black uppercase mb-4 text-slate-500">Volume Total</h3>
                      <div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData.byChaplain} layout="vertical"><XAxis type="number" hide /><YAxis dataKey="name" type="category" fontSize={8} width={60} /><Bar dataKey="total" fill="#005a9c" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
                   </div>
                </div>

                <footer className="mt-auto border-t border-slate-200 pt-4 flex justify-between text-[8px] font-bold text-slate-400 uppercase">
                  <span>Relatório Gerado em: {new Date().toLocaleString('pt-BR')}</span>
                  <span>Sistema de Gestão de Capelania Hospitalar - MCH</span>
                </footer>
              </div>
            </div>

            <div className="p-8 bg-white border-t border-slate-100 flex justify-end">
               <button onClick={() => window.print()} className="px-12 py-4 bg-[#005a9c] text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all">Imprimir / Salvar PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
