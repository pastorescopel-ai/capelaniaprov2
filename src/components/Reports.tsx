
import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Unit, RecordStatus, Config, ActivityFilter } from '../types';
import { useReports } from '../hooks/useReports';
import ReportStats from './Reports/ReportStats';
import ReportActions from './Reports/ReportActions';
import ChaplainCard from './Reports/ChaplainCard';
import ChaplainComparisonModal from './Reports/ChaplainComparisonModal';

interface ReportsProps {
  studies: BibleStudy[];
  classes: BibleClass[];
  groups: SmallGroup[];
  visits: StaffVisit[];
  users: User[];
  currentUser: User;
  config: Config;
  onRefresh?: () => Promise<any>;
}

const Reports: React.FC<ReportsProps> = ({ studies, classes, groups, visits, users, currentUser, config }) => {
  const {
    filters,
    setFilters,
    loadingAction,
    isGenerating,
    isLoadingHistoricalAttendees,
    pColor,
    proGroups,
    totalStats,
    chaplainStats,
    handleExportExcel,
    handleGenerateOfficialReport,
    handleGeneratePGReport,
    handleGenerateAudit
  } = useReports({ studies, classes, groups, visits, users, config });

  // Média de ações do time no período filtrado -- usada só pelo Panorama de cada capelão
  // (dentro do ChaplainCard) pra mostrar "Vs. Média Equipe". Conta só quem teve alguma ação,
  // senão capelães sem nenhum registro no período puxariam a média pra baixo à toa.
  const avgTeamActions = useMemo(() => {
    const active = chaplainStats.filter((s: any) => s.totalActions > 0);
    if (active.length === 0) return 0;
    return active.reduce((sum: number, s: any) => sum + s.totalActions, 0) / active.length;
  }, [chaplainStats]);

  // Comparação entre capelães: até 2 cards abertos ao mesmo tempo "furam a fila" pro topo da
  // grade (lado a lado) e passam a compartilhar o mesmo mês selecionado -- clicar num mês em
  // qualquer um dos dois já atualiza os dois. Abrir um 3º fecha o mais antigo automaticamente.
  const [openChaplainIds, setOpenChaplainIds] = useState<string[]>([]);
  const [sharedMonthKey, setSharedMonthKey] = useState<string | null>(null);
  // Ranking com todos os capelães, aberto ao clicar em "Vs. Média Equipe" dentro do Panorama.
  const [comparisonUserId, setComparisonUserId] = useState<string | null>(null);
  const toggleChaplainOpen = (id: string) => {
    setOpenChaplainIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      const next = [...prev, id];
      return next.length > 2 ? next.slice(next.length - 2) : next;
    });
  };

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-500">
      <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Relatórios Digitais</h1>
          <ReportActions 
            pColor={pColor} 
            generating={isGenerating ? loadingAction : null} 
            onPdf={handleGenerateOfficialReport} 
            onExcel={handleExportExcel} 
            onAuditVidas={() => handleGenerateAudit('students')} 
            onAuditVisitas={() => handleGenerateAudit('visits')}
            onPGReport={handleGeneratePGReport}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 p-6 bg-slate-50 rounded-[2.5rem]">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Início</label><input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Fim</label><input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Capelão</label><select value={filters.selectedChaplain} onChange={e => setFilters({...filters, selectedChaplain: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm"><option value="all">Todos</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Unidade</label><select value={filters.selectedUnit} onChange={e => setFilters({...filters, selectedUnit: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm"><option value="all">Todas</option><option value={Unit.HAB}>HAB</option><option value={Unit.HABA}>HABA</option></select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Atividade</label><select value={filters.selectedActivity} onChange={e => setFilters({...filters, selectedActivity: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm">{Object.values(ActivityFilter).map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status</label><select value={filters.selectedStatus} onChange={e => setFilters({...filters, selectedStatus: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm"><option value="all">Todos</option>{Object.values(RecordStatus).map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">PG (Relatório)</label><select value={filters.selectedPG} onChange={e => setFilters({...filters, selectedPG: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm"><option value="all">Todos os PGs</option>{proGroups.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}</select></div>
        </div>

        {isLoadingHistoricalAttendees && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-2xl text-[10px] font-black uppercase tracking-widest">
            <i className="fas fa-spinner fa-spin"></i>
            Buscando presenças de classes bíblicas mais antigas para completar o período selecionado...
          </div>
        )}

        <ReportStats totalStats={totalStats} />
      </section>

      {openChaplainIds.length >= 2 && (
        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest -mb-4 flex items-center gap-1.5">
          <i className="fas fa-arrows-left-right text-[9px]"></i> Comparando 2 capelães -- toque num mês em qualquer um dos dois pra ver o mesmo mês nos dois
        </p>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {chaplainStats.map((stat, idx) => {
          const openIndex = openChaplainIds.indexOf(stat.user.id);
          const isOpen = openIndex !== -1;
          const isComparing = openChaplainIds.length >= 2 && isOpen;
          return (
            <motion.div key={stat.user.id} layout transition={{ type: 'spring', stiffness: 300, damping: 30 }} style={{ order: isOpen ? openIndex : 100 + idx }}>
              <ChaplainCard
                stat={stat}
                avgTeamActions={avgTeamActions}
                studies={studies}
                classes={classes}
                groups={groups}
                visits={visits}
                isOpen={isOpen}
                onToggleOpen={() => toggleChaplainOpen(stat.user.id)}
                selectedMonthKey={sharedMonthKey}
                onSelectMonth={setSharedMonthKey}
                isComparing={isComparing}
                onOpenComparison={() => setComparisonUserId(stat.user.id)}
              />
            </motion.div>
          );
        })}
      </div>

      <ChaplainComparisonModal
        chaplainStats={chaplainStats}
        avgTeamActions={avgTeamActions}
        highlightedUserId={comparisonUserId}
        onClose={() => setComparisonUserId(null)}
      />
    </div>
  );
};

export default Reports;
