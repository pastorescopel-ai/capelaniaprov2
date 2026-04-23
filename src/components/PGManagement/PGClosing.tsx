
import React, { useState, useEffect, useMemo } from 'react';
import { Unit, ProMonthlyStats } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useApp } from '../../hooks/useApp';
import { usePro } from '../../contexts/ProContext';
import { useBible } from '../../contexts/BibleContext';
import { getTimestamp, cleanID } from '../../utils/formatters';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';
import GlobalCloseMonthModal from '../Admin/GlobalCloseMonthModal';
import GlobalReopenMonthModal from '../Admin/GlobalReopenMonthModal';
import ForceSyncModal from '../Admin/ForceSyncModal';

interface PGClosingProps {
  unit: Unit;
}

const PGClosing: React.FC<PGClosingProps> = ({ unit }) => {
  const { 
    users, bibleStudies, bibleClasses, smallGroups, staffVisits, ambassadors,
    saveRecord, deleteRecordsByFilter, loadFromCloud, config
  } = useApp();
  
  const { 
    proStaff, proSectors, proGroups, proGroupMembers, proGroupProviderMembers, 
    proMonthlyStats, proProviders 
  } = usePro();

  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCloseConfirmModalOpen, setIsCloseConfirmModalOpen] = useState(false);
  const [isReopenConfirmModalOpen, setIsReopenConfirmModalOpen] = useState(false);
  const [isForceSyncModalOpen, setIsForceSyncModalOpen] = useState(false);
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ 
    isOpen: false, status: 'idle', title: '', message: '' 
  });
  
  const [selectedCloseMonth, setSelectedCloseMonth] = useState(() => {
    if (config.activeCompetenceMonth) return config.activeCompetenceMonth;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
  });

  useEffect(() => {
    if (!proMonthlyStats || proMonthlyStats.length === 0) return;

    // Se a competência ativa no banco estiver definida, respeitamos ela como base para sugestão
    const activeCompRaw = config.activeCompetenceMonth || new Date().toLocaleDateString('en-CA');
    const activeComp = activeCompRaw.substring(0, 7) + '-01';
    
    // Verifica se já fechamos o mês anterior à competência ativa
    const prevMonthDate = new Date(activeComp + 'T12:00:00');
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonthISO = prevMonthDate.toLocaleDateString('en-CA');

    const isPrevClosed = proMonthlyStats.some(s => s.month === prevMonthISO && s.targetId === 'all');
    
    // Sugerimos o mês de competência se o anterior estiver fechado, senão sugerimos o anterior
    const suggestedMonth = isPrevClosed ? activeComp : prevMonthISO;
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCloseMonth(prev => prev !== suggestedMonth ? suggestedMonth : prev);
  }, [proMonthlyStats, config.activeCompetenceMonth]);

  const formatMonthLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleCloseMonth = async () => {
    setIsCloseConfirmModalOpen(true);
  };

  const confirmCloseMonth = async () => {
    setIsCloseConfirmModalOpen(false);
    const isAlreadyClosed = proMonthlyStats?.some(s => s.month === selectedCloseMonth);
    const actionText = isAlreadyClosed ? 'ATUALIZAR' : 'FECHAR';
    
    setSyncState({ 
      isOpen: true, 
      status: 'processing', 
      title: `${actionText === 'FECHAR' ? 'Fechamento' : 'Atualização'} de PGs`, 
      message: 'Processando indicadores de Pequenos Grupos. Aguarde...' 
    });

    try {
        // 1. LIMPAR REGISTROS ANTIGOS (Se for atualização)
        if (isAlreadyClosed) {
            await deleteRecordsByFilter('proMonthlyStats', { month: selectedCloseMonth });
            await deleteRecordsByFilter('proHistoryRecords', { month: selectedCloseMonth });
        }

        const snapshots: ProMonthlyStats[] = [];
        const historyRecords: any[] = [];
        const units = [Unit.HAB, Unit.HABA];
        const targetDate = new Date(selectedCloseMonth + 'T12:00:00');

        for (const u of units) {
            const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59).getTime();

            const unitStaff = proStaff.filter(s => {
                if (s.unit !== u) return false;
                
                // 1. Verificar se já existia no mês (Criado antes do fim do mês)
                const createdDate = getTimestamp(s.createdAt);
                if (createdDate && createdDate > monthEnd) return false;
                
                // Fallback: Se não tem createdAt, usamos o cycleMonth como pista
                if (!createdDate && s.cycleMonth) {
                    const cycleDate = new Date(s.cycleMonth + 'T12:00:00').getTime();
                    if (cycleDate > monthEnd) return false;
                }

                // 2. Verificar se ainda estava na unidade no mês (Saiu depois do início do mês ou ainda não saiu)
                const leftDate = getTimestamp(s.leftAt);
                if (leftDate && leftDate < targetDate.getTime()) return false;

                // Se passou pelos filtros acima, ele era um colaborador válido no período, 
                // independente de estar ativo HOJE ou não.
                return true;
            });

            const staffBySector = new Map<string, any[]>();
            const unassignedStaff: any[] = [];

            unitStaff.forEach(s => {
                const sId = String(s.sectorId || '').trim();
                if (sId && proSectors.some(sec => String(sec.id) === sId)) {
                    if (!staffBySector.has(sId)) staffBySector.set(sId, []);
                    staffBySector.get(sId)?.push(s);
                } else {
                    unassignedStaff.push(s);
                }
            });

            // 1. Snapshots de Setores
            proSectors.filter(s => s.unit === u && s.active !== false).forEach(sector => {
                const sectorId = String(sector.id);
                const staffInSector = staffBySector.get(sectorId) || [];
                const ambassadorsInSector = ambassadors.filter(a => a.sectorId === sectorId && a.unit === u && a.cycleMonth === selectedCloseMonth);
                
                const totalStaff = staffInSector.length;
                const totalParticipants = ambassadorsInSector.length;
                const percentage = totalStaff > 0 ? (totalParticipants / totalStaff) * 100 : 0;

                snapshots.push({
                    month: selectedCloseMonth,
                    type: 'sector',
                    targetId: sectorId,
                    totalStaff,
                    totalParticipants,
                    percentage,
                    goal: 5,
                    unit: u
                });
            });

            // 1.1 Snapshot de "Sem Setor"
            if (unassignedStaff.length > 0) {
                const enrolledUnassigned = unassignedStaff.filter(s => 
                    proGroupMembers.some(m => 
                        String(m.staffId) === String(s.id) && 
                        (!m.cycleMonth || new Date(m.cycleMonth) <= targetDate) && 
                        (!m.leftAt || m.leftAt >= targetDate.getTime())
                    )
                ).length;

                snapshots.push({
                    month: selectedCloseMonth,
                    type: 'sector',
                    targetId: 'unassigned',
                    totalStaff: unassignedStaff.length,
                    totalParticipants: enrolledUnassigned,
                    percentage: (enrolledUnassigned / unassignedStaff.length) * 100,
                    goal: 0,
                    unit: u
                });
            }

            // 2. Snapshots de PGs
            proGroups.filter(g => g.unit === u && g.active !== false).forEach(group => {
                const groupId = String(group.id);
                const members = proGroupMembers.filter(m => 
                    String(m.groupId) === groupId && 
                    (!m.cycleMonth || new Date(m.cycleMonth) <= targetDate) && 
                    (!m.leftAt || getTimestamp(m.leftAt) >= targetDate.getTime())
                );
                const sectorId = String(group.sectorId || '');
                const staffInSector = sectorId ? (staffBySector.get(sectorId) || []) : [];
                
                const totalS = staffInSector.length;
                const totalP = members.length;
                const percentage = totalS > 0 ? (totalP / totalS) * 100 : 0;

                snapshots.push({
                    month: selectedCloseMonth,
                    type: 'pg',
                    targetId: groupId,
                    totalStaff: totalS,
                    totalParticipants: totalP,
                    percentage,
                    goal: 80,
                    unit: u
                });
            });

            // 3. GERAR HISTÓRICO INDIVIDUAL COMPLETO
            // Otimização: Criar um mapa de matrículas ativas para a unidade atual no mês alvo
            const activeMembershipsInUnit = proGroupMembers.filter(m => {
                const group = proGroups.find(g => g.id === m.groupId);
                if (!group || group.unit !== u) return false;
                
                const mCycleDate = m.cycleMonth ? new Date(m.cycleMonth + 'T12:00:00').getTime() : 0;
                const mLeftDate = getTimestamp(m.leftAt);
                
                return (!m.cycleMonth || mCycleDate <= targetDate.getTime()) && 
                       (!mLeftDate || mLeftDate >= targetDate.getTime());
            });

            const membershipMap = new Map(activeMembershipsInUnit.map(m => [cleanID(m.staffId), m]));

            // 3.1 PROCESSAR COLABORADORES (CLT)
            unitStaff.forEach(staff => {
                const staffIdClean = cleanID(staff.id);
                const membership = membershipMap.get(staffIdClean);
                
                const sector = proSectors.find(s => cleanID(s.id) === cleanID(staff.sectorId));
                const group = membership ? proGroups.find(g => cleanID(g.id) === cleanID(membership.groupId)) : null;

                historyRecords.push({
                    month: selectedCloseMonth,
                    unit: u,
                    staffId: staff.id,
                    staffName: staff.name,
                    sectorId: staff.sectorId || null,
                    sectorName: sector?.name || 'Sem Setor',
                    groupId: membership?.groupId || null,
                    groupName: group?.name || '',
                    leaderName: group?.currentLeader || null,
                    role: 'CLT',
                    isEnrolled: !!membership,
                    joinedAt: getTimestamp(membership?.joinedAt),
                    leftAt: getTimestamp(membership?.leftAt),
                    createdAt: Date.now()
                });
            });

            // 3.5 SNAPSHOT DE SUMÁRIO GLOBAL (Para Relatórios)
            const targetMonth = selectedCloseMonth.substring(0, 7);
            const monthStudies = bibleStudies.filter(s => s.unit === u && s.date?.startsWith(targetMonth));
            const monthClasses = bibleClasses.filter(c => c.unit === u && c.date?.startsWith(targetMonth));
            const monthGroups = smallGroups.filter(g => g.unit === u && g.date?.startsWith(targetMonth));
            const monthVisits = staffVisits.filter(v => v.unit === u && v.date?.startsWith(targetMonth));

            const uniqueStudents = new Set();
            monthClasses.forEach(c => {
                if (Array.isArray(c.students)) {
                    c.students.forEach((s: string) => uniqueStudents.add(s));
                }
            });

            const unitChaplainStats = users.map(user => {
                const uS = monthStudies.filter(s => s.userId === user.id);
                const uC = monthClasses.filter(c => c.userId === user.id);
                const uG = monthGroups.filter(g => g.userId === user.id);
                const uV = monthVisits.filter(v => v.userId === user.id);
                
                const names = new Set<string>();
                uS.forEach(s => s.name && names.add(s.name.toLowerCase().trim()));
                uC.forEach(c => c.students?.forEach((n: string) => n && names.add(n.toLowerCase().trim())));

                return {
                    userId: user.id,
                    userName: user.name,
                    studies: uS.length,
                    classes: uC.length,
                    groups: uG.length,
                    visits: uV.length,
                    students: names.size,
                    total: uS.length + uC.length + uG.length + uV.length
                };
            }).filter(s => s.total > 0 || s.students > 0);

            const unitHistory = historyRecords.filter(r => r.unit === u);
            const enrolledStaffCount = unitHistory.filter(r => r.isEnrolled).length;
            const totalStaffCount = unitHistory.length;
            const pgPercentage = totalStaffCount > 0 ? (enrolledStaffCount / totalStaffCount) * 100 : 0;
            const activeGroupsCount = new Set(unitHistory.filter(r => r.isEnrolled).map(r => r.groupId)).size;

            snapshots.push({
                month: selectedCloseMonth,
                unit: u,
                type: 'pg',
                targetId: 'all',
                totalStaff: totalStaffCount,
                totalParticipants: enrolledStaffCount,
                activeGroups: activeGroupsCount,
                percentage: pgPercentage,
                goal: 80,
                snapshotData: {
                    totalColaboradores: totalStaffCount,
                    performanceMetrics: {
                        pgPercentage,
                        totalBibleStudies: monthStudies.length,
                        totalBibleClasses: monthClasses.length,
                        totalSmallGroups: monthGroups.length,
                        totalStaffVisits: monthVisits.length,
                        totalUniqueStudents: uniqueStudents.size,
                        chaplainStats: unitChaplainStats
                    }
                }
            } as any);
        }

        // 4. SALVAR TUDO
        if (historyRecords.length > 0) {
            await saveRecord('proHistoryRecords', historyRecords);
        }
        await saveRecord('proMonthlyStats', snapshots);

        // 5. ATUALIZAR COMPETÊNCIA GLOBAL (Barreira de Segurança)
        // Se fechou o mês atual ou anterior, movemos a competência para o próximo mês
        const nextMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
        const nextMonthISO = nextMonth.toLocaleDateString('en-CA');
        
        if (config.id) {
            await saveRecord('config', { 
                ...config, 
                activeCompetenceMonth: nextMonthISO 
            });
        }

        setSyncState({ 
          isOpen: true, 
          status: 'success', 
          title: 'Mês Encerrado', 
          message: `Sucesso! O fechamento de ${formatMonthLabel(selectedCloseMonth)} foi concluído e a competência ativa avançou para ${formatMonthLabel(nextMonthISO)}.` 
        });
        await loadFromCloud(true);
    } catch (e: any) {
        setSyncState({ 
          isOpen: true, 
          status: 'error', 
          title: 'Erro no Fechamento', 
          message: "Falha ao gravar indicadores de fechamento.", 
          error: e.message 
        });
    }
  };

  const handleReopenMonth = async () => {
    setIsReopenConfirmModalOpen(true);
  };

  const confirmReopenMonth = async () => {
    setIsReopenConfirmModalOpen(false);
    setSyncState({ isOpen: true, status: 'processing', title: 'Reabrindo Mês', message: 'Removendo registros do histórico...' });

    try {
        await deleteRecordsByFilter('proMonthlyStats', { month: selectedCloseMonth });
        await deleteRecordsByFilter('proHistoryRecords', { month: selectedCloseMonth });

        // Retornar competência para o mês reaberto
        if (config.id) {
            await saveRecord('config', { 
                ...config, 
                activeCompetenceMonth: selectedCloseMonth 
            });
        }

        setSyncState({ 
          isOpen: true, 
          status: 'success', 
          title: 'Mês Reaberto', 
          message: `O mês de ${formatMonthLabel(selectedCloseMonth)} foi reaberto e definido como competência ativa.` 
        });
        await loadFromCloud(true);
    } catch (e: any) {
        setSyncState({ 
          isOpen: true, 
          status: 'error', 
          title: 'Erro ao Reabrir', 
          message: "Falha ao remover registros do histórico.", 
          error: e.message 
        });
    }
  };

  const handleForceSync = async () => {
    setIsForceSyncModalOpen(false);
    setSyncState({ isOpen: true, status: 'processing', title: 'Sincronizando Matrículas', message: 'Garantindo que todas as matrículas ativas estejam vinculadas ao mês selecionado...' });
    
    try {
      let success = true;
      
      if (proGroupMembers.length > 0) {
        const toSyncCLT = proGroupMembers.filter(m => !m.leftAt).map(m => ({
            ...m,
            cycleMonth: selectedCloseMonth,
            joinedAt: m.joinedAt || new Date(selectedCloseMonth + 'T12:00:00').getTime(),
            isError: false
        }));
        const resCLT = await saveRecord('proGroupMembers', toSyncCLT);
        if (!resCLT) success = false;
      }

      if (proGroupProviderMembers.length > 0) {
        const toSyncProv = proGroupProviderMembers.filter(m => !m.leftAt).map((m: any) => ({
            ...m,
            cycleMonth: selectedCloseMonth,
            joinedAt: m.joinedAt || new Date(selectedCloseMonth + 'T12:00:00').getTime(),
            isError: false
        }));
        const resProv = await saveRecord('proGroupProviderMembers', toSyncProv);
        if (!resProv) success = false;
      }

      if (success) {
        setSyncState({ 
            isOpen: true, 
            status: 'success', 
            title: 'Sincronização Concluída', 
            message: `Todas as matrículas ativas foram migradas para o ciclo de ${formatMonthLabel(selectedCloseMonth)}.` 
        });
        await loadFromCloud(true);
      } else {
        setSyncState({ 
            isOpen: true, 
            status: 'error', 
            title: 'Falha na Sincronização', 
            message: "Ocorreu um erro ao tentar sincronizar as matrículas." 
        });
      }
    } catch (err: any) {
        setSyncState({ 
            isOpen: true, 
            status: 'error', 
            title: 'Erro Crítico', 
            message: "Erro ao processar sincronização forçada.",
            error: err.message
        });
    }
  };

  const isMonthClosed = useMemo(() => {
    const activeMonthRaw = config.activeCompetenceMonth || new Date().toLocaleDateString('en-CA');
    const activeMonth = activeMonthRaw.substring(0, 7) + '-01';
    const hasClosingSnapshot = proMonthlyStats.some(s => s.month === selectedCloseMonth && (s.unit === unit || s.targetId === 'all'));
    return (selectedCloseMonth < activeMonth) || hasClosingSnapshot;
  }, [selectedCloseMonth, config.activeCompetenceMonth, proMonthlyStats, unit]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right duration-500">
      <SyncModal 
        isOpen={syncState.isOpen} 
        status={syncState.status} 
        title={syncState.title} 
        message={syncState.message} 
        errorDetails={syncState.error} 
        onClose={() => setSyncState(prev => ({ ...prev, isOpen: false }))} 
      />
      
      <GlobalCloseMonthModal 
        isOpen={isCloseConfirmModalOpen}
        onCancel={() => setIsCloseConfirmModalOpen(false)}
        onConfirm={confirmCloseMonth}
        selectedMonth={selectedCloseMonth}
        isProcessing={isProcessing}
        isAlreadyClosed={isMonthClosed}
      />
      
      <GlobalReopenMonthModal 
        isOpen={isReopenConfirmModalOpen}
        onCancel={() => setIsReopenConfirmModalOpen(false)}
        onConfirm={confirmReopenMonth}
        selectedMonth={selectedCloseMonth}
        isProcessing={isProcessing}
      />

      <ForceSyncModal 
        isOpen={isForceSyncModalOpen} 
        onClose={() => setIsForceSyncModalOpen(false)} 
        onConfirm={handleForceSync}
        cltCount={proGroupMembers.filter(m => !m.leftAt).length}
        providerCount={proGroupProviderMembers.filter(m => !m.leftAt).length}
      />

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${isMonthClosed ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'} rounded-2xl flex items-center justify-center text-xl transition-colors`}>
                <i className={`fas ${isMonthClosed ? 'fa-lock' : 'fa-archive'}`}></i>
              </div>
              <div>
                <h3 className="text-slate-800 font-black uppercase text-sm tracking-tight">
                  {isMonthClosed ? 'Mês Encerrado Oficialmente' : 'Fechamento de Mês Oficial'}
                </h3>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                  {isMonthClosed ? 'Os dados deste período estão congelados no histórico' : 'Grave os indicadores de todas as unidades como definitivos'}
                </p>
              </div>
            </div>
            {isMonthClosed && (
              <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded-full tracking-widest animate-pulse">
                Histórico Ativo
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
              <label className="text-[9px] font-black text-slate-400 uppercase px-2">Período:</label>
              <input 
                type="month" 
                value={selectedCloseMonth.substring(0, 7)} 
                onChange={(e) => setSelectedCloseMonth(e.target.value + '-01')}
                className="bg-transparent border-none rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-700 focus:ring-0"
              />
            </div>

            <button 
              onClick={handleCloseMonth} 
              className={`flex-1 md:flex-none px-10 py-4 ${isMonthClosed ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} text-white rounded-2xl font-black text-[10px] uppercase shadow-lg transition-all flex items-center justify-center gap-3 tracking-widest active:scale-95`}
            >
              <i className={`fas ${isMonthClosed ? 'fa-sync-alt' : 'fa-check-circle'}`}></i> 
              {isMonthClosed ? 'Atualizar Fechamento' : 'Executar Fechamento'} ({formatMonthLabel(selectedCloseMonth)})
            </button>

            {isMonthClosed && (
              <button 
                onClick={handleReopenMonth} 
                className="px-6 py-4 bg-rose-50 text-rose-600 font-black rounded-2xl hover:bg-rose-100 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm border border-rose-100"
              >
                <i className="fas fa-lock-open"></i> Reabrir Mês
              </button>
            )}

            {!isMonthClosed && (
              <button 
                onClick={() => setIsForceSyncModalOpen(true)} 
                className="px-6 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm border border-slate-200"
              >
                <i className="fas fa-sync-alt"></i> Sincronizar Matrículas
              </button>
            )}

            <div className="flex-1"></div>

            <button onClick={() => loadFromCloud(true)} className={`px-6 py-4 bg-emerald-50 text-emerald-600 font-black rounded-2xl hover:bg-emerald-100 transition-all flex items-center gap-3 uppercase text-[9px] tracking-widest active:scale-95 shadow-sm border border-emerald-100`}>
              <i className={`fas fa-sync-alt`}></i> Sincronizar Agora
            </button>
          </div>

      </div>
    </div>
  );
};

export default PGClosing;
