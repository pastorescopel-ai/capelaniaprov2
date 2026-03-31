
import React, { useMemo, useState, memo, useEffect } from 'react';
import { Unit, ProHistoryRecord } from '../../types';
import { usePro } from '../../contexts/ProContext';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../contexts/AuthProvider';
import { normalizeString, cleanID } from '../../utils/formatters';
import CloseMonthModal from './CloseMonthModal';
import ReopenMonthModal from './ReopenMonthModal';
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
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusModalConfig, setStatusModalConfig] = useState<{ title: string, message: string, type: 'success' | 'error' | 'warning' }>({ title: '', message: '', type: 'success' });
  const [isClosing, setIsClosing] = useState(false);
  const [technicalError, setTechnicalError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';
  
  // Estado para o mês de competência selecionado
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return config.activeCompetenceMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  });

  // Sincronizar selectedMonth com config.activeCompetenceMonth se mudar externamente
  useEffect(() => {
    if (config.activeCompetenceMonth) {
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
    const targetDate = new Date(selectedMonth);
    const isClosed = config.activeCompetenceMonth ? selectedMonth < config.activeCompetenceMonth : false;
    const nextMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);

    // 0. Verificar se existem registros de histórico para o mês selecionado
    const historyForMonth = proHistoryRecords.filter(r => r.month === selectedMonth && r.unit === unit);
    
    if (historyForMonth.length > 0) {
      console.log(`[DEBUG] PGDashboard - Usando HISTÓRICO COMPLETO (${historyForMonth.length} registros).`);
      const enrolledCount = historyForMonth.filter(r => r.isEnrolled).length;
      const totalStaff = historyForMonth.length;
      const activePGIds = new Set(historyForMonth.filter(r => r.isEnrolled && r.groupId).map(r => r.groupId));
      
      // Mapear setores para exibição baseada no histórico
      const sectorsById = new Map(proSectors.map(s => [cleanID(s.id), s]));
      const groupsById = new Map(proGroups.map(g => [cleanID(g.id), g]));
      
      const staffBySector = new Map<string, ProHistoryRecord[]>();
      historyForMonth.forEach(r => {
        const sId = cleanID(r.sectorId) || 'unassigned';
        if (!staffBySector.has(sId)) staffBySector.set(sId, []);
        staffBySector.get(sId)?.push(r);
      });

      const sectorData = Array.from(staffBySector.entries()).map(([sId, staff]) => {
        const sector = sId === 'unassigned' ? { id: 'unassigned', name: 'SEM SETOR DEFINIDO', unit } as any : sectorsById.get(sId);
        const enrolledInSector = staff.filter(r => r.isEnrolled).length;
        const pgsInSectorIds = new Set(staff.filter(r => r.isEnrolled && r.groupId).map(r => r.groupId));
        const pgsInSector = Array.from(pgsInSectorIds).map(gid => groupsById.get(gid)).filter(g => !!g);

        return {
          sector: sector || { id: sId, name: 'Setor Excluído', unit } as any,
          pgsInSector,
          total: staff.length,
          enrolled: enrolledInSector,
          pgCount: pgsInSector.length,
          percentage: staff.length > 0 ? (enrolledInSector / staff.length) * 100 : 0,
          isSnapshot: true
        };
      });

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
        globalPercentage: totalStaff > 0 ? (enrolledCount / totalStaff) * 100 : 0,
        totalStaff,
        enrolledStaff: enrolledCount,
        activePGCount: activePGIds.size,
        displaySectors: filteredData.sort((a, b) => a.percentage - b.percentage)
      };
    }

    // 0. Verificar se existem snapshots para o mês selecionado (Legado ou Agregado)
    const snapshots = proMonthlyStats.filter(s => s.month === selectedMonth && s.unit === unit);
    
    if (snapshots.length > 0) {
      const sectorSnaps = snapshots.filter(s => s.type === 'sector');
      const globalSnap = snapshots.find(s => s.type === 'pg' && s.targetId === 'all');

      // Otimização: Mapas para buscas rápidas
      const sectorsById = new Map(proSectors.map(s => [cleanID(s.id), s]));
      const groupsById = new Map(proGroups.map(g => [cleanID(g.id), g]));
      
      const locsBySector = new Map<string, Set<string>>();
      proGroupLocations.forEach(loc => {
        const sId = cleanID(loc.sectorId);
        if (!locsBySector.has(sId)) locsBySector.set(sId, new Set());
        locsBySector.get(sId)?.add(cleanID(loc.groupId));
      });

      const sectorData = sectorSnaps.map(snap => {
        const sector = sectorsById.get(cleanID(snap.targetId));
        const sectorName = snap.targetId === 'unassigned' ? 'SEM SETOR DEFINIDO' : (sector?.name || 'Setor Excluído');
        
        const pgsInSector = Array.from(locsBySector.get(cleanID(snap.targetId)) || [])
          .map(gid => groupsById.get(gid))
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
      const normSearch = normalizeString(debouncedSearchTerm);
      const searchTerms = normSearch.split(' ').filter(t => t);

      const filteredData = sectorData.filter(d => {
          if (searchTerms.length === 0) return d.total > 0;
          const targetText = filterType === 'sector' ? d.sector.name : d.pgsInSector.map(pg => pg?.name || '').join(' ');
          const normTarget = normalizeString(targetText);
          return searchTerms.every(term => normTarget.includes(term)) && d.total > 0;
      });

      return { 
          globalPercentage: globalSnap?.percentage || 0, 
          totalStaff: globalSnap?.totalStaff || 0, 
          enrolledStaff: globalSnap?.totalParticipants || 0, 
          activePGCount: globalSnap?.activeGroups || 0,
          displaySectors: filteredData.sort((a, b) => a.percentage - b.percentage) 
      };
    }

    console.log("[DEBUG] PGDashboard - Usando dados OPERACIONAIS (Tempo Real).");
    if (isClosed) {
      return {
        globalPercentage: 0,
        totalStaff: 0,
        enrolledStaff: 0,
        activePGCount: 0,
        displaySectors: []
      };
    }

    // 1. Filtrar setores e staff da unidade
    const isCurrentMonth = selectedMonth === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    // Pegamos TODOS os colaboradores da unidade para o cálculo global
    const unitStaff = proStaff.filter(s => s.unit === unit && (isCurrentMonth ? s.active !== false : true));
    const unitSectors = proSectors.filter(s => s.unit === unit && (isCurrentMonth ? s.active !== false : true));

    // Otimização: Dicionários para buscas O(1)
    const validSectorIds = new Set(unitSectors.map(s => cleanID(s.id)));
    const groupsById = new Map(proGroups.map(g => [cleanID(g.id), g]));
    
    const enrolledStaffIds = new Set<string>();
    const memberGroupIdsBySector = new Map<string, Set<string>>();
    const activePGIds = new Set<string>();

    proGroupMembers.forEach(m => {
      if ((!m.cycleMonth || new Date(m.cycleMonth) <= targetDate) && 
          (!m.leftAt || m.leftAt >= targetDate.getTime())) {
        enrolledStaffIds.add(cleanID(m.staffId));
        
        const group = groupsById.get(cleanID(m.groupId));
        if (group && group.unit === unit) {
          activePGIds.add(cleanID(m.groupId));
        }
      }
    });

    // Também contar PGs que tem apenas prestadores
    (proGroupProviderMembers || []).forEach(m => {
      if ((!m.cycleMonth || new Date(m.cycleMonth) <= targetDate) && 
          (!m.leftAt || m.leftAt >= targetDate.getTime())) {
        const group = groupsById.get(cleanID(m.groupId));
        if (group && group.unit === unit) {
          activePGIds.add(cleanID(m.groupId));
        }
      }
    });

    // Mapeamento de staff por setor para eficiência e para identificar "Sem Setor"
    const staffBySector = new Map<string, any[]>();
    const unassignedStaff: any[] = [];
    const sectorIdByStaffId = new Map<string, string>();

    unitStaff.forEach(s => {
      const leftDate = s.leftAt ? new Date(s.leftAt) : null;
      const wasActiveInMonth = !leftDate || leftDate >= targetDate;

      if (wasActiveInMonth) {
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
        percentage: countTotal > 0 ? (staffEnrolled / countTotal) * 100 : 0
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
        percentage: (enrolledUnassigned / unassignedStaff.length) * 100
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

    return { 
        globalPercentage, 
        totalStaff, 
        enrolledStaff, 
        activePGCount: activePGIds.size,
        displaySectors: filteredData.sort((a, b) => a.percentage - b.percentage) 
    };
  }, [proSectors, proStaff, proGroupMembers, proGroupProviderMembers, proGroupLocations, proGroups, proMonthlyStats, proHistoryRecords, unit, debouncedSearchTerm, filterType, selectedMonth, config.activeCompetenceMonth]);

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

  const handleCloseMonth = async () => {
    if (isClosing) return;
    setIsClosing(true);
    setTechnicalError(null);
    
    try {
      console.log(`[FECHAMENTO] Iniciando fechamento para ${selectedMonth} na unidade ${unit}`);
      
      const targetDate = new Date(selectedMonth + 'T12:00:00').getTime();
      const unitStaff = proStaff.filter(s => s.unit === unit && (!s.leftAt || s.leftAt >= targetDate));
      
      if (unitStaff.length === 0) {
        showStatus('Aviso', 'Nenhum colaborador ativo encontrado para este mês nesta unidade.', 'warning');
        setIsClosing(false);
        return;
      }

      const sectorsById = new Map(proSectors.map(s => [cleanID(s.id), s]));
      const groupsById = new Map(proGroups.map(g => [cleanID(g.id), g]));
      
      // Mapear membros atuais (Colaboradores)
      const staffToGroup = new Map<string, string>();
      proGroupMembers.forEach(m => {
        if (!m.leftAt || m.leftAt >= targetDate) {
          staffToGroup.set(cleanID(m.staffId), cleanID(m.groupId));
        }
      });

      const sectorStats = new Map<string, { total: number, enrolled: number, pgIds: Set<string> }>();
      const historyRecords: any[] = [];

      unitStaff.forEach(staff => {
        const groupId = staffToGroup.get(cleanID(staff.id));
        const group = groupId ? groupsById.get(groupId) : null;
        const sector = sectorsById.get(cleanID(staff.sectorId));
        const sId = cleanID(staff.sectorId) || 'unassigned';

        if (!sectorStats.has(sId)) {
          sectorStats.set(sId, { total: 0, enrolled: 0, pgIds: new Set() });
        }
        const stats = sectorStats.get(sId)!;
        stats.total++;
        if (groupId) {
          stats.enrolled++;
          stats.pgIds.add(groupId);
        }

        historyRecords.push({
          month: selectedMonth,
          unit,
          staffId: staff.id,
          staffName: staff.name,
          registrationId: staff.registrationId || null,
          sectorId: staff.sectorId || 'unassigned',
          sectorName: sector?.name || 'Sem Setor',
          groupId: groupId || null,
          groupName: group?.name || '',
          status: groupId ? 'Matriculado' : 'Não Matriculado',
          isEnrolled: !!groupId,
          createdAt: Date.now()
        });
      });

      // 1. Limpar histórico existente para este mês/unidade para evitar duplicidade
      await deleteRecordsByFilter('proHistoryRecords', { month: selectedMonth, unit });
      await deleteRecordsByFilter('proMonthlyStats', { month: selectedMonth, unit });

      // 2. Salvar Histórico Detalhado
      const saveHistoryResult = await saveRecord('proHistoryRecords', historyRecords);
      if (!saveHistoryResult.success) {
        throw new Error('Falha ao salvar registros de histórico.');
      }

      // 3. Salvar Estatísticas Mensais Agregadas
      const monthlyStats: any[] = [];
      let totalUnitStaff = 0;
      let totalUnitEnrolled = 0;
      const allUnitPGIds = new Set<string>();

      sectorStats.forEach((stats, sId) => {
        totalUnitStaff += stats.total;
        totalUnitEnrolled += stats.enrolled;
        stats.pgIds.forEach(id => allUnitPGIds.add(id));

        monthlyStats.push({
          month: selectedMonth,
          unit,
          type: 'sector',
          targetId: sId,
          totalStaff: stats.total,
          totalParticipants: stats.enrolled,
          percentage: stats.total > 0 ? (stats.enrolled / stats.total) * 100 : 0,
          goal: 100,
          createdAt: Date.now()
        });
      });

      // Registro Global da Unidade
      monthlyStats.push({
        month: selectedMonth,
        unit,
        type: 'pg',
        targetId: 'all',
        totalStaff: totalUnitStaff,
        totalParticipants: totalUnitEnrolled,
        percentage: totalUnitStaff > 0 ? (totalUnitEnrolled / totalUnitStaff) * 100 : 0,
        activeGroups: allUnitPGIds.size,
        goal: 100,
        createdAt: Date.now()
      });

      const saveStatsResult = await saveRecord('proMonthlyStats', monthlyStats);
      if (!saveStatsResult.success) {
        throw new Error('Falha ao salvar estatísticas mensais.');
      }

      // 4. Avançar o mês de competência
      const currentMonthDate = new Date(selectedMonth + 'T12:00:00');
      currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
      const nextMonthStr = currentMonthDate.toISOString().split('T')[0];

      const saveConfigResult = await saveRecord('config', {
        ...config,
        activeCompetenceMonth: nextMonthStr
      });

      if (!saveConfigResult.success) {
        throw new Error('Falha ao atualizar mês de competência.');
      }

      // 5. Recarregar dados para garantir sincronização
      await refreshData();

      showStatus('Sucesso', `Mês de ${new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(selectedMonth + 'T12:00:00'))} fechado com sucesso!`, 'success');
      setIsCloseModalOpen(false);
    } catch (error: any) {
      console.error("Erro ao fechar mês:", error);
      setTechnicalError(error.message);
      showStatus('Erro', 'Ocorreu um erro ao fechar o mês. Verifique o console para detalhes.', 'error');
    } finally {
      setIsClosing(false);
    }
  };

  const handleReopenMonth = async () => {
    const current = new Date(selectedMonth + 'T12:00:00');
    const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const nextMonthStr = next.toISOString().split('T')[0];

    // Verificar se o mês seguinte já tem histórico (está fechado)
    const nextMonthClosed = proHistoryRecords.some(r => r.month === nextMonthStr && r.unit === unit);
    if (nextMonthClosed) {
      showStatus('Aviso', 'Não é possível reabrir este mês porque o mês seguinte já foi fechado.', 'warning');
      return;
    }

    setIsReopenModalOpen(true);
  };

  const confirmReopenMonth = async () => {
    const current = new Date(selectedMonth + 'T12:00:00');
    setIsClosing(true);
    try {
      // Apagar histórico e estatísticas do mês
      await deleteRecordsByFilter('proHistoryRecords', { month: selectedMonth, unit });
      await deleteRecordsByFilter('proMonthlyStats', { month: selectedMonth, unit });

      // Voltar o mês de competência no config
      await saveRecord('config', {
        ...config,
        activeCompetenceMonth: selectedMonth
      });

      setIsReopenModalOpen(false);
      showStatus('Sucesso', 'Mês reaberto com sucesso. O histórico foi removido e a competência atualizada.', 'success');
    } catch (error) {
      console.error('Erro ao reabrir mês:', error);
      showStatus('Erro', 'Erro ao reabrir o mês.', 'error');
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <CloseMonthModal 
        isOpen={isCloseModalOpen}
        isClosing={isClosing}
        selectedMonth={selectedMonth}
        onCancel={() => setIsCloseModalOpen(false)}
        onConfirm={handleCloseMonth}
      />

      <ReopenMonthModal 
        isOpen={isReopenModalOpen}
        isClosing={isClosing}
        selectedMonth={selectedMonth}
        onCancel={() => setIsReopenModalOpen(false)}
        onConfirm={confirmReopenMonth}
      />

      <StatusModal 
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={statusModalConfig.title}
        message={statusModalConfig.message}
        type={statusModalConfig.type}
      />
      
      {/* Status Técnico (Log de Erros) */}
      {technicalError && (
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <i className="fas fa-bug text-xs"></i>
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-800">Status Técnico (Depuração)</h4>
            <button 
              onClick={() => setTechnicalError(null)}
              className="ml-auto text-rose-400 hover:text-rose-600 transition-colors"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>
          <div className="bg-white/50 p-3 rounded-xl border border-rose-100/50">
            <code className="text-[10px] font-mono text-rose-600 break-all">
              {technicalError}
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
          {isAdmin && (
            <div className="flex items-center gap-2">
              {metrics.displaySectors[0]?.isSnapshot ? (
                <button 
                  onClick={handleReopenMonth}
                  disabled={isClosing}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-2"
                >
                  <i className="fas fa-unlock"></i>
                  Reabrir Mês
                </button>
              ) : (
                <button 
                  onClick={() => setIsCloseModalOpen(true)}
                  disabled={isClosing}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-100 transition-all flex items-center gap-2"
                >
                  <i className="fas fa-lock"></i>
                  Fechar Mês
                </button>
              )}
            </div>
          )}
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
});

PGDashboard.displayName = 'PGDashboard';

export default PGDashboard;
