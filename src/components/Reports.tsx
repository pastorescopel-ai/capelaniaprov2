
import React from 'react';
import { BibleStudy, BibleClass, SmallGroup, StaffVisit, User, Unit, RecordStatus, Config, ActivityFilter } from '../types';
import { useReports } from '../hooks/useReports';
import ReportStats from './Reports/ReportStats';
import ReportActions from './Reports/ReportActions';
import ChaplainCard from './Reports/ChaplainCard';

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
    pColor,
    proGroups,
    totalStats,
    chaplainStats,
    handleExportExcel,
    handleGenerateOfficialReport,
    handleGeneratePGReport,
    handleGenerateAudit
  } = useReports({ studies, classes, groups, visits, users, config });

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
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 p-6 bg-slate-50 rounded-[2.5rem]">
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Início</label><input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Fim</label><input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm" /></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Capelão</label><select value={filters.selectedChaplain} onChange={e => setFilters({...filters, selectedChaplain: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm"><option value="all">Todos</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Unidade</label><select value={filters.selectedUnit} onChange={e => setFilters({...filters, selectedUnit: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm"><option value="all">Todas</option><option value={Unit.HAB}>HAB</option><option value={Unit.HABA}>HABA</option></select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Atividade</label><select value={filters.selectedActivity} onChange={e => setFilters({...filters, selectedActivity: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm">{Object.values(ActivityFilter).map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Status</label><select value={filters.selectedStatus} onChange={e => setFilters({...filters, selectedStatus: e.target.value as any})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm"><option value="all">Todos</option>{Object.values(RecordStatus).map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
          <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">PG (Relatório)</label><select value={filters.selectedPG} onChange={e => setFilters({...filters, selectedPG: e.target.value})} className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm"><option value="all">Todos os PGs</option>{proGroups.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}</select></div>
        </div>

        <ReportStats totalStats={totalStats} />
      </section>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {chaplainStats.map((stat) => (
          <ChaplainCard key={stat.user.id} stat={stat} />
        ))}
      </div>
    </div>
  );
};

export default Reports;
