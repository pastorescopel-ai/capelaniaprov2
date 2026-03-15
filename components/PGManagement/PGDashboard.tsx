
import React, { useMemo, useState } from 'react';
import { Unit } from '../../types';
import { useApp } from '../../hooks/useApp';
import { normalizeString, cleanID } from '../../utils/formatters';

interface PGDashboardProps {
  unit: Unit;
}

const PGDashboard: React.FC<PGDashboardProps> = ({ unit }) => {
  const { proSectors, proStaff, proGroupMembers, proGroupLocations, proGroups, proMonthlyStats } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'sector' | 'pg'>('sector');
  
  // Estado para o mês de competência selecionado (Padrão: Mês Atual)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });

  const metrics = useMemo(() => {
    const targetDate = new Date(selectedMonth);
    const nextMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);

    // 0. Verificar se existem snapshots para o mês selecionado
    const snapshots = proMonthlyStats.filter(s => s.month === selectedMonth && s.unit === unit);
    
    if (snapshots.length > 0) {
      const sectorSnaps = snapshots.filter(s => s.type === 'sector');
      const pgSnaps = snapshots.filter(s => s.type === 'pg');

      const sectorData = sectorSnaps.map(snap => {
        const sector = proSectors.find(s => cleanID(s.id) === cleanID(snap.targetId));
        const sectorName = snap.targetId === 'unassigned' ? 'SEM SETOR DEFINIDO' : (sector?.name || 'Setor Excluído');
        
        // Se temos snapshots de PGs, usamos eles, senão fallback para os atuais
        const pgsInSector = pgSnaps.length > 0 
          ? pgSnaps
              .filter(ps => {
                  const pg = proGroups.find(g => cleanID(g.id) === cleanID(ps.targetId));
                  // Aqui precisaríamos saber a qual setor o PG pertencia no snapshot. 
                  // Como o snapshot de PG não guarda o setor_id, usamos a localização atual como melhor esforço
                  return proGroupLocations.some(loc => cleanID(loc.groupId) === cleanID(ps.targetId) && cleanID(loc.sectorId) === cleanID(snap.targetId));
              })
              .map(ps => proGroups.find(g => cleanID(g.id) === cleanID(ps.targetId)))
              .filter(g => !!g)
          : proGroupLocations
              .filter(loc => cleanID(loc.sectorId) === cleanID(snap.targetId))
              .map(loc => proGroups.find(g => cleanID(g.id) === cleanID(loc.groupId)))
              .filter(g => !!g);

        return {
          sector: sector || { id: snap.targetId, name: sectorName, unit: snap.unit } as any,
          pgsInSector,
          total: snap.totalStaff,
          enrolled: snap.totalParticipants,
          pgCount: pgsInSector.length,
          percentage: snap.percentage,
          isSnapshot: true
        };
      });

      // Filtro de Busca Inteligente
      const normSearch = normalizeString(searchTerm);
      const searchTerms = normSearch.split(' ').filter(t => t);

      const filteredData = sectorData.filter(d => {
          if (searchTerms.length === 0) return d.total > 0;
          const targetText = filterType === 'sector' ? d.sector.name : d.pgsInSector.map(pg => pg?.name || '').join(' ');
          const normTarget = normalizeString(targetText);
          return searchTerms.every(term => normTarget.includes(term)) && d.total > 0;
      });

      let totalStaff = 0;
      let enrolledStaff = 0;
      sectorData.forEach(d => {
          totalStaff += d.total;
          enrolledStaff += d.enrolled;
      });

      return { 
          globalPercentage: totalStaff > 0 ? (enrolledStaff / totalStaff) * 100 : 0, 
          totalStaff, 
          enrolledStaff, 
          displaySectors: filteredData.sort((a, b) => a.percentage - b.percentage) 
      };
    }

    // 1. Filtrar setores e staff da unidade
    const isCurrentMonth = selectedMonth === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    // Pegamos TODOS os colaboradores da unidade para o cálculo global
    const unitStaff = proStaff.filter(s => s.unit === unit && (isCurrentMonth ? s.active !== false : true));
    const unitSectors = proSectors.filter(s => s.unit === unit && (isCurrentMonth ? s.active !== false : true));

    // Mapeamento de staff por setor para eficiência e para identificar "Sem Setor"
    const staffBySector = new Map<string, any[]>();
    const unassignedStaff: any[] = [];

    unitStaff.forEach(s => {
      const leftDate = s.leftAt ? new Date(s.leftAt) : null;
      const wasActiveInMonth = !leftDate || leftDate >= targetDate;

      if (wasActiveInMonth) {
        const sId = cleanID(s.sectorId);
        if (sId && proSectors.some(sec => cleanID(sec.id) === sId)) {
          if (!staffBySector.has(sId)) staffBySector.set(sId, []);
          staffBySector.get(sId)?.push(s);
        } else {
          unassignedStaff.push(s);
        }
      }
    });

    const sectorData = unitSectors.map(sector => {
      const sectorIdClean = cleanID(sector.id);
      const staffInSector = staffBySector.get(sectorIdClean) || [];
      const countTotal = staffInSector.length;
      
      const staffEnrolled = staffInSector.filter(s => 
        proGroupMembers.some(m => 
          cleanID(m.staffId) === cleanID(s.id) && 
          (!m.cycleMonth || new Date(m.cycleMonth) <= targetDate) && 
          (!m.leftAt || m.leftAt >= targetDate.getTime())
        )
      ).length;

      // --- LÓGICA DE DETECÇÃO DE PGS ATIVOS NO SETOR ---
      const geoGroupIds = new Set(
        proGroupLocations
          .filter(loc => cleanID(loc.sectorId) === sectorIdClean)
          .map(loc => cleanID(loc.groupId))
      );

      const memberGroupIds = new Set(
        proGroupMembers
          .filter(m => 
            staffInSector.some(s => cleanID(s.id) === cleanID(m.staffId)) &&
            (!m.leftAt || m.leftAt >= targetDate.getTime())
          )
          .map(m => cleanID(m.groupId))
      );

      const allGroupIdsInSector = new Set([...Array.from(geoGroupIds), ...Array.from(memberGroupIds)]);
      const pgsInSector = Array.from(allGroupIdsInSector)
        .map(gid => proGroups.find(g => cleanID(g.id) === gid))
        .filter(g => !!g);

      return {
        sector,
        pgsInSector,
        total: countTotal,
        enrolled: staffEnrolled,
        pgCount: pgsInSector.length,
        percentage: countTotal > 0 ? (staffEnrolled / countTotal) * 100 : 0
      };
    });

    // Adicionar "Sem Setor" se houver colaboradores órfãos
    if (unassignedStaff.length > 0) {
      const enrolledUnassigned = unassignedStaff.filter(s => 
        proGroupMembers.some(m => 
          cleanID(m.staffId) === cleanID(s.id) && 
          (!m.cycleMonth || new Date(m.cycleMonth) <= targetDate) && 
          (!m.leftAt || m.leftAt >= targetDate.getTime())
        )
      ).length;

      sectorData.push({
        sector: { id: 'unassigned', name: 'SEM SETOR DEFINIDO', unit } as any,
        pgsInSector: [],
        total: unassignedStaff.length,
        enrolled: enrolledUnassigned,
        pgCount: 0,
        percentage: (enrolledUnassigned / unassignedStaff.length) * 100
      });
    }

    // Filtro de Busca Inteligente
    const normSearch = normalizeString(searchTerm);
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

    return { 
        globalPercentage, 
        totalStaff, 
        enrolledStaff, 
        displaySectors: filteredData.sort((a, b) => a.percentage - b.percentage) 
    };
  }, [proSectors, proStaff, proGroupMembers, proGroupLocations, proGroups, proMonthlyStats, unit, searchTerm, filterType, selectedMonth]);

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

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      
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
        
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Cobertura de Discipulado ({unit})</h2>
            {metrics.displaySectors[0]?.isSnapshot && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-amber-200">
                <i className="fas fa-lock mr-1"></i> Mês Fechado
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Colaboradores matriculados em Pequenos Grupos</p>
        </div>

        <div className="flex items-center gap-8 z-10">
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
                <h3 className="font-black text-slate-800 uppercase tracking-tight">{data.sector.name}</h3>
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
    </div>
  );
};

export default PGDashboard;
