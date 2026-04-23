
import React, { useMemo, useState, memo, useEffect } from 'react';
import { Unit, ProHistoryRecord } from '../../types';
import { usePro } from '../../contexts/ProContext';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthContext';
import { getTimestamp, normalizeString, cleanID, formatMonthLabel } from '../../utils/formatters';
import StatusModal from './StatusModal';

interface PGDashboardProps {
  unit: Unit;
}

import { calculateDashboardMetrics } from '../../utils/metricsEngine';

const PGDashboard: React.FC<PGDashboardProps> = memo(({ unit }) => {
  const { proSectors, proStaff, proGroupMembers, proGroupProviderMembers, proGroupLocations, proGroups, proMonthlyStats, proHistoryRecords } = usePro();
  const { config } = useApp();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'sector' | 'pg'>('sector');
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusModalConfig, setStatusModalConfig] = useState<{ title: string, message: string, type: 'success' | 'error' | 'warning' }>({ title: '', message: '', type: 'success' });
  const [selectedSectorStaff, setSelectedSectorStaff] = useState<{name: string, staff: any[]} | null>(null);
  
  // Estado para o mês de competência selecionado
  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (config.activeCompetenceMonth) return config.activeCompetenceMonth;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
  });

  // Lógica de Detecção de Mês Fechado
  const isMonthClosed = useMemo(() => {
    const activeMonthRaw = config.activeCompetenceMonth || new Date().toLocaleDateString('en-CA');
    const activeMonth = activeMonthRaw.substring(0, 7) + '-01';
    const hasClosingSnapshot = proMonthlyStats.some(s => s.month === selectedMonth && s.unit === unit && s.targetId === 'all');
    return (selectedMonth < activeMonth) || hasClosingSnapshot;
  }, [selectedMonth, config.activeCompetenceMonth, proMonthlyStats, unit]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const metrics = useMemo(() => {
    return calculateDashboardMetrics(
      unit,
      selectedMonth,
      proSectors,
      proStaff,
      proGroupMembers,
      proGroupProviderMembers,
      proGroupLocations,
      proGroups,
      proMonthlyStats,
      proHistoryRecords,
      debouncedSearchTerm,
      filterType
    );
  }, [proSectors, proStaff, proGroupMembers, proGroupProviderMembers, proGroupLocations, proGroups, unit, debouncedSearchTerm, filterType, selectedMonth, proHistoryRecords, proMonthlyStats]);

  // Gerar opções de meses (Últimos 12 meses para garantir que Fevereiro/Março apareçam)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const iso = d.toLocaleDateString('en-CA');
        options.push({
            value: iso,
            label: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d)
        });
    }
    return options;
  }, []);

  const showStatus = (title: string, message: string, type: 'success' | 'error' | 'warning') => {
    setStatusModalConfig({ title, message, type });
    setIsStatusModalOpen(true);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <StatusModal 
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={statusModalConfig.title}
        message={statusModalConfig.message}
        type={statusModalConfig.type}
      />
      
      {/* Status Técnico (Log de Erros) */}
      {metrics.duplicateError && (
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <i className="fas fa-bug text-xs"></i>
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-800">Status Técnico (Depuração)</h4>
          </div>
          <div className="bg-white/50 p-3 rounded-xl border border-rose-100/50">
            <code className="text-[10px] font-mono text-rose-600 break-all">
              {metrics.duplicateError}
            </code>
          </div>
          <p className="mt-2 text-[9px] font-bold text-rose-400 uppercase tracking-tight">
            Este erro ocorreu durante a comunicação com o banco de dados. Verifique os tipos de dados ou permissões.
          </p>
        </div>
      )}

      {/* Filtro de Competência */}
      <div className="flex justify-center md:justify-end">
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2">
          <i className="fas fa-calendar-alt text-slate-400 ml-3 text-xs"></i>
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent border-none font-black text-[10px] uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer pr-8"
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Aviso de Mês Fechado */}
      {isMonthClosed && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-top-4 duration-500 shadow-sm">
          <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-amber-200 shrink-0">
            <i className="fas fa-lock"></i>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Período de Competência Encerrado</h4>
            <p className="text-amber-700/70 text-[10px] font-bold uppercase tracking-wide mt-1">
              Os dados de {formatMonthLabel(selectedMonth)} estão consolidados no histórico e não podem mais ser alterados. 
              Gere os relatórios finais para esta competência.
            </p>
          </div>
          <div className="shrink-0 flex gap-2">
            <span className="px-4 py-2 bg-white border border-amber-200 text-amber-700 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm">
              Snapshot Ativo
            </span>
          </div>
        </div>
      )}

      {/* KPI Global */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-[#005a9c]"></div>
        
        <div className="flex flex-col z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Cobertura de Discipulado (HAB) ou (HABA)</h2>
            {metrics.displaySectors[0]?.isSnapshot && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-amber-200">
                <i className="fas fa-lock mr-1"></i> Mês Fechado
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Colaboradores matriculados em Pequenos Grupos</p>
        </div>

        <div className="flex items-center gap-6 md:gap-8 z-10">
          <div className="text-right">
            <span className="block text-4xl font-black text-slate-800">{metrics.activePGCount}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PGs Ativos</span>
          </div>

          <div className="w-px h-12 bg-slate-100 hidden sm:block"></div>

          <div className="text-right">
            <span className="block text-4xl font-black text-slate-800">{metrics.enrolledStaff} <span className="text-lg text-slate-400">/ {metrics.totalStaff}</span></span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vidas Alcançadas</span>
          </div>
          
          <div className="relative w-32 h-32 flex items-center justify-center">
             <svg className="w-full h-full transform -rotate-90">
               <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
               <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" 
                 strokeDasharray={351.86} 
                 strokeDashoffset={351.86 - (351.86 * metrics.globalPercentage) / 100} 
                 className={`${metrics.globalPercentage >= 80 ? 'text-emerald-500' : metrics.globalPercentage >= 50 ? 'text-amber-400' : 'text-rose-500'} transition-all duration-1000 ease-out`} 
               />
             </svg>
             <span className="absolute text-xl font-black text-slate-700">{Math.round(metrics.globalPercentage)}%</span>
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button 
            onClick={() => setFilterType('sector')}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'sector' ? 'bg-white text-[#005a9c] shadow-sm' : 'text-slate-400'}`}
          >
            <i className="fas fa-building mr-2"></i> Setor
          </button>
          <button 
            onClick={() => setFilterType('pg')}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'pg' ? 'bg-white text-[#005a9c] shadow-sm' : 'text-slate-400'}`}
          >
            <i className="fas fa-users mr-2"></i> Pequeno Grupo
          </button>
        </div>

        <div className="relative group flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <i className="fas fa-search"></i>
          </div>
          <input 
              type="text"
              placeholder={`Buscar por ${filterType === 'sector' ? 'nome do setor' : 'nome do PG'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Lista de Setores */}
      <div className="grid lg:grid-cols-2 gap-6">
        {metrics.displaySectors.length > 0 ? metrics.displaySectors.map((data) => (
          <div key={data.sector.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 hover:border-blue-200 transition-all shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight">{data.sector.name}</h3>
                  <button 
                    onClick={() => setSelectedSectorStaff({ name: data.sector.name, staff: data.staffList || [] })}
                    className="w-6 h-6 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center justify-center"
                    title="Ver lista de colaboradores"
                  >
                    <i className="fas fa-eye text-[10px]"></i>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  {data.pgCount} PGs atuantes • {data.enrolled} de {data.total} Colaboradores
                </p>
              </div>
              <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                data.percentage >= 80 ? 'bg-emerald-100 text-emerald-700' : 
                data.percentage >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {Math.round(data.percentage)}%
              </span>
            </div>
            
            {/* Barra de Progresso */}
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
              <div 
                className={`h-full rounded-full ${
                  data.percentage >= 80 ? 'bg-emerald-500' : 
                  data.percentage >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                }`} 
                style={{ width: `${data.percentage}%` }}
              ></div>
            </div>
            
            {/* Meta Marker */}
            <div className="relative h-4 w-full">
               <div className="absolute top-0 bottom-0 w-0.5 bg-slate-300 border-l border-dashed" style={{ left: '80%' }}></div>
               <span className="absolute top-1 text-[8px] font-black text-slate-400" style={{ left: '80%', transform: 'translateX(-50%)' }}>Meta 80%</span>
            </div>
          </div>
        )) : (
            <div className="lg:col-span-2 py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                <p className="text-slate-400 font-bold uppercase tracking-widest">Nenhum resultado para "{searchTerm}"</p>
            </div>
        )}
      </div>

      {/* Modal de Lista de Colaboradores */}
      {selectedSectorStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Auditando: {selectedSectorStaff.name}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total de {selectedSectorStaff.staff.length} colaboradores contados</p>
              </div>
              <button 
                onClick={() => setSelectedSectorStaff(null)}
                className="w-12 h-12 rounded-2xl bg-white text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 transition-all flex items-center justify-center"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-8 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="space-y-3">
                {selectedSectorStaff.staff.sort((a, b) => a.name.localeCompare(b.name)).map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-400 group-hover:text-blue-600 transition-colors">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{s.name}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {s.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.isEnrolled ? (
                        <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
                          <i className="fas fa-check mr-1"></i> Matriculado
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-lg bg-slate-200 text-slate-500 text-[9px] font-black uppercase tracking-widest">
                          Não Matriculado
                        </span>
                      )}
                      {s.active === false && (
                        <span className="px-3 py-1 rounded-lg bg-rose-100 text-rose-700 text-[9px] font-black uppercase tracking-widest">
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-8 bg-slate-50 border-t">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                <i className="fas fa-info-circle mr-1 text-blue-500"></i>
                Nota: Esta lista mostra todos os colaboradores que o sistema considerou ativos para o mês de {formatMonthLabel(selectedMonth)}. Se algum nome não deveria estar aqui, verifique a data de saída (left_at) no banco de dados.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PGDashboard.displayName = 'PGDashboard';

export default PGDashboard;
