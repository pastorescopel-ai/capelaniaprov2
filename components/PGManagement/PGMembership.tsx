
import React, { useState, useMemo, useEffect } from 'react';
import { Unit, ProGroupMember, ProGroup } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';
import ConfirmationModal from '../Shared/ConfirmationModal';
import { normalizeString } from '../../utils/formatters';

interface PGMembershipProps {
  unit: Unit;
}

const PGMembership: React.FC<PGMembershipProps> = ({ unit }) => {
  const { proSectors, proStaff, proGroups, proGroupMembers, proGroupLocations, saveRecord, deleteRecord } = useApp();
  const { showToast } = useToast();
  
  const [selectedSectorName, setSelectedSectorName] = useState('');
  const [selectedPGName, setSelectedPGName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // --- ESTADOS OTIMISTAS (UI Instantânea) ---
  const [pendingTransfers, setPendingTransfers] = useState<Set<string>>(new Set());
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());

  // Estado para o Modal de Exclusão
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setPendingTransfers(new Set());
    setPendingRemovals(new Set());
  }, [proGroupMembers]);

  const cleanId = (id: any) => String(id || '').replace(/\D/g, '');

  // --- DADOS ---
  const currentSector = useMemo(() => proSectors.find(s => s.name === selectedSectorName && s.unit === unit), [proSectors, selectedSectorName, unit]);
  const currentPG = useMemo(() => proGroups.find(g => g.name === selectedPGName && g.unit === unit), [proGroups, selectedPGName, unit]);

  // Radar de Lacunas: Setores com Vacância (Semáforo)
  const coverageGaps = useMemo(() => {
    const sectors = proSectors.filter(s => s.unit === unit);
    const staff = proStaff.filter(s => s.unit === unit);

    return sectors.map(s => {
      const sectorStaff = staff.filter(st => cleanId(st.sectorId) === cleanId(s.id));
      const total = sectorStaff.length;
      if (total === 0) return null;

      // Filtro de Soft Delete: Considera apenas membros sem leftAt (Ativos)
      const enrolled = sectorStaff.filter(st => 
        proGroupMembers.some(m => cleanId(m.staffId) === cleanId(st.id) && !m.leftAt)
      ).length;

      const percentage = (enrolled / total) * 100;

      // Meta batida (100%) -> Desaparece do radar
      if (percentage >= 100) return null;

      return {
        id: s.id,
        name: s.name,
        percentage,
        total,
        enrolled,
        color: percentage >= 80 ? 'emerald' : percentage >= 31 ? 'amber' : 'rose'
      };
    }).filter(item => item !== null).sort((a, b) => a!.percentage - b!.percentage);
  }, [proSectors, proStaff, proGroupMembers, unit]);

  // Radar de Lacunas: PGs "Fantasmas" (Cadastrados no banco mas sem membros ATIVOS)
  const emptyPGs = useMemo(() => {
    return proGroups
      .filter(g => g.unit === unit)
      .filter(g => !proGroupMembers.some(m => m.groupId === g.id && !m.leftAt))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [proGroups, proGroupMembers, unit]);

  const sectorStaff = useMemo(() => {
    if (!currentSector) return [];
    return proStaff
      .filter(s => s.sectorId === currentSector.id)
      .map(staff => {
        // Filtro Soft Delete: Procura apenas matrícula ativa
        const membership = proGroupMembers.find(m => cleanId(m.staffId) === cleanId(staff.id) && !m.leftAt);
        const groupName = membership ? proGroups.find(g => g.id === membership.groupId)?.name : null;
        
        // Data formatada para exibição (Se matriculado)
        const dateStr = membership?.joinedAt 
            ? new Date(membership.joinedAt).toLocaleDateString('pt-BR') 
            : null;

        return { ...staff, membership, groupName, joinedDate: dateStr };
      })
      .filter(staff => {
        if (currentPG) {
            const isAlreadyInThisGroup = proGroupMembers.some(m => 
                m.groupId === currentPG.id && cleanId(m.staffId) === cleanId(staff.id) && !m.leftAt
            );
            if (isAlreadyInThisGroup) return false;
        }
        if (pendingTransfers.has(staff.id)) return false;
        return true;
      })
      .sort((a, b) => {
        if (!a.membership && b.membership) return -1;
        if (a.membership && !b.membership) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [proStaff, currentSector, proGroupMembers, proGroups, currentPG, pendingTransfers]);

  const pgMembers = useMemo(() => {
    if (!currentPG) return [];
    const realMembers = proGroupMembers
      .filter(m => m.groupId === currentPG.id && !m.leftAt && !pendingRemovals.has(m.id)) // Filtro Soft Delete
      .map(m => {
        let staff = proStaff.find(s => cleanId(s.id) === cleanId(m.staffId));
        return { 
            id: m.id,
            staffName: staff?.name || `Desconhecido (ID: ${m.staffId})`, 
            staffId: m.staffId,
            joinedDate: m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('pt-BR') : '',
            isOptimistic: false,
            isLeader: currentPG.currentLeader === staff?.name
        };
      });

    const optimisticMembers = Array.from(pendingTransfers).map(staffId => {
        const staff = proStaff.find(s => s.id === staffId);
        return {
            id: `temp-${staffId}`, 
            staffName: staff?.name || "Processando...",
            staffId: staffId,
            joinedDate: "Hoje",
            isOptimistic: true,
            isLeader: false
        };
    });

    const allMembers = [...realMembers, ...optimisticMembers].filter((m, index, self) => 
        index === self.findIndex((t) => (t.staffId === m.staffId))
    );

    return allMembers.sort((a, b) => {
        if (a.isLeader && !b.isLeader) return -1;
        if (!a.isLeader && b.isLeader) return 1;
        return a.staffName.localeCompare(b.staffName);
    });
  }, [proGroupMembers, currentPG, proStaff, pendingTransfers, pendingRemovals]);

  // --- AÇÕES ---

  const handleEnroll = async (staffId: string) => {
    if (!currentPG) { showToast("Selecione um PG de destino primeiro.", "warning"); return; }
    setPendingTransfers(prev => new Set(prev).add(staffId));
    setIsProcessing(true);
    try {
      // Soft Delete: Verifica se existe uma matrícula ATIVA em outro grupo
      const existingActive = proGroupMembers.find(m => cleanId(m.staffId) === cleanId(staffId) && !m.leftAt);
      
      if (existingActive) {
        if (existingActive.groupId === currentPG.id) return; // Já está neste grupo
        // "Fecha" a matrícula anterior (Soft Delete)
        await saveRecord('proGroupMembers', { ...existingActive, leftAt: Date.now() });
      }

      // Cria nova matrícula
      const newMember: ProGroupMember = {
        id: crypto.randomUUID(),
        groupId: currentPG.id,
        staffId: staffId,
        joinedAt: Date.now()
      };
      await saveRecord('proGroupMembers', newMember);
      showToast("Matrícula realizada!", "success");
    } catch (e) {
      setPendingTransfers(prev => { const newSet = new Set(prev); newSet.delete(staffId); return newSet; });
      showToast("Erro ao matricular.", "warning");
    } finally { setIsProcessing(false); }
  };

  const confirmRemoval = async () => {
    if (!memberToRemove) return;
    setPendingRemovals(prev => new Set(prev).add(memberToRemove.id));
    
    // Soft Delete: Encontra o membro e atualiza leftAt em vez de deletar
    const memberToUpdate = proGroupMembers.find(m => m.id === memberToRemove.id);
    
    setMemberToRemove(null);
    setIsProcessing(true);
    
    try {
      if (memberToUpdate) {
          await saveRecord('proGroupMembers', { ...memberToUpdate, leftAt: Date.now() });
          showToast("Removido com sucesso.", "success");
      }
    } catch (e) {
      setPendingRemovals(prev => { const newSet = new Set(prev); newSet.delete(memberToRemove.id); return newSet; });
      showToast("Erro ao remover.", "warning");
    } finally { setIsProcessing(false); }
  };

  const handleSetLeader = async (member: any) => {
      if (!currentPG || isProcessing) return;
      if (member.isLeader) return;
      setIsProcessing(true);
      try {
          const updatedPG: ProGroup = { ...currentPG, currentLeader: member.staffName };
          await saveRecord('proGroups', updatedPG);
          showToast(`${member.staffName} é o novo líder!`, "success");
      } catch (e) { showToast("Erro ao definir líder.", "warning"); } 
      finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-500">
      
      <ConfirmationModal 
        isOpen={!!memberToRemove}
        title="Remover do Grupo?"
        message={`Deseja desvincular "${memberToRemove?.name}" deste Pequeno Grupo?`}
        confirmLabel="Sim, Remover"
        variant="danger"
        onConfirm={confirmRemoval}
        onCancel={() => setMemberToRemove(null)}
      />

      <div className="bg-slate-900 p-8 rounded-[3rem] shadow-xl grid md:grid-cols-2 gap-8 text-white relative">
        <div className="absolute inset-0 rounded-[3rem] overflow-hidden pointer-events-none">
           <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        </div>
        
        <div className="space-y-2 z-10 relative">
          <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">1. Selecione o Setor (Origem)</label>
          <Autocomplete 
            options={proSectors.filter(s => s.unit === unit).map(s => ({ value: s.name, label: s.name }))}
            value={selectedSectorName}
            onChange={setSelectedSectorName}
            placeholder="Buscar Setor..."
            className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl text-white font-bold placeholder:text-white/30 focus:bg-white/20 outline-none"
          />
        </div>

        <div className="space-y-2 z-10 relative">
          <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">2. Selecione o PG (Destino)</label>
          <Autocomplete 
            options={proGroups.filter(g => g.unit === unit).map(g => ({ value: g.name, label: g.name }))}
            value={selectedPGName}
            onChange={setSelectedPGName}
            placeholder="Buscar Pequeno Grupo..."
            className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl text-white font-bold placeholder:text-white/30 focus:bg-white/20 outline-none"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col min-h-[400px]">
          <div className="mb-4 pb-4 border-b border-slate-50">
            <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-users text-slate-400"></i> Disponíveis no Setor
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{sectorStaff.length} Aguardando Matrícula</p>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 max-h-[500px]">
            {sectorStaff.length === 0 && (
                <div className="text-center py-10 opacity-50">
                    <p className="text-xs text-slate-400 font-bold uppercase">{currentSector ? 'Todos vinculados ou lista vazia.' : 'Selecione um setor.'}</p>
                </div>
            )}
            {sectorStaff.map(staff => (
              <div key={staff.id} className="p-4 rounded-2xl flex items-center justify-between border bg-white border-blue-100 shadow-sm hover:border-blue-300 transition-all animate-in slide-in-from-left duration-300">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-700 text-xs uppercase truncate">{staff.name}</p>
                  <p className="text-[9px] font-bold uppercase text-slate-400 truncate flex items-center gap-2">
                      {staff.membership ? (
                          <>
                            <span>Mover de: {staff.groupName}</span>
                            {staff.joinedDate && <span className="text-[8px] bg-slate-100 px-1.5 rounded text-slate-500">Desde: {staff.joinedDate}</span>}
                          </>
                      ) : 'Não Matriculado'}
                  </p>
                </div>
                <button onClick={() => handleEnroll(staff.id)} disabled={!currentPG || isProcessing} className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 flex-shrink-0 ml-4 ${staff.membership ? 'bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}><i className={`fas ${staff.membership ? 'fa-exchange-alt' : 'fa-plus'} text-xs`}></i></button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100 flex flex-col min-h-[400px]">
          <div className="mb-4 pb-4 border-b border-emerald-100/50">
            <h3 className="font-black text-emerald-900 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-house-user text-emerald-500"></i> Membros do PG
            </h3>
            <p className="text-[10px] text-emerald-700/60 font-bold uppercase mt-1">{currentPG ? `${pgMembers.length} Matriculados` : 'Selecione um PG'}</p>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 max-h-[500px]">
            {pgMembers.map(member => (
              <div key={member.id} className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all group ${member.isOptimistic ? 'bg-emerald-100 border-emerald-200 animate-pulse' : member.isLeader ? 'bg-amber-50 border-amber-200 shadow-md' : 'bg-white border-emerald-100'}`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {member.isOptimistic && <i className="fas fa-circle-notch fa-spin text-[10px] text-emerald-600"></i>}
                    {member.isLeader && <i className="fas fa-crown text-amber-500 text-xs animate-bounce"></i>}
                    <div className="min-w-0">
                        <p className={`text-xs uppercase truncate ${member.isLeader ? 'font-black text-amber-800' : 'font-bold text-emerald-900'}`}>{member.staffName}</p>
                        {member.joinedDate && <p className="text-[8px] font-bold text-emerald-600/60 uppercase">Desde: {member.joinedDate}</p>}
                    </div>
                </div>
                {!member.isOptimistic && (
                    <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button onClick={() => handleSetLeader(member)} disabled={isProcessing || member.isLeader} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${member.isLeader ? 'bg-amber-100 text-amber-500 cursor-default' : 'bg-slate-50 text-slate-300 hover:text-amber-400 hover:bg-amber-50'}`}><i className="fas fa-crown text-[10px]"></i></button>
                        <button onClick={() => setMemberToRemove({ id: member.id, name: member.staffName })} disabled={isProcessing} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-300 hover:text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-all"><i className="fas fa-trash text-[10px]"></i></button>
                    </div>
                )}
              </div>
            ))}
            {currentPG && pgMembers.length === 0 && (
              <div className="text-center py-10 opacity-50"><i className="fas fa-user-friends text-4xl text-emerald-300 mb-2"></i><p className="text-xs font-bold text-emerald-700">PG vazio.</p></div>
            )}
          </div>
        </div>
      </div>

      {/* --- RADAR DE LACUNAS OPERACIONAIS (V2 - SEMÁFORO) --- */}
      <div className="pt-8 border-t border-slate-200">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight px-4 mb-6 flex items-center gap-3">
          <i className="fas fa-radar text-blue-600"></i> Radar de Vacância Profissional
        </h3>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Radar 1: Saúde de Cobertura por Setor */}
          <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-200 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-slate-100">
                <i className="fas fa-traffic-light"></i>
              </div>
              <div>
                <h4 className="font-black text-slate-800 uppercase text-sm tracking-widest">Saúde da Cobertura</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{coverageGaps.length} setores com vacância</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {coverageGaps.length > 0 ? coverageGaps.map(gap => (
                <button 
                  key={gap.id} 
                  onClick={() => { setSelectedSectorName(gap.name); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`px-4 py-2 bg-white text-[10px] font-black uppercase rounded-xl border shadow-sm transition-all active:scale-95 flex items-center gap-2
                    ${gap.color === 'rose' ? 'text-rose-600 border-rose-100 hover:bg-rose-500 hover:text-white' : 
                      gap.color === 'amber' ? 'text-amber-600 border-amber-100 hover:bg-amber-500 hover:text-white' : 
                      'text-emerald-600 border-emerald-100 hover:bg-emerald-500 hover:text-white'}
                  `}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    gap.color === 'rose' ? 'bg-rose-500' : 
                    gap.color === 'amber' ? 'bg-amber-500' : 
                    'bg-emerald-500'
                  }`}></span>
                  {gap.name} ({Math.round(gap.percentage)}%)
                </button>
              )) : (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                  <i className="fas fa-check-circle"></i>
                  <span className="text-[10px] font-black uppercase">Meta 100% batida em todos os setores!</span>
                </div>
              )}
            </div>
            {coverageGaps.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span className="text-[8px] font-black uppercase text-slate-400">Crítico (0-30%)</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span><span className="text-[8px] font-black uppercase text-slate-400">Alerta (31-79%)</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span className="text-[8px] font-black uppercase text-slate-400">Sucesso (80%+)</span></div>
                </div>
            )}
          </div>

          {/* Radar 2: PGs em "Limbo" (Fantasmas) */}
          <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-200 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-slate-100">
                <i className="fas fa-ghost"></i>
              </div>
              <div>
                <h4 className="font-black text-slate-800 uppercase text-sm tracking-widest">PGs "Fantasmas"</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{emptyPGs.length} grupos vazios detectados</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {emptyPGs.length > 0 ? emptyPGs.map(pg => (
                <button 
                  key={pg.id} 
                  onClick={() => { setSelectedPGName(pg.name); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="px-4 py-2 bg-white text-slate-400 text-[10px] font-black uppercase rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 hover:text-blue-600 transition-all active:scale-95 flex items-center gap-2"
                >
                  <i className="fas fa-user-slash text-[8px]"></i>
                  {pg.name}
                </button>
              )) : (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                  <i className="fas fa-check-circle"></i>
                  <span className="text-[10px] font-black uppercase">Todos os PGs têm membros!</span>
                </div>
              )}
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest italic pt-2">
              * Clique em um grupo para começar a matricular membros nele.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PGMembership;
