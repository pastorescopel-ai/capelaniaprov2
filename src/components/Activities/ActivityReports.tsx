import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthContext';
import { Unit, UserRole } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Calendar as CalendarIcon, Download, FileText, TrendingUp, Users, MapPin, Search } from 'lucide-react';
import { generateActivityReportHTML } from '../../utils/activityTemplates';
import { useDocumentGenerator } from '../../hooks/useDocumentGenerator';

const ActivityReports: React.FC = () => {
  const { users, proSectors, dailyActivityReports, config } = useApp();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { generatePdf, isGenerating: isGeneratingPdf } = useDocumentGenerator();
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const [selectedUnit, setSelectedUnit] = useState<Unit>(Unit.HAB);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return new Date(firstDay.getTime() - offset).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });
  const [selectedUser, setSelectedUser] = useState<string>(isAdmin ? '' : (currentUser?.id || ''));

  const chaplains = useMemo(() => 
    users.filter(u => u.role === UserRole.CHAPLAIN || u.role === UserRole.INTERN),
    [users]
  );

  const filteredReports = useMemo(() => {
    const filtered = dailyActivityReports.filter(r => {
      const user = users.find(u => String(u.id) === String(r.userId));
      const isOperational = user ? (user.role === UserRole.CHAPLAIN || user.role === UserRole.INTERN) : true;
      
      return r.unit === selectedUnit && 
        r.date >= startDate && 
        r.date <= endDate && 
        (selectedUser ? String(r.userId) === String(selectedUser) : isOperational);
    });

    return filtered;
  }, [dailyActivityReports, selectedUnit, startDate, endDate, selectedUser, users]);

  const stats = useMemo(() => {
    const initial = {
      totalActivities: 0,
      totalVisits: 0,
      blueprintCount: 0,
      cultCount: 0,
      encontroCount: 0,
      visiteCantandoCount: 0,
      palliativeCount: 0,
      surgicalCount: 0,
      pediatricCount: 0,
      utiCount: 0,
      terminalCount: 0,
      clinicalCount: 0,
      observations: '',
      // Agregações por localidade
      sectorBreakdown: {} as Record<string, number>,
      blueprintBreakdown: {} as Record<string, number>,
      // Dados por capelão
      chaplainStats: {} as Record<string, any>
    };

    return filteredReports.reduce((acc, report) => {
      const blueprintLen = report.completedBlueprints?.length || 0;
      const cultLen = report.completedCults?.length || 0;
      const encontroVal = report.completedEncontro ? 1 : 0;
      const visiteCantandoVal = report.completedVisiteCantando ? 1 : 0;

      acc.totalActivities += blueprintLen + cultLen + encontroVal + visiteCantandoVal;
      const reportVisits = Number(report.palliativeCount || 0) + Number(report.surgicalCount || 0) + Number(report.pediatricCount || 0) + Number(report.utiCount || 0) + Number(report.terminalCount || 0) + Number(report.clinicalCount || 0);
      acc.totalVisits += reportVisits;
      
      acc.blueprintCount += blueprintLen;
      acc.cultCount += cultLen;
      acc.encontroCount += encontroVal;
      acc.visiteCantandoCount += visiteCantandoVal;

      acc.palliativeCount += Number(report.palliativeCount || 0);
      acc.surgicalCount += Number(report.surgicalCount || 0);
      acc.pediatricCount += Number(report.pediatricCount || 0);
      acc.utiCount += Number(report.utiCount || 0);
      acc.terminalCount += Number(report.terminalCount || 0);
      acc.clinicalCount += Number(report.clinicalCount || 0);

      // Agregação de Blueprints
      report.completedBlueprints?.forEach(loc => {
        const name = loc.split(':')[0];
        acc.blueprintBreakdown[name] = (acc.blueprintBreakdown[name] || 0) + 1;
      });

      // Agregação de Setores
      report.completedCults?.forEach(item => {
        const sectorId = item.split(':')[0];
        const sectorName = proSectors.find(s => s.id === sectorId)?.name || 'Setor Desconhecido';
        acc.sectorBreakdown[sectorName] = (acc.sectorBreakdown[sectorName] || 0) + 1;
      });
      
      // Agregação por Capelão
      const uid = String(report.userId);
      if (!acc.chaplainStats[uid]) {
        acc.chaplainStats[uid] = {
          totalVisits: 0,
          totalActivities: 0,
          palliative: 0,
          surgical: 0,
          pediatric: 0,
          uti: 0,
          terminal: 0,
          clinical: 0,
          blueprints: 0,
          sectors: 0,
          daysWorked: new Set()
        };
      }
      
      const c = acc.chaplainStats[uid];
      c.totalVisits += reportVisits;
      c.totalActivities += (blueprintLen + cultLen + encontroVal + visiteCantandoVal);
      c.palliative += Number(report.palliativeCount || 0);
      c.surgical += Number(report.surgicalCount || 0);
      c.pediatric += Number(report.pediatricCount || 0);
      c.uti += Number(report.utiCount || 0);
      c.terminal += Number(report.terminalCount || 0);
      c.clinical += Number(report.clinicalCount || 0);
      c.blueprints += blueprintLen;
      c.sectors += cultLen;
      c.daysWorked.add(report.date);

      if (report.observations) {
        acc.observations += (acc.observations ? ' | ' : '') + report.observations;
      }

      return acc;
    }, initial);
  }, [filteredReports, proSectors]);

  const sortedChaplainStats = useMemo(() => {
    return Object.entries(stats.chaplainStats).map(([uid, c]) => {
      const user = users.find(u => String(u.id) === uid);
      return {
        id: uid,
        name: user?.name || 'Desconhecido',
        role: user?.role === UserRole.CHAPLAIN ? 'Capelão' : 'Interno',
        ...c,
        avgVisitsPerDay: c.daysWorked.size > 0 ? (c.totalVisits / c.daysWorked.size).toFixed(1) : 0
      };
    }).sort((a, b) => b.totalVisits - a.totalVisits);
  }, [stats.chaplainStats, users]);

  const topLocations = useMemo(() => {
    const combined = [
      ...Object.entries(stats.sectorBreakdown).map(([name, count]) => ({ name, count, type: 'Setor', color: 'bg-emerald-500' })),
      ...Object.entries(stats.blueprintBreakdown).map(([name, count]) => ({ name, count, type: 'Blueprint', color: 'bg-indigo-500' }))
    ].sort((a, b) => b.count - a.count);
    return combined.slice(0, 10);
  }, [stats.sectorBreakdown, stats.blueprintBreakdown]);

  const handleExportPDF = async () => {
    if (filteredReports.length === 0) {
      showToast("Não há dados para exportar nesta data.", "warning");
      return;
    }

    // Group data by chaplain for detailed report
    const chaplainData = chaplains.map(c => {
      const userReports = filteredReports.filter(r => String(r.userId) === String(c.id));
      if (userReports.length === 0) return null;

      const chaplainStats = userReports.reduce((acc, r) => {
        acc.palliative += Number(r.palliativeCount || 0);
        acc.surgical += Number(r.surgicalCount || 0);
        acc.pediatric += Number(r.pediatricCount || 0);
        acc.uti += Number(r.utiCount || 0);
        acc.terminal += Number(r.terminalCount || 0);
        acc.clinical += Number(r.clinicalCount || 0);
        
        r.completedBlueprints?.forEach(loc => acc.locations.add(loc.split(':')[0]));
        r.completedCults?.forEach(id => {
          const sectorName = proSectors.find(s => s.id === id.split(':')[0])?.name || 'Setor';
          acc.locations.add(sectorName);
        });
        if (r.completedEncontro) acc.locations.add('Encontro HAB');
        if (r.completedVisiteCantando) acc.locations.add('Visite Cantando');

        acc.totalActivities += (r.completedBlueprints?.length || 0) + 
                              (r.completedCults?.length || 0) + 
                              (r.completedEncontro ? 1 : 0) + 
                              (r.completedVisiteCantando ? 1 : 0);

        return acc;
      }, { 
        palliative: 0, surgical: 0, pediatric: 0, uti: 0, terminal: 0, clinical: 0, 
        locations: new Set<string>(), totalActivities: 0 
      });

      return {
        name: c.name,
        totalVisits: chaplainStats.palliative + chaplainStats.surgical + chaplainStats.pediatric + 
                    chaplainStats.uti + chaplainStats.terminal + chaplainStats.clinical,
        visits: [
          { label: 'Paliativos', value: chaplainStats.palliative },
          { label: 'Cirúrgicos', value: chaplainStats.surgical },
          { label: 'Pediátricos', value: chaplainStats.pediatric },
          { label: 'UTI', value: chaplainStats.uti },
          { label: 'Terminal', value: chaplainStats.terminal },
          { label: 'Clínico', value: chaplainStats.clinical }
        ],
        locations: Array.from(chaplainStats.locations),
        totalActivities: chaplainStats.totalActivities
      };
    }).filter(Boolean);

    const periodLabel = startDate === endDate ? startDate : `${startDate} a ${endDate}`;

    try {
      const html = generateActivityReportHTML(
        config,
        periodLabel,
        selectedUser ? users.find(u => u.id === selectedUser) : null,
        stats,
        chaplainData
      );
      await generatePdf(html);
      showToast("Relatório exportado com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      showToast("Erro ao gerar PDF do relatório.", "warning");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header / Filters */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 grid md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">1. Unidade</label>
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
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">2. Período do Relatório</label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full pl-9 pr-2 py-3 bg-slate-100 border-none rounded-xl font-bold text-[11px] focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full pl-9 pr-2 py-3 bg-slate-100 border-none rounded-xl font-bold text-[11px] focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">3. Capelão</label>
          <div className="flex gap-2">
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              disabled={!isAdmin}
              className="flex-1 p-3 bg-slate-100 border-none rounded-xl font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
            >
              {isAdmin && <option value="">Todos os Capelães</option>}
              {chaplains.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50"
              title="Exportar PDF"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ... (keep existing stats cards if they are still useful, or replace them) */}
      </div>

      {/* NOVO: Análise Quantitativa por Capelão */}
      <div className="space-y-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2 ml-2">
          < TrendingUp size={18} className="text-indigo-600" />
          Desempenho por Capelão
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {sortedChaplainStats.map(c => (
            <div key={c.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm uppercase">
                    {c.name.substring(0, 2)}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{c.name}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{c.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-black text-indigo-600">{c.totalVisits}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase">Visitas Totais</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Média/Dia</p>
                  <p className="text-sm font-black text-slate-700">{c.avgVisitsPerDay}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Atividades</p>
                  <p className="text-sm font-black text-slate-700">{c.totalActivities}</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Perfil Clínico</p>
                <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100">
                  <div className="bg-indigo-500 h-full" style={{ width: `${(c.palliative / (c.totalVisits || 1)) * 100}%` }} title={`Paliativos: ${c.palliative}`} />
                  <div className="bg-emerald-500 h-full" style={{ width: `${(c.surgical / (c.totalVisits || 1)) * 100}%` }} title={`Cirúrgicos: ${c.surgical}`} />
                  <div className="bg-amber-500 h-full" style={{ width: `${(c.pediatric / (c.totalVisits || 1)) * 100}%` }} title={`Pediátricos: ${c.pediatric}`} />
                  <div className="bg-rose-500 h-full" style={{ width: `${(c.uti / (c.totalVisits || 1)) * 100}%` }} title={`UTI: ${c.uti}`} />
                  <div className="bg-slate-500 h-full" style={{ width: `${(c.terminal / (c.totalVisits || 1)) * 100}%` }} title={`Terminais: ${c.terminal}`} />
                  <div className="bg-blue-500 h-full" style={{ width: `${(c.clinical / (c.totalVisits || 1)) * 100}%` }} title={`Clínicos: ${c.clinical}`} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                   <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /><span className="text-[8px] font-bold text-slate-500 uppercase">Pal: {c.palliative}</span></div>
                   <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[8px] font-bold text-slate-500 uppercase">Cir: {c.surgical}</span></div>
                   <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span className="text-[8px] font-bold text-slate-500 uppercase">Ped: {c.pediatric}</span></div>
                   <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" /><span className="text-[8px] font-bold text-slate-500 uppercase">UTI: {c.uti}</span></div>
                   <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /><span className="text-[8px] font-bold text-slate-500 uppercase">Cli: {c.clinical}</span></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                 <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center">
                    <span className="text-[14px] font-black text-indigo-600">{c.blueprints}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase">Recepc/Bluep</span>
                 </div>
                 <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center">
                    <span className="text-[14px] font-black text-emerald-600">{c.sectors}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase">Setores/Cultos</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NOVO: Mapa de Calor de Localidades */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
            <MapPin size={18} className="text-indigo-600" />
            Top 10 Localidades (Frequência)
          </h3>
          <div className="space-y-4">
            {topLocations.map(loc => (
              <div key={loc.name} className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-slate-500">{loc.name} <span className="text-[8px] opacity-60">({loc.type})</span></span>
                  <span className="text-slate-800">{loc.count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${loc.color} transition-all duration-500`} 
                    style={{ width: `${(loc.count / (topLocations[0]?.count || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {topLocations.length === 0 && (
              <p className="text-center py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma localidade registrada</p>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6 flex flex-col">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
             <TrendingUp size={18} className="text-indigo-600" />
             Resumo do Esforço
          </h3>
          <div className="flex-1 flex flex-col justify-center space-y-8">
             <div className="flex items-center justify-between">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cobertura de Atividades</p>
                   <p className="text-3xl font-black text-indigo-600">{(stats.totalActivities / (filteredReports.length || 1)).toFixed(1)}</p>
                   <p className="text-[8px] font-bold text-slate-400 uppercase">Ações por relatório</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Média do Período</p>
                   <p className="text-3xl font-black text-emerald-600">{(stats.totalVisits / (filteredReports.length || 1)).toFixed(1)}</p>
                   <p className="text-[8px] font-bold text-slate-400 uppercase">Visitas por relatório</p>
                </div>
             </div>
             
             <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <TrendingUp size={14} className="text-indigo-600" />
                   Tendência do Grupo
                </p>
                <p className="text-xs font-medium text-slate-600 leading-relaxed italic">
                   No período selecionado, a equipe realizou uma média de {((stats.totalVisits + stats.totalActivities) / (filteredReports.length || 1)).toFixed(1)} intervenções (visitas + atividades) por dia de trabalho registrado, com foco em {topLocations[0]?.name || 'locais diversos'}.
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* Details Section (Keep original distribution charts but maybe refine) */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
            <Users size={18} className="text-indigo-600" />
            Distribuição Geral de Visitas
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Paliativos', value: stats.palliativeCount, color: 'bg-indigo-500' },
              { label: 'Cirúrgicos', value: stats.surgicalCount, color: 'bg-emerald-500' },
              { label: 'Pediátricos', value: stats.pediatricCount, color: 'bg-amber-500' },
              { label: 'UTI', value: stats.utiCount, color: 'bg-rose-500' },
              { label: 'Terminal', value: stats.terminalCount, color: 'bg-slate-500' },
              { label: 'Clínico', value: stats.clinicalCount, color: 'bg-blue-500' },
            ].map(item => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="text-slate-800">{item.value}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.color} transition-all duration-500`} 
                    style={{ width: `${stats.totalVisits > 0 ? (item.value / stats.totalVisits) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" />
            Observações Consolidadas
          </h3>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 min-h-[200px]">
            {stats.observations ? (
              <p className="text-xs font-medium text-slate-600 leading-relaxed italic">
                "{stats.observations}"
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <Search size={32} strokeWidth={1} />
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma observação registrada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityReports;
