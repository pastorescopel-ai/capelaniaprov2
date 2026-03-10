
import React, { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Unit, DailyActivityReport, UserRole } from '../../types';
import { BLUEPRINT_LOCATIONS } from '../../constants';
import { BarChart3, Calendar, Users, MapPin, HeartPulse, ChevronLeft, ChevronRight, Download, User } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ActivityReports: React.FC = () => {
  const { dailyActivityReports, users, proSectors, config } = useApp();
  
  const [selectedUnit, setSelectedUnit] = useState<Unit>(Unit.HAB);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [selectedUser, setSelectedUser] = useState<string>('all');

  const chaplains = useMemo(() => 
    users.filter(u => u.role === UserRole.CHAPLAIN || u.role === UserRole.INTERN),
    [users]
  );

  const filteredReports = useMemo(() => {
    const start = new Date(selectedMonth + 'T00:00:00').getTime();
    const end = new Date(new Date(selectedMonth + 'T00:00:00').getFullYear(), new Date(selectedMonth + 'T00:00:00').getMonth() + 1, 0, 23, 59, 59).getTime();
    
    return dailyActivityReports.filter(r => 
      r.unit === selectedUnit && 
      new Date(r.date + 'T12:00:00').getTime() >= start && 
      new Date(r.date + 'T12:00:00').getTime() <= end &&
      (selectedUser === 'all' ? true : r.userId === selectedUser)
    );
  }, [dailyActivityReports, selectedUnit, selectedMonth, selectedUser]);

  const stats = useMemo(() => {
    const totals = {
      blueprints: 0,
      cults: 0,
      encontros: 0,
      visiteCantando: 0,
      palliative: 0,
      surgical: 0,
      pediatric: 0,
      uti: 0,
      totalVisits: 0
    };

    filteredReports.forEach(r => {
      totals.blueprints += (r.completedBlueprints?.length || 0);
      totals.cults += (r.completedCults?.length || 0);
      totals.encontros += r.completedEncontro ? 1 : 0;
      totals.visiteCantando += r.completedVisiteCantando ? 1 : 0;
      totals.palliative += (r.palliativeCount || 0);
      totals.surgical += (r.surgicalCount || 0);
      totals.pediatric += (r.pediatricCount || 0);
      totals.uti += (r.utiCount || 0);
    });

    totals.totalVisits = totals.palliative + totals.surgical + totals.pediatric + totals.uti;
    return totals;
  }, [filteredReports]);

  const blueprintStats = useMemo(() => {
    const counts: Record<string, number> = {};
    BLUEPRINT_LOCATIONS.forEach(loc => counts[loc] = 0);
    
    filteredReports.forEach(r => {
      r.completedBlueprints?.forEach(loc => {
        if (counts[loc] !== undefined) counts[loc]++;
      });
    });

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredReports]);

  const cultStats = useMemo(() => {
    const counts: Record<string, number> = {};
    proSectors.filter(s => s.unit === selectedUnit).forEach(s => counts[s.name] = 0);
    
    filteredReports.forEach(r => {
      r.completedCults?.forEach(id => {
        const sector = proSectors.find(s => s.id === id);
        if (sector && counts[sector.name] !== undefined) counts[sector.name]++;
      });
    });

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredReports, proSectors, selectedUnit]);

  const formatMonthLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const changeMonth = (offset: number) => {
    const d = new Date(selectedMonth + 'T12:00:00');
    d.setMonth(d.getMonth() + offset);
    setSelectedMonth(d.toISOString().split('T')[0]);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pColor = config.primaryColor || '#005a9c';
    const monthLabel = formatMonthLabel(selectedMonth);
    const chaplainName = selectedUser === 'all' ? 'Todos os Capelães' : chaplains.find(c => c.id === selectedUser)?.name || 'N/A';

    // Header
    doc.setFillColor(pColor);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE ATIVIDADES DIÁRIAS', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${config.headerLine1} | ${monthLabel}`, 105, 30, { align: 'center' });

    // Info
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(12);
    doc.text(`Unidade: ${selectedUnit}`, 15, 50);
    doc.text(`Capelão: ${chaplainName}`, 15, 57);
    doc.text(`Total de Visitas: ${stats.totalVisits}`, 15, 64);

    // Stats Table
    autoTable(doc, {
      startY: 75,
      head: [['Categoria', 'Quantidade']],
      body: [
        ['Blueprints Realizados', stats.blueprints],
        ['Setores Visitados', stats.cults],
        ['Encontros HAB', stats.encontros],
        ['Visite Cantando', stats.visiteCantando],
        ['Visitas Paliativas', stats.palliative],
        ['Visitas Cirúrgicas', stats.surgical],
        ['Visitas Pediátricas', stats.pediatric],
        ['Visitas UTI', stats.uti],
        ['TOTAL DE VISITAS', stats.totalVisits],
      ],
      theme: 'striped',
      headStyles: { fillColor: pColor },
      styles: { fontSize: 10 }
    });

    // Blueprint Ranking
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Ranking Blueprint', 'Frequência']],
      body: blueprintStats.filter(s => s[1] > 0).slice(0, 10),
      theme: 'grid',
      headStyles: { fillColor: pColor },
      styles: { fontSize: 9 }
    });

    // Cult Ranking
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Ranking Setores', 'Frequência']],
      body: cultStats.filter(s => s[1] > 0).slice(0, 10),
      theme: 'grid',
      headStyles: { fillColor: pColor },
      styles: { fontSize: 9 }
    });

    doc.save(`Relatorio_Atividades_${selectedUnit}_${monthLabel.replace(' ', '_')}.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 grid md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Unidade</label>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[Unit.HAB, Unit.HABA].map(u => (
              <button
                key={u}
                onClick={() => setSelectedUnit(u)}
                className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${
                  selectedUnit === u ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                }`}
              >
                Unidade {u}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Mês de Referência</label>
          <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronLeft size={16} /></button>
            <span className="text-[10px] font-black uppercase tracking-tighter">{formatMonthLabel(selectedMonth)}</span>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Capelão</label>
          <div className="flex gap-2">
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="flex-1 p-3 bg-slate-100 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="all">Todos os Capelães</option>
              {chaplains.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleExportPDF}
              className="px-4 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center"
              title="Exportar PDF"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3"><MapPin size={20} /></div>
          <span className="text-2xl font-black text-slate-800 block">{stats.blueprints}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Blueprints</span>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3"><Users size={20} /></div>
          <span className="text-2xl font-black text-slate-800 block">{stats.cults}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Setores</span>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-3"><HeartPulse size={20} /></div>
          <span className="text-2xl font-black text-slate-800 block">{stats.encontros}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Encontros HAB</span>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mx-auto mb-3"><HeartPulse size={20} /></div>
          <span className="text-2xl font-black text-slate-800 block">{stats.visiteCantando}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Visite Cantando</span>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mx-auto mb-3"><HeartPulse size={20} /></div>
          <span className="text-2xl font-black text-slate-800 block">{stats.totalVisits}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Visitas Totais</span>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <div className="w-10 h-10 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center mx-auto mb-3"><Calendar size={20} /></div>
          <span className="text-2xl font-black text-slate-800 block">{filteredReports.length}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dias com Relatório</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Ranking Blueprint */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
            <MapPin className="text-indigo-500" size={18} /> Ranking Blueprint
          </h3>
          <div className="space-y-3">
            {blueprintStats.map(([loc, count], idx) => (
              <div key={loc} className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-300 w-4">{idx + 1}</span>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-slate-600 truncate max-w-[200px]">{loc}</span>
                    <span className="text-indigo-600">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(count / (stats.blueprints || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Ranking Cultos */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
            <Users className="text-emerald-500" size={18} /> Ranking Setores
          </h3>
          <div className="space-y-3">
            {cultStats.map(([name, count], idx) => (
              <div key={name} className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-300 w-4">{idx + 1}</span>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-slate-600 truncate max-w-[200px]">{name}</span>
                    <span className="text-emerald-600">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(count / (stats.cults || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Detalhamento de Visitas */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
            <HeartPulse className="text-rose-500" size={18} /> Detalhamento de Visitas
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Paliativos', count: stats.palliative, color: 'rose' },
              { label: 'Cirúrgicos', count: stats.surgical, color: 'amber' },
              { label: 'Pediátrico', count: stats.pediatric, color: 'indigo' },
              { label: 'UTI', count: stats.uti, color: 'emerald' },
            ].map(item => (
              <div key={item.label} className="text-center space-y-2">
                <div className={`text-3xl font-black text-${item.color}-600`}>{item.count}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</div>
                <div className="h-1 bg-slate-50 rounded-full overflow-hidden">
                  <div className={`h-full bg-${item.color}-500`} style={{ width: `${(item.count / (stats.totalVisits || 1)) * 100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ActivityReports;
