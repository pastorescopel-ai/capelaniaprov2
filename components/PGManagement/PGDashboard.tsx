
import React, { useMemo, useState } from 'react';
import { Unit } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { normalizeString } from '../../utils/formatters';

interface PGDashboardProps {
  unit: Unit;
}

const PGDashboard: React.FC<PGDashboardProps> = ({ unit }) => {
  const { proSectors, proStaff, proGroupMembers, proGroupLocations, proGroups } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'sector' | 'pg'>('sector');

  // Helper para normalização de IDs
  const cleanId = (id: any) => String(id || '').trim();

  const metrics = useMemo(() => {
    // 1. Filtrar setores e staff da unidade
    const unitSectors = proSectors.filter(s => s.unit === unit);
    const unitStaff = proStaff.filter(s => s.unit === unit);

    const sectorData = unitSectors.map(sector => {
      const sectorIdClean = cleanId(sector.id);
      
      // Staff neste setor
      const staffInSector = unitStaff.filter(s => cleanId(s.sectorId) === sectorIdClean);
      const countTotal = staffInSector.length;
      
      // Staff neste setor que está em ALGUM PG
      const staffEnrolled = staffInSector.filter(s => 
        proGroupMembers.some(m => cleanId(m.staffId) === cleanId(s.id))
      ).length;

      // --- LÓGICA DE DETECÇÃO DE PGS ATIVOS NO SETOR ---
      
      // 1. PGs via Maestro (Geográficos)
      const geoGroupIds = new Set(
        proGroupLocations
          .filter(loc => cleanId(loc.sectorId) === sectorIdClean)
          .map(loc => cleanId(loc.groupId))
      );

      // 2. PGs via Membros (Dinâmicos)
      // Se um colaborador deste setor está no PG "X", o PG "X" atua aqui.
      const memberGroupIds = new Set(
        proGroupMembers
          .filter(m => staffInSector.some(s => cleanId(s.id) === cleanId(m.staffId)))
          .map(m => cleanId(m.groupId))
      );

      // União dos IDs para evitar duplicidade
      const allGroupIdsInSector = new Set([...Array.from(geoGroupIds), ...Array.from(memberGroupIds)]);
      const pgsInSector = Array.from(allGroupIdsInSector)
        .map(gid => proGroups.find(g => cleanId(g.id) === gid))
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
  }, [proSectors, proStaff, proGroupMembers, proGroupLocations, proGroups, unit, searchTerm, filterType]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* KPI Global */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-[#005a9c]"></div>
        
        <div className="space-y-2 z-10">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Cobertura de Discipulado ({unit})</h2>
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
