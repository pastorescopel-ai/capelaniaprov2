
import React, { useState, useMemo } from 'react';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';
import ConfirmationModal from '../Shared/ConfirmationModal';
import { ProStaff, ProSector, ProGroup, Unit, ProGroupLocation } from '../../types';
import { useApp } from '../../contexts/AppContext';

interface PGMaestroProps {
  proData?: any;
}

const PGMaestro: React.FC<PGMaestroProps> = () => {
  const { showToast } = useToast();
  const { proSectors, proGroups, proGroupLocations, saveRecord, deleteRecord, mergePGs } = useApp();
  
  const [activeUnit, setActiveUnit] = useState<Unit>(Unit.HAB);
  const [viewMode, setViewMode] = useState<'maestro' | 'merge'>('maestro');
  const [selectedSectorName, setSelectedSectorName] = useState('');
  const [pgSearch, setPgSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Estados para o Modal de Fusão
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [pendingMerge, setPendingMerge] = useState<{source: ProGroup, target: ProGroup} | null>(null);
  const [rowSearchValues, setRowSearchValues] = useState<Record<string, string>>({});

  // --- MODO MAESTRO: DADOS ---
  const currentSector = useMemo(() => {
    return proSectors.find(s => s.name === selectedSectorName && s.unit === activeUnit);
  }, [proSectors, selectedSectorName, activeUnit]);

  const sectorOptions = useMemo(() => {
    return proSectors
      .filter(s => s.unit === activeUnit)
      .map(s => ({ value: s.name, label: s.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [proSectors, activeUnit]);

  const availablePGs = useMemo(() => {
    if (!currentSector) return proGroups.filter(g => g.unit === activeUnit).map(g => ({ value: g.name, label: g.name }));
    const linkedGroupIds = new Set(proGroupLocations.filter(loc => loc.sectorId === currentSector.id).map(loc => loc.groupId));
    return proGroups
        .filter(g => g.unit === activeUnit && !linkedGroupIds.has(g.id))
        .map(g => ({ value: g.name, label: g.name }));
  }, [proGroups, proGroupLocations, currentSector, activeUnit]);

  const linkedPGs = useMemo(() => {
    if (!currentSector) return [];
    const relationships = proGroupLocations.filter(loc => loc.sectorId === currentSector.id);
    return relationships.map(rel => {
        const group = proGroups.find(g => g.id === rel.groupId);
        return {
            locationId: rel.id,
            groupName: group ? group.name : "PG Desconhecido",
            groupId: rel.groupId
        };
    }).sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [proGroupLocations, proGroups, currentSector]);

  // --- AÇÕES ---

  const handleLinkPG = async (pgName: string) => {
    // #ESTRUTURA_PRO: Validação de integridade antes da criação do vínculo
    if (!currentSector || !currentSector.id) { 
        showToast("Setor de destino inválido ou inexistente.", "warning"); 
        return; 
    }
    
    const group = proGroups.find(g => g.name === pgName && g.unit === activeUnit);
    if (!group || !group.id) { 
        showToast("Pequeno Grupo não localizado no cadastro.", "warning"); 
        return; 
    }

    setIsSyncing(true);
    try {
        const newLink: ProGroupLocation = { 
            id: crypto.randomUUID(), 
            groupId: group.id, 
            sectorId: currentSector.id, 
            unit: activeUnit, 
            createdAt: Date.now() 
        };
        await saveRecord('proGroupLocations', newLink);
        setPgSearch('');
        showToast("Vínculo estrutural criado!", "success");
    } catch (e) { 
        showToast("Falha na integridade dos dados.", "warning"); 
    } finally { 
        setIsSyncing(false); 
    }
  };

  const handleUnlinkPG = async (locationId: string) => {
    setIsSyncing(true);
    try { await deleteRecord('proGroupLocations', locationId); showToast("Vínculo removido.", "success"); } 
    catch (e) { showToast("Erro.", "warning"); } 
    finally { setIsSyncing(false); }
  };

  const initiateMerge = (source: ProGroup, selectedLabel: string) => {
      const targetId = selectedLabel.split(' - ')[0].trim();
      let target = proGroups.find(g => g.id === targetId);
      
      if (!target && /^\d+$/.test(targetId)) {
          target = {
              id: targetId,
              name: source.name,
              unit: source.unit
          } as ProGroup;
      }
      
      if (target && target.id !== source.id) {
          setPendingMerge({ source, target });
          setMergeModalOpen(true);
      }
      
      setRowSearchValues(prev => ({ ...prev, [source.id]: '' }));
  };

  const executeMerge = async () => {
      if (!pendingMerge) return;
      setMergeModalOpen(false);
      const res = await mergePGs(pendingMerge.source.id, pendingMerge.target.id);
      if (res.success) showToast(res.message, "success");
      else showToast(res.message, "warning");
      setPendingMerge(null);
  };

  const dirtyPGs = useMemo(() => {
    return proGroups.filter(g => 
        g.unit === activeUnit && /^(HAB|HABA|A)[-\s]/.test(g.id)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [proGroups, activeUnit]);

  const cleanPGOptions = useMemo(() => {
    return proGroups
        .filter(g => g.unit === activeUnit && !/^(HAB|HABA|A)[-\s]/.test(g.id))
        .map(g => ({ value: g.id, label: `${g.id} - ${g.name}` }));
  }, [proGroups, activeUnit]);

  return (
    <section className="bg-slate-900 p-8 md:p-12 rounded-[3.5rem] shadow-2xl border-4 border-blue-900/30 space-y-10 animate-in fade-in duration-700 relative">
      
      {isSyncing && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 overflow-hidden z-20 rounded-t-[3.2rem]">
          <div className="w-full h-full bg-white/40 animate-pulse"></div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={mergeModalOpen}
        title="Confirmar Fusão"
        message={pendingMerge ? `Deseja fundir "${pendingMerge.source.name}" (ID Antigo) dentro do "${pendingMerge.target.name}" (ID Oficial: ${pendingMerge.target.id})?\n\nEsta ação transferirá todos os vínculos de setor e EXCLUIRÁ o registro antigo.` : ''}
        confirmLabel="Sim, Fundir PGs"
        variant="warning"
        onConfirm={executeMerge}
        onCancel={() => { setMergeModalOpen(false); setPendingMerge(null); }}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 border-b border-white/10 pb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-900/50">
                <i className={`fas ${isSyncing ? 'fa-circle-notch fa-spin' : 'fa-project-diagram'}`}></i>
             </div>
             <div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Maestro de PGs</h2>
                <div className="flex items-center gap-4">
                  <button onClick={() => setViewMode('maestro')} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${viewMode === 'maestro' ? 'text-blue-400' : 'text-slate-500 hover:text-white'}`}>Vínculos</button>
                  <span className="text-slate-700">|</span>
                  <button onClick={() => setViewMode('merge')} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${viewMode === 'merge' ? 'text-amber-400' : 'text-slate-500 hover:text-white'}`}>Consolidação</button>
                </div>
             </div>
          </div>
        </div>
        <div className="flex bg-white/5 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
          {[Unit.HAB, Unit.HABA].map(u => (
            <button 
              key={u} 
              onClick={() => { setActiveUnit(u); setSelectedSectorName(''); setPgSearch(''); }}
              className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${activeUnit === u ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-slate-500 hover:text-white'}`}
            >
              Unidade {u}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'maestro' ? (
        <div className="max-w-5xl mx-auto space-y-12 animate-in slide-in-from-right duration-300">
            <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
                <div className="flex items-center justify-between px-4">
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">1. Selecionar Setor</label>
                    {selectedSectorName && <button onClick={() => { setSelectedSectorName(''); setPgSearch(''); }} className="text-[8px] font-black text-rose-400 uppercase hover:text-rose-300">Trocar Setor</button>}
                </div>
                <Autocomplete 
                    options={sectorOptions}
                    value={selectedSectorName}
                    onChange={setSelectedSectorName}
                    placeholder="Pesquise o setor (ex: Posto 1, UTI...)"
                    isStrict={true}
                    className="w-full p-6 bg-white/5 border-2 border-white/10 rounded-[2rem] text-white font-black text-lg focus:border-blue-500 focus:bg-white/10 outline-none transition-all placeholder:text-slate-600 shadow-inner"
                />
            </div>

            <div className={`space-y-4 transition-all duration-500 ${!selectedSectorName ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-4">2. Adicionar PG ao Setor</label>
                <div className="flex gap-3">
                    <div className="flex-1">
                    <Autocomplete 
                        options={availablePGs}
                        value={pgSearch}
                        onChange={setPgSearch}
                        placeholder="Busque o nome do PG..."
                        className="w-full p-6 bg-white/5 border-2 border-white/10 rounded-[2rem] text-white font-black text-lg focus:border-blue-500 focus:bg-white/10 outline-none transition-all placeholder:text-slate-600 shadow-inner"
                    />
                    </div>
                    <button onClick={() => handleLinkPG(pgSearch)} disabled={!currentSector || !pgSearch || isSyncing} className="w-20 h-20 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center text-3xl hover:bg-blue-700 transition-all shadow-2xl active:scale-95 disabled:opacity-20">
                    <i className={`fas ${isSyncing ? 'fa-circle-notch fa-spin' : 'fa-plus'}`}></i>
                    </button>
                </div>
            </div>
            </div>

            <div className="space-y-6 min-h-[300px]">
            {!selectedSectorName ? (
                <div className="h-[300px] flex flex-col items-center justify-center text-center space-y-6 bg-white/2 rounded-[3rem] border-2 border-dashed border-white/5">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-white/10 text-4xl"><i className="fas fa-object-group"></i></div>
                <p className="text-slate-600 font-black uppercase text-xs tracking-[0.3em]">Aguardando setor para exibir PGs</p>
                </div>
            ) : (
                <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex items-center justify-between px-4">
                    <h3 className="text-white font-black text-xl uppercase tracking-tighter flex items-center gap-3">
                        <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                        PGs vinculados ao <span className="text-blue-400">{selectedSectorName}</span>
                    </h3>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{linkedPGs.length} Vinculados</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {linkedPGs.map(item => (
                        <div key={item.locationId} className="group p-6 bg-white/5 rounded-[2.5rem] border border-white/10 hover:border-blue-500/50 transition-all flex items-center justify-between shadow-xl">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center font-black text-xl">{item.groupName[0]}</div>
                            <span className="text-white font-black text-sm tracking-tight">{item.groupName}</span>
                        </div>
                        <button onClick={() => handleUnlinkPG(item.locationId)} disabled={isSyncing} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-rose-500/20 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"><i className="fas fa-times text-sm"></i></button>
                        </div>
                    ))}
                </div>
                </div>
            )}
            </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-left duration-300">
            <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-[2rem] flex gap-4 items-center">
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-slate-900 text-2xl"><i className="fas fa-broom"></i></div>
                <div>
                    <h3 className="text-amber-400 font-black uppercase text-sm tracking-widest">Ferramenta de Fusão</h3>
                    <p className="text-slate-400 text-xs mt-1">Identifique PGs duplicados (com prefixo antigo) e una-os aos IDs numéricos oficiais. Os vínculos de setor serão migrados automaticamente.</p>
                </div>
            </div>

            {dirtyPGs.length === 0 ? (
                <div className="text-center py-20 opacity-50">
                    <i className="fas fa-check-circle text-4xl text-emerald-500 mb-4"></i>
                    <p className="text-white font-bold">Nenhum PG com prefixo antigo encontrado nesta unidade.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {dirtyPGs.map(pg => (
                        <div key={pg.id} className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 flex flex-col md:flex-row items-center gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="bg-rose-500/20 text-rose-400 text-[9px] font-black px-2 py-1 rounded uppercase">{pg.id}</span>
                                    <h4 className="text-white font-bold">{pg.name}</h4>
                                </div>
                                <p className="text-slate-500 text-xs">ID Antigo detectado</p>
                            </div>
                            
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <i className="fas fa-arrow-right text-slate-600 hidden md:block"></i>
                                <div className="w-full md:w-64">
                                    <Autocomplete 
                                        options={cleanPGOptions}
                                        value={rowSearchValues[pg.id] || ''}
                                        onChange={(val) => setRowSearchValues(prev => ({...prev, [pg.id]: val}))}
                                        onSelectOption={(val) => initiateMerge(pg, val)}
                                        placeholder="Busque o nome ou ID..."
                                        className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-white text-xs font-bold focus:border-amber-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      )}
    </section>
  );
};

export default PGMaestro;
