import React, { useState, useMemo } from 'react';
import { useToast } from '../../contexts/ToastContext';
import Autocomplete from '../Shared/Autocomplete';

interface PGMaestroProps {
  lists: {
    sectorsHAB: string; sectorsHABA: string;
    groupsHAB: string; groupsHABA: string;
    staffHAB: string; staffHABA: string;
  };
  setLists: React.Dispatch<React.SetStateAction<any>>;
  onAutoSave?: (updatedLists: any) => Promise<void>;
}

const PGMaestro: React.FC<PGMaestroProps> = ({ lists, setLists, onAutoSave }) => {
  const { showToast } = useToast();
  const [activeUnit, setActiveUnit] = useState<'HAB' | 'HABA'>('HAB');
  const [selectedSector, setSelectedSector] = useState('');
  const [pgSearch, setPgSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // --- PARSE DE DADOS INTELIGENTE ---

  const sectorOptions = useMemo(() => {
    const text = activeUnit === 'HAB' ? lists.sectorsHAB : lists.sectorsHABA;
    return text.split('\n').map(s => s.trim()).filter(s => s !== '').sort();
  }, [activeUnit, lists.sectorsHAB, lists.sectorsHABA]);

  const allPGEntries = useMemo(() => {
    const text = activeUnit === 'HAB' ? lists.groupsHAB : lists.groupsHABA;
    return text.split('\n').map(l => l.trim()).filter(l => l !== '');
  }, [activeUnit, lists.groupsHAB, lists.groupsHABA]);

  // Lista de nomes base de todos os PGs cadastrados (independente de vínculo)
  const allUniquePGNames = useMemo(() => {
    const names = allPGEntries.map(entry => entry.split('|')[0].trim());
    return Array.from(new Set(names)).sort();
  }, [allPGEntries]);

  // PGs que podem ser vinculados ao setor atual (aqueles que ainda não estão vinculados A ESTE SETOR)
  const availablePGs = useMemo(() => {
    if (!selectedSector) return allUniquePGNames;
    
    // Filtra nomes que já possuem a linha exata "Nome PG | Setor Atual"
    return allUniquePGNames.filter(name => {
      const match = `${name.toLowerCase()} | ${selectedSector.toLowerCase()}`;
      return !allPGEntries.some(entry => entry.toLowerCase() === match);
    });
  }, [allUniquePGNames, allPGEntries, selectedSector]);

  const currentSectorPGs = useMemo(() => {
    if (!selectedSector) return [];
    return allPGEntries
      .filter(entry => entry.includes('|') && entry.split('|')[1].trim() === selectedSector)
      .map(entry => entry.split('|')[0].trim())
      .sort();
  }, [allPGEntries, selectedSector]);

  // --- AÇÕES COM MULTI-VÍNCULO ---

  const handleLinkPG = async (pgName: string) => {
    if (!selectedSector || !pgName.trim()) {
      showToast("Selecione um setor e um PG válido.", "warning");
      return;
    }

    const groupKey = activeUnit === 'HAB' ? 'groupsHAB' : 'groupsHABA';
    const cleanName = pgName.trim();
    const newEntry = `${cleanName} | ${selectedSector}`;

    // LÓGICA N-PARA-N: 
    // Simplesmente adicionamos o novo vínculo sem remover os vínculos do PG com outros setores.
    // Apenas verificamos se este vínculo exato já existe para evitar duplicata visual.
    if (allPGEntries.some(e => e.toLowerCase() === newEntry.toLowerCase())) {
        showToast("Este PG já está vinculado a este setor.", "warning");
        return;
    }

    const updatedEntries = [...allPGEntries, newEntry].sort();

    const updatedLists = { ...lists, [groupKey]: updatedEntries.join('\n') };
    
    setPgSearch('');
    
    if (onAutoSave) {
      setIsSyncing(true);
      try {
        await onAutoSave(updatedLists);
        showToast(`${cleanName} agora também pertence ao setor ${selectedSector}!`, "success");
      } catch (e) {
        showToast("Erro ao sincronizar.", "warning");
      } finally {
        setIsSyncing(false);
      }
    } else {
      setLists(updatedLists);
    }
  };

  const handleUnlinkPG = async (pgName: string) => {
    const groupKey = activeUnit === 'HAB' ? 'groupsHAB' : 'groupsHABA';
    const entryToRemove = `${pgName} | ${selectedSector}`;

    // Remove apenas o vínculo específico deste setor
    const updatedEntries = allPGEntries.filter(line => line.trim() !== entryToRemove);
    
    // Se o PG ficou "órfão" (sem nenhum vínculo), ele deve voltar como um nome simples
    const hasOtherLinks = updatedEntries.some(e => e.startsWith(`${pgName} |`));
    if (!hasOtherLinks && !updatedEntries.includes(pgName)) {
        updatedEntries.push(pgName);
    }

    const updatedLists = { ...lists, [groupKey]: updatedEntries.sort().join('\n') };
    
    if (onAutoSave) {
      setIsSyncing(true);
      try {
        await onAutoSave(updatedLists);
        showToast(`Vínculo do ${pgName} com ${selectedSector} removido.`, "success");
      } catch (e) {
        showToast("Erro ao remover vínculo.", "warning");
      } finally {
        setIsSyncing(false);
      }
    } else {
      setLists(updatedLists);
    }
  };

  return (
    <section className="bg-slate-900 p-8 md:p-12 rounded-[3.5rem] shadow-2xl border-4 border-blue-900/30 space-y-10 animate-in fade-in duration-700 relative overflow-hidden">
      
      {isSyncing && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 overflow-hidden z-20">
          <div className="w-full h-full bg-white/40 animate-pulse"></div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 border-b border-white/10 pb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-900/50">
                <i className={`fas ${isSyncing ? 'fa-circle-notch fa-spin' : 'fa-project-diagram'}`}></i>
             </div>
             <div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Maestro de PGs</h2>
                <div className="flex items-center gap-2">
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">Vínculos Multi-Setoriais Ativos</p>
                  {isSyncing && <span className="text-white text-[8px] font-black bg-blue-500 px-2 py-0.5 rounded-md animate-pulse">FIXANDO DADOS...</span>}
                </div>
             </div>
          </div>
        </div>
        <div className="flex bg-white/5 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
          {['HAB', 'HABA'].map(u => (
            <button 
              key={u} 
              onClick={() => { setActiveUnit(u as any); setSelectedSector(''); setPgSearch(''); }}
              className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${activeUnit === u ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-slate-500 hover:text-white'}`}
            >
              Unidade {u}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-12">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="space-y-4">
             <div className="flex items-center justify-between px-4">
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">1. Localizar Setor</label>
                {selectedSector && <button onClick={() => { setSelectedSector(''); setPgSearch(''); }} className="text-[8px] font-black text-rose-400 uppercase hover:text-rose-300">Trocar Setor</button>}
             </div>
             <Autocomplete 
                options={sectorOptions}
                value={selectedSector}
                onChange={setSelectedSector}
                placeholder="Pesquise o setor (ex: Posto 1, UTI...)"
                isStrict={true}
                className="w-full p-6 bg-white/5 border-2 border-white/10 rounded-[2rem] text-white font-black text-lg focus:border-blue-500 focus:bg-white/10 outline-none transition-all placeholder:text-slate-600 shadow-inner"
             />
             <p className="text-[9px] text-slate-500 font-bold uppercase ml-4 italic">O Maestro permite que um PG pertença a vários setores simultaneamente.</p>
          </div>

          <div className={`space-y-4 transition-all duration-500 ${!selectedSector ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
             <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-4">2. Vincular ou Criar Multi-vínculo</label>
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
                <button 
                  onClick={() => handleLinkPG(pgSearch)}
                  disabled={!selectedSector || !pgSearch || isSyncing}
                  className="w-20 h-20 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center text-3xl hover:bg-blue-700 transition-all shadow-2xl active:scale-95 disabled:opacity-20"
                >
                  <i className={`fas ${isSyncing ? 'fa-circle-notch fa-spin' : 'fa-plus'}`}></i>
                </button>
             </div>
             <div className="flex items-center gap-3 px-4 py-2 bg-blue-500/5 rounded-xl border border-blue-500/10">
                <i className="fas fa-users-cog text-blue-400 text-xs"></i>
                <span className="text-[8px] font-black text-blue-300/60 uppercase tracking-widest">Multi-vínculo: Se o PG já tem setor, ele ganhará este novo endereço adicional.</span>
             </div>
          </div>
        </div>

        <div className="space-y-6 min-h-[300px]">
          {!selectedSector ? (
            <div className="h-[300px] flex flex-col items-center justify-center text-center space-y-6 bg-white/2 rounded-[3rem] border-2 border-dashed border-white/5">
               <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-white/10 text-4xl">
                  <i className="fas fa-object-group"></i>
               </div>
               <p className="text-slate-600 font-black uppercase text-xs tracking-[0.3em] max-w-xs leading-relaxed">
                 Aguardando setor para exibir PGs vinculados (Incluindo multi-setoriais)
               </p>
            </div>
          ) : (
            <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-6">
              <div className="flex items-center justify-between px-4">
                 <h3 className="text-white font-black text-xl uppercase tracking-tighter flex items-center gap-3">
                    <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                    PGs vinculados ao <span className="text-blue-400">{selectedSector}</span>
                 </h3>
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{currentSectorPGs.length} Ativos</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentSectorPGs.length > 0 ? (
                  currentSectorPGs.map(pg => (
                    <div key={pg} className="group p-6 bg-white/5 rounded-[2.5rem] border border-white/10 hover:border-blue-500/50 transition-all flex items-center justify-between shadow-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center font-black text-xl">
                          <i className="fas fa-link text-xs opacity-50 absolute -top-1 -right-1"></i>
                          {pg[0]}
                        </div>
                        <span className="text-white font-black text-sm tracking-tight">{pg}</span>
                      </div>
                      <button 
                        onClick={() => handleUnlinkPG(pg)}
                        disabled={isSyncing}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-rose-500/20 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
                        title="Remover este vínculo"
                      >
                        <i className={`fas ${isSyncing ? 'fa-spinner fa-spin' : 'fa-times'} text-sm`}></i>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 bg-white/2 rounded-[3rem] border-2 border-dashed border-white/5 text-center flex flex-col items-center justify-center space-y-4">
                     <i className="fas fa-layer-group text-3xl text-white/5"></i>
                     <p className="text-slate-600 font-bold uppercase text-[10px] tracking-widest italic">Setor sem PGs vinculados no momento.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PGMaestro;