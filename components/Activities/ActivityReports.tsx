import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthProvider';
import { Unit, UserRole } from '../../types';
import { useToast } from '../../contexts/ToastProvider';
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
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  });
  const [selectedUser, setSelectedUser] = useState<string>(isAdmin ? '' : (currentUser?.id || ''));

  const chaplains = useMemo(() => 
    users.filter(u => u.role === UserRole.CHAPLAIN || u.role === UserRole.INTERN || u.role === UserRole.ADMIN),
    [users]
  );

  const filteredReports = useMemo(() => 
    dailyActivityReports.filter(r => 
      r.unit === selectedUnit && 
      r.date === selectedDate && 
      (selectedUser ? r.userId === selectedUser : true)
    ),
    [dailyActivityReports, selectedUnit, selectedDate, selectedUser]
  );

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
      observations: ''
    };

    return filteredReports.reduce((acc, report) => {
      const blueprintLen = report.completedBlueprints?.length || 0;
      const cultLen = report.completedCults?.length || 0;
      const encontroVal = report.completedEncontro ? 1 : 0;
      const visiteCantandoVal = report.completedVisiteCantando ? 1 : 0;

      acc.totalActivities += blueprintLen + cultLen + encontroVal + visiteCantandoVal;
      acc.totalVisits += (report.palliativeCount || 0) + (report.surgicalCount || 0) + (report.pediatricCount || 0) + (report.utiCount || 0);
      
      acc.blueprintCount += blueprintLen;
      acc.cultCount += cultLen;
      acc.encontroCount += encontroVal;
      acc.visiteCantandoCount += visiteCantandoVal;

      acc.palliativeCount += (report.palliativeCount || 0);
      acc.surgicalCount += (report.surgicalCount || 0);
      acc.pediatricCount += (report.pediatricCount || 0);
      acc.utiCount += (report.utiCount || 0);
      
      if (report.observations) {
        acc.observations += (acc.observations ? ' | ' : '') + report.observations;
      }

      return acc;
    }, initial);
  }, [filteredReports]);

  const handleExportPDF = async () => {
    if (filteredReports.length === 0) {
      showToast("Não há dados para exportar nesta data.", "warning");
      return;
    }

    const chaplain = selectedUser ? users.find(u => u.id === selectedUser) : { name: 'Relatório Consolidado' } as any;

    const visitDetails = [
      { label: 'Paliativos', value: stats.palliativeCount },
      { label: 'Cirúrgicos', value: stats.surgicalCount },
      { label: 'Pediátricos', value: stats.pediatricCount },
      { label: 'UTI', value: stats.utiCount }
    ];

    try {
      const html = generateActivityReportHTML(
        config,
        selectedDate,
        chaplain,
        stats,
        visitDetails
      );
      await generatePdf(html);
      showToast("Relatório exportado com sucesso!", "success");
    } catch (error) {
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
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">2. Data do Relatório</label>
          <div className="relative">
            <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-100 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">3. Capelão</label>
          <div className="flex gap-2">
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              disabled={!isAdmin}
              className="flex-1 p-3 bg-slate-100 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-50"
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
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Atividades</p>
            <p className="text-2xl font-black text-slate-800">{stats.totalActivities}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visitas</p>
            <p className="text-2xl font-black text-slate-800">{stats.totalVisits}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Blueprint</p>
            <p className="text-2xl font-black text-slate-800">{stats.blueprintCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
            <MapPin size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Setores</p>
            <p className="text-2xl font-black text-slate-800">{stats.cultCount}</p>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
            <Users size={18} className="text-indigo-600" />
            Distribuição de Visitas
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Paliativos', value: stats.palliativeCount, color: 'bg-indigo-500' },
              { label: 'Cirúrgicos', value: stats.surgicalCount, color: 'bg-emerald-500' },
              { label: 'Pediátricos', value: stats.pediatricCount, color: 'bg-amber-500' },
              { label: 'UTI', value: stats.utiCount, color: 'bg-rose-500' },
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

      {/* Individual Reports Section */}
      <div className="space-y-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2 ml-2">
          <Users size={18} className="text-indigo-600" />
          Relatórios Individuais ({filteredReports.length})
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredReports.map(report => {
            const chaplain = users.find(u => u.id === report.userId);
            const totalVisits = (report.palliativeCount || 0) + (report.surgicalCount || 0) + (report.pediatricCount || 0) + (report.utiCount || 0);
            
            return (
              <div key={report.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm uppercase">
                      {chaplain?.name?.substring(0, 2) || '??'}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{chaplain?.name || 'Capelão Desconhecido'}</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Relatório Enviado</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest">
                      {totalVisits} Visitas
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-6 flex-1">
                  {/* Visitas Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                      <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Paliativos</p>
                      <p className="text-sm font-black text-indigo-900">{report.palliativeCount || 0}</p>
                    </div>
                    <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                      <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Cirúrgicos</p>
                      <p className="text-sm font-black text-emerald-900">{report.surgicalCount || 0}</p>
                    </div>
                    <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                      <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest mb-1">Pediátricos</p>
                      <p className="text-sm font-black text-amber-900">{report.pediatricCount || 0}</p>
                    </div>
                    <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                      <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">UTI</p>
                      <p className="text-sm font-black text-rose-900">{report.utiCount || 0}</p>
                    </div>
                  </div>

                  {/* Atividades */}
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Atividades Concluídas</p>
                    <div className="flex flex-wrap gap-2">
                      {report.completedBlueprints?.map((loc, idx) => (
                        <span 
                          key={`bp-${idx}`}
                          className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tight border bg-indigo-50 text-indigo-600 border-indigo-100"
                        >
                          {loc}
                        </span>
                      ))}
                      {report.completedCults?.map((sectorId, idx) => {
                        const sectorName = proSectors.find(s => s.id === sectorId)?.name || 'Setor';
                        return (
                          <span 
                            key={`cult-${idx}`}
                            className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tight border bg-emerald-50 text-emerald-600 border-emerald-100"
                          >
                            {sectorName}
                          </span>
                        );
                      })}
                      {report.completedEncontro && (
                        <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tight border bg-amber-50 text-amber-600 border-amber-100">
                          Encontro HAB
                        </span>
                      )}
                      {report.completedVisiteCantando && (
                        <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tight border bg-rose-50 text-rose-600 border-rose-100">
                          Visite Cantando
                        </span>
                      )}
                      {(!report.completedBlueprints?.length && !report.completedCults?.length && !report.completedEncontro && !report.completedVisiteCantando) && (
                        <span className="text-[9px] font-bold text-slate-400 italic">Nenhuma atividade registrada</span>
                      )}
                    </div>
                  </div>

                  {/* Observações */}
                  {report.observations && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações</p>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-medium text-slate-600 leading-relaxed italic">
                          "{report.observations}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredReports.length === 0 && (
            <div className="col-span-full py-12 bg-white rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Search size={48} strokeWidth={1} />
              <p className="text-xs font-black uppercase tracking-widest">Nenhum relatório individual encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityReports;
