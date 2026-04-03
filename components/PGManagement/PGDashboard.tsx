
import React, { useMemo, useState, memo, useEffect } from 'react';
import { Unit, ProHistoryRecord } from '../../types';
import { usePro } from '../../contexts/ProContext';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthProvider';
import { normalizeString, cleanID } from '../../utils/formatters';
import StatusModal from './StatusModal';

interface PGDashboardProps {
  unit: Unit;
}

const PGDashboard: React.FC<PGDashboardProps> = memo(({ unit }) => {
  const { proSectors, proStaff, proGroupMembers, proGroupProviderMembers, proGroupLocations, proGroups, proMonthlyStats, proHistoryRecords } = usePro();
  const { config, saveRecord, deleteRecord, deleteRecordsByFilter, refreshData } = useApp();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'sector' | 'pg'>('sector');
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusModalConfig, setStatusModalConfig] = useState<{ title: string, message: string, type: 'success' | 'error' | 'warning' }>({ title: '', message: '', type: 'success' });
  const [selectedSectorStaff, setSelectedSectorStaff] = useState<{name: string, staff: any[]} | null>(null);
  
  // Estado para o mês de competência selecionado
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return config.activeCompetenceMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  });

  // Sincronizar selectedMonth com config.activeCompetenceMonth se mudar externamente
  useEffect(() => {
    if (config.activeCompetenceMonth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedMonth(config.activeCompetenceMonth);
    }
  }, [config.activeCompetenceMonth]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const metrics = useMemo(() => {
    const targetDate = new Date(selectedMonth + 'T12:00:00');
    const isCurrentMonth = selectedMonth === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59).getTime();
    
    // 0. Verificar se o mês está encerrado (Snapshot de Fechamento)
    const isClosed = proMonthlyStats?.some(s => s.month === selectedMonth);
    const historyForMonth = proHistoryRecords.filter(r => r.month === selectedMonth && r.unit === unit);

    if (isClosed && historyForMonth.length > 0) {
      console.log(`[DEBUG] PGDashboard - Usando SNAPSHOT HISTÓRICO para ${selectedMonth}.`);
      
      // Deduplicar histórico por staffId (caso o snapshot tenha sido gerado com duplicatas)
      const historyMap = new Map<string, ProHistoryRecord>();
      historyForMonth.forEach(r => {
        const sid = cleanID(r.staffId);
        const existing = historyMap.get(sid);
        if (!existing || (r.isEnrolled && !existing.isEnrolled)) {
          historyMap.set(sid, r);
        }
      });
      const uniqueHistory = Array.from(historyMap.values());

      const enrolledStaff = uniqueHistory.filter(r => r.isEnrolled);
      const activePGIds = new Set(enrolledStaff.map(r => cleanID(r.groupId)).filter(id => !!id));
      const groupsById = new Map(proGroups.map(g => [cleanID(g.id), g]));

      const sectorData = proSectors.filter(s => s.unit === unit).map(sector => {
        const sectorIdClean = cleanID(sector.id);
        const staffInSector = uniqueHistory.filter(r => cleanID(r.sectorId) === sectorIdClean);
        const enrolledInSector = staffInSector.filter(r => r.isEnrolled);
        
        const pgsInSectorIds = new Set(enrolledInSector.map(r => cleanID(r.groupId)));
        const pgsInSector = Array.from(pgsInSectorIds).map(gid => groupsById.get(gid)).filter(g => !!g);

        return {
          sector,
          pgsInSector,
          total: staffInSector.length,
          enrolled: enrolledInSector.length,
          pgCount: pgsInSector.length,
          percentage: staffInSector.length > 0 ? (enrolledInSector.length / staffInSector.length) * 100 : 0,
          isSnapshot: true,
          staffList: staffInSector.map(r => ({ id: r.staffId, name: r.staffName, isEnrolled: r.isEnrolled }))
        };
      });

      // Adicionar "Sem Setor" do histórico
      const unassignedInHistory = uniqueHistory.filter(r => r.sectorId === 'unassigned' || !r.sectorId);
      if (unassignedInHistory.length > 0) {
        const enrolledUnassigned = unassignedInHistory.filter(r => r.isEnrolled);
        sectorData.push({
          sector: { id: 'unassigned', name: 'SEM SETOR DEFINIDO', unit } as any,
          pgsInSector: [],
          total: unassignedInHistory.length,
          enrolled: enrolledUnassigned.length,
          pgCount: 0,
          percentage: (enrolledUnassigned.length / unassignedInHistory.length) * 100,
          isSnapshot: true
        });
      }

      const totalStaff = uniqueHistory.length;
      const enrolledStaffCount = enrolledStaff.length;
      const globalPercentage = totalStaff > 0 ? (enrolledStaffCount / totalStaff) * 100 : 0;

      // Filtro de Busca
      const normSearch = normalizeString(debouncedSearchTerm);
      const searchTerms = normSearch.split(' ').filter(t => t);
      const filteredData = sectorData.filter(d => {
          if (searchTerms.length === 0) return d.total > 0;
          const targetText = filterType === 'sector' ? d.sector.name : d.pgsInSector.map(pg => pg?.name || '').join(' ');
          const normTarget = normalizeString(targetText);
          return searchTerms.every(term => normTarget.includes(term)) && d.total > 0;
      });

      return {
        globalPercentage,
        totalStaff,
        enrolledStaff: enrolledStaffCount,
        activePGCount: activePGIds.size,
        displaySectors: filteredData.sort((a, b) => a.percentage - b.percentage)
      };
    }

    console.log("[DEBUG] PGDashboard - Usando dados OPERACIONAIS (Tempo Real).");

    // 1. Filtrar setores e staff da unidade (Tratando duplicatas de ID)
    const staffMap = new Map<string, any>();
    proStaff.forEach(s => {
      if (s.unit !== unit) return;
      
      // 1. Verificar se já existia no mês (Criado antes do fim do mês)
      const createdDate = s.createdAt ? (typeof s.createdAt === 'string' ? new Date(s.createdAt).getTime() : s.createdAt) : null;
      if (createdDate && createdDate > monthEnd) return;

      // Fallback: Se não tem createdAt, usamos o cycleMonth como pista
      if (!createdDate && s.cycleMonth) {
        const cycleDate = new Date(s.cycleMonth + 'T12:00:00').getTime();
        if (cycleDate > monthEnd) return;
      }

      // 2. Verificar se ainda estava na unidade no mês (Saiu depois do início do mês ou ainda não saiu)
      const leftDate = s.leftAt ? (typeof s.leftAt === 'string' ? new Date(s.leftAt).getTime() : s.leftAt) : null;
      if (leftDate && leftDate < targetDate.getTime()) return;

      // Se o mês selecionado é o ATUAL, respeitamos o flag active.
      // Se é um mês PASSADO (aberto), ignoramos o active=false se ele saiu DEPOIS do mês.
      if (isCurrentMonth && s.active === false) return;

      const idClean = cleanID(s.id);
      const existing = staffMap.get(idClean);
      // Se houver duplicata de ID no banco, priorizamos o registro ativo
      if (!existing || (s.active && !existing.active)) {
        staffMap.set(idClean, s);
      }
    });

    const unitStaff = Array.from(staffMap.values());

    const unitSectors = proSectors.filter(s => s.unit === unit && (isCurrentMonth ? s.active !== false : true));

    // Otimização: Dicionários para buscas O(1)
    const validSectorIds = new Set(unitSectors.map(s => cleanID(s.id)));
    const groupsById = new Map(proGroups.map(g => [cleanID(g.id), g]));
    
    const enrolledStaffIds = new Set<string>();
    const memberGroupIdsBySector = new Map<string, Set<string>>();
    const activePGIds = new Set<string>();

    proGroupMembers.forEach(m => {
      const group = groupsById.get(cleanID(m.groupId));
      if (!group || group.unit !== unit) return;

      const mCycleDate = m.cycleMonth ? new Date(m.cycleMonth + 'T12:00:00').getTime() : 0;
      const mLeftDate = m.leftAt ? (typeof m.leftAt === 'string' ? new Date(m.leftAt).getTime() : m.leftAt) : null;

      if ((!m.cycleMonth || mCycleDate <= monthEnd) && 
          (!mLeftDate || mLeftDate >= targetDate.getTime())) {
        enrolledStaffIds.add(cleanID(m.staffId));
        activePGIds.add(cleanID(m.groupId));
      }
    });

    // Também contar PGs que tem apenas prestadores
    (proGroupProviderMembers || []).forEach(m => {
      const group = groupsById.get(cleanID(m.groupId));
      if (!group || group.unit !== unit) return;

      const mCycleDate = m.cycleMonth ? new Date(m.cycleMonth + 'T12:00:00').getTime() : 0;
      const mLeftDate = m.leftAt ? (typeof m.leftAt === 'string' ? new Date(m.leftAt).getTime() : m.leftAt) : null;

      if ((!m.cycleMonth || mCycleDate <= monthEnd) && 
          (!mLeftDate || mLeftDate >= targetDate.getTime())) {
        activePGIds.add(cleanID(m.groupId));
      }
    });

    // Mapeamento de staff por setor para eficiência e para identificar "Sem Setor"
    const staffBySector = new Map<string, any[]>();
    const unassignedStaff: any[] = [];
    const sectorIdByStaffId = new Map<string, string>();

    unitStaff.forEach(s => {
      const sId = cleanID(s.sectorId);
      const staffIdClean = cleanID(s.id);
      if (sId && validSectorIds.has(sId)) {
        if (!staffBySector.has(sId)) staffBySector.set(sId, []);
        staffBySector.get(sId)?.push(s);
        sectorIdByStaffId.set(staffIdClean, sId);
      } else {
        unassignedStaff.push(s);
        sectorIdByStaffId.set(staffIdClean, 'unassigned');
      }
    });

    proGroupMembers.forEach(m => {
      if (!m.leftAt || m.leftAt >= targetDate.getTime()) {
        const staffIdClean = cleanID(m.staffId);
        const sId = sectorIdByStaffId.get(staffIdClean);
        if (sId) {
          if (!memberGroupIdsBySector.has(sId)) memberGroupIdsBySector.set(sId, new Set());
          memberGroupIdsBySector.get(sId)?.add(cleanID(m.groupId));
        }
      }
    });

    const geoGroupIdsBySector = new Map<string, Set<string>>();
    proGroupLocations.forEach(loc => {
      const sId = cleanID(loc.sectorId);
      if (!geoGroupIdsBySector.has(sId)) geoGroupIdsBySector.set(sId, new Set());
      geoGroupIdsBySector.get(sId)?.add(cleanID(loc.groupId));
    });

    const sectorData = unitSectors.map(sector => {
      const sectorIdClean = cleanID(sector.id);
      const staffInSector = staffBySector.get(sectorIdClean) || [];
      const countTotal = staffInSector.length;
      
      const staffEnrolled = staffInSector.filter(s => enrolledStaffIds.has(cleanID(s.id))).length;

      // --- LÓGICA DE DETECÇÃO DE PGS ATIVOS NO SETOR ---
      const geoGroupIds = geoGroupIdsBySector.get(sectorIdClean) || new Set();
      const memberGroupIds = memberGroupIdsBySector.get(sectorIdClean) || new Set();

      const allGroupIdsInSector = new Set([...Array.from(geoGroupIds), ...Array.from(memberGroupIds)]);
      const pgsInSector = Array.from(allGroupIdsInSector)
        .map(gid => groupsById.get(gid))
        .filter(g => !!g);

      return {
        sector,
        pgsInSector,
        total: countTotal,
        enrolled: staffEnrolled,
        pgCount: pgsInSector.length,
        percentage: countTotal > 0 ? (staffEnrolled / countTotal) * 100 : 0,
        staffList: staffInSector.map(s => ({ id: s.id, name: s.name, isEnrolled: enrolledStaffIds.has(cleanID(s.id)), active: s.active }))
      };
    });

    // Adicionar "Sem Setor" se houver colaboradores órfãos
    if (unassignedStaff.length > 0) {
      const enrolledUnassigned = unassignedStaff.filter(s => enrolledStaffIds.has(cleanID(s.id))).length;

      sectorData.push({
        sector: { id: 'unassigned', name: 'SEM SETOR DEFINIDO', unit } as any,
        pgsInSector: [],
        total: unassignedStaff.length,
        enrolled: enrolledUnassigned,
        pgCount: 0,
        percentage: (enrolledUnassigned / unassignedStaff.length) * 100,
        staffList: unassignedStaff.map(s => ({ id: s.id, name: s.name, isEnrolled: enrolledStaffIds.has(cleanID(s.id)), active: s.active }))
      });
    }

    // Filtro de Busca Inteligente
    const normSearch = normalizeString(debouncedSearchTerm);
    const searchTerms = normSearch.split(' ').filter(t => t);

    const filteredData = sectorData.filter(d => {
        if (searchTerms.length === 0) return d.total > 0;
        
        const targetText = filterType === 'sector' 
            ? d.sector.name 
            : d.pgsInSector.map(pg => pg?.name || '').join(' '); // Combina nomes dos PGs
            
        const normTarget = normalizeString(targetText);
        
        // Verifica se todos os termos estão presentes no texto alvo
        return searchTerms.every(term => normTarget.includes(term)) && d.total > 0;
    });

    let totalStaff = 0;
    let enrolledStaff = 0;
    
    // KPIs globais baseados nos dados totais da unidade
    sectorData.forEach(d => {
        totalStaff += d.total;
        enrolledStaff += d.enrolled;
    });

    const globalPercentage = totalStaff > 0 ? (enrolledStaff / totalStaff) * 100 : 0;

    // DETECÇÃO DE DUPLICATAS PARA EXIBIÇÃO NO UI
    let duplicateError: string | null = null;
    if (!isClosed) {
      const idCounts = new Map<string, number>();
      const duplicates: string[] = [];
      
      proStaff.forEach(s => {
        if (s.unit === unit) {
          const id = cleanID(s.id);
          const createdDate = s.createdAt ? (typeof s.createdAt === 'string' ? new Date(s.createdAt).getTime() : s.createdAt) : 0;
          const leftAt = s.leftAt ? (typeof s.leftAt === 'string' ? new Date(s.leftAt).getTime() : s.leftAt) : null;
          const wasActiveInMonth = createdDate <= monthEnd && (!leftAt || leftAt >= targetDate.getTime());
          
          if (wasActiveInMonth) {
            idCounts.set(id, (idCounts.get(id) || 0) + 1);
            if (idCounts.get(id) === 2) duplicates.push(id);
          }
        }
      });

      if (duplicates.length > 0) {
        duplicateError = `DETECTADO: ${duplicates.length} IDs duplicados ativos para ${selectedMonth}. IDs: ${duplicates.join(', ')}. Isso causa a diferença no contador (1701 vs 1700).`;
      }
    }

    return { 
        globalPercentage, 
        totalStaff, 
        enrolledStaff, 
        activePGCount: activePGIds.size,
        displaySectors: filteredData.sort((a, b) => a.percentage - b.percentage),
        duplicateError
    };
  }, [proSectors, proStaff, proGroupMembers, proGroupProviderMembers, proGroupLocations, proGroups, unit, debouncedSearchTerm, filterType, selectedMonth, proHistoryRecords, proMonthlyStats]);

  // Gerar opções de meses (Últimos 6 meses)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: d.toISOString().split('T')[0],
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
