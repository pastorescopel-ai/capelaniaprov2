
import React, { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { normalizeString } from '../../utils/formatters';
import { Unit, ProStaff } from '../../types';
import Autocomplete from '../Shared/Autocomplete';

type MigrationTab = 'sectors' | 'pgs' | 'masterlist';

const MigrationBridge: React.FC = () => {
  const { 
    bibleStudies, bibleClasses, smallGroups, staffVisits, visitRequests,
    proSectors, proGroups, proStaff, 
    // masterLists removed
    executeSectorMigration, executePGMigration, saveRecord 
  } = useApp();
  
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<MigrationTab>('sectors');
  const [targetMap, setTargetMap] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [defaultImportSector, setDefaultImportSector] = useState('');

  // --- 1. LÓGICA DE DETECÇÃO DE ÓRFÃOS (SETORES) ---
  const sectorOrphans = useMemo(() => {
    const historySet = new Set<string>();
    
    [bibleStudies, bibleClasses, smallGroups, staffVisits].forEach(list => {
      list.forEach(item => {
        if (item.sector && item.sector.trim()) {
          historySet.add(item.sector.trim());
        }
      });
    });

    const officialSet = new Set(proSectors.map(s => s.name.trim()));
    
    // Filtra apenas o que não está no oficial
    return Array.from(historySet)
      .filter(h => !officialSet.has(h))
      .sort();
  }, [bibleStudies, bibleClasses, smallGroups, staffVisits, proSectors]);

  // --- 2. LÓGICA DE DETECÇÃO DE ÓRFÃOS (PGs) ---
  const pgOrphans = useMemo(() => {
    const historySet = new Set<string>();
    
    smallGroups.forEach(g => { if(g.groupName) historySet.add(g.groupName.trim()); });
    visitRequests.forEach(r => { if(r.pgName) historySet.add(r.pgName.trim()); });

    const officialSet = new Set(proGroups.map(g => g.name.trim()));

    return Array.from(historySet)
      .filter(h => !officialSet.has(h))
      .sort();
  }, [smallGroups, visitRequests, proGroups]);

  // --- 3. LÓGICA DE IMPORTAÇÃO (MasterList -> ProStaff) ---
  // MasterList desativada pois foi removida do contexto.
  const masterListCandidates: {name: string, unit: Unit}[] = [];

  // --- AÇÕES ---

  const handleMigrateSector = async (oldName: string) => {
    const newName = targetMap[oldName];
    if (!newName) return;
    
    setIsProcessing(true);
    try {
      const result = await executeSectorMigration(oldName, newName);
      showToast(result, "success");
      // Remove do mapa local para limpar a UI
      setTargetMap(prev => { const n = {...prev}; delete n[oldName]; return n; });
    } catch (e: any) {
      showToast("Erro: " + e.message, "warning");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMigratePG = async (oldName: string) => {
    const newName = targetMap[oldName];
    if (!newName) return;
    
    setIsProcessing(true);
    try {
      const result = await executePGMigration(oldName, newName);
      showToast(result, "success");
      setTargetMap(prev => { const n = {...prev}; delete n[oldName]; return n; });
    } catch (e: any) {
      showToast("Erro: " + e.message, "warning");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportStaff = async () => {
    if (selectedStaff.size === 0) return;
    
    // Se não tiver setor padrão, avisa, mas permite (vai como null/undefined)
    const targetSectorId = defaultImportSector 
        ? proSectors.find(s => s.name === defaultImportSector)?.id 
        : "";

    setIsProcessing(true);
    try {
      const newStaff: ProStaff[] = [];
      masterListCandidates.forEach(cand => {
        if (selectedStaff.has(cand.name)) {
          newStaff.push({
            id: crypto.randomUUID(), // Gera ID novo pois é "avulso"
            name: cand.name,
            unit: cand.unit,
            sectorId: targetSectorId || "",
            active: true,
            updatedAt: Date.now()
          });
        }
      });

      await saveRecord('proStaff', newStaff);
      showToast(`${newStaff.length} colaboradores importados com sucesso!`, "success");
      setSelectedStaff(new Set());
    } catch (e) {
      showToast("Erro na importação.", "warning");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelectAllStaff = () => {
    if (selectedStaff.size === masterListCandidates.length) {
      setSelectedStaff(new Set());
    } else {
      setSelectedStaff(new Set(masterListCandidates.map(c => c.name)));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32">
      <div className="bg-amber-50 border-l-8 border-amber-400 p-6 rounded-r-2xl shadow-sm">
        <h2 className="text-2xl font-black text-amber-900 uppercase tracking-tighter flex items-center gap-3">
          <i className="fas fa-random"></i> Ponte de Migração
        </h2>
        <p className="text-amber-800 text-xs font-bold mt-2 uppercase tracking-widest leading-relaxed">
          Ferramenta temporária para consolidar dados históricos com a nova estrutura. 
          Use com cautela. As alterações são irreversíveis.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        <button onClick={() => setActiveTab('sectors')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'sectors' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>Setores Órfãos ({sectorOrphans.length})</button>
        <button onClick={() => setActiveTab('pgs')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'pgs' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>PGs Órfãos ({pgOrphans.length})</button>
        <button onClick={() => setActiveTab('masterlist')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'masterlist' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>Importar MasterList ({masterListCandidates.length})</button>
      </div>

      {/* --- TAB: SETORES --- */}
      {activeTab === 'sectors' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Mapeamento de Setores</h3>
            <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{sectorOrphans.length} Pendentes</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {sectorOrphans.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs">Todos os setores históricos estão vinculados!</div>
            ) : (
                sectorOrphans.map(oldName => (
                <div key={oldName} className="p-4 flex flex-col md:flex-row items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 w-full">
                    <span className="block text-[9px] font-bold text-rose-400 uppercase mb-1">Histórico (Texto Antigo)</span>
                    <div className="font-black text-slate-800 uppercase text-sm">{oldName}</div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300"><i className="fas fa-arrow-right"></i></div>
                    <div className="flex-1 w-full">
                        <Autocomplete 
                            options={proSectors.map(s => ({ value: s.name, label: `${s.id} - ${s.name}`, subLabel: s.unit }))}
                            value={targetMap[oldName] || ''}
                            onChange={(val) => setTargetMap(prev => ({...prev, [oldName]: val}))}
                            placeholder="Selecione o Setor Oficial..."
                            className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs focus:border-blue-500 outline-none"
                        />
                    </div>
                    <button 
                        onClick={() => handleMigrateSector(oldName)}
                        disabled={!targetMap[oldName] || isProcessing}
                        className="px-4 py-3 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-md"
                    >
                        {isProcessing ? '...' : 'Migrar'}
                    </button>
                </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* --- TAB: PGS --- */}
      {activeTab === 'pgs' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Mapeamento de PGs</h3>
            <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{pgOrphans.length} Pendentes</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {pgOrphans.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs">Todos os PGs históricos estão vinculados!</div>
            ) : (
                pgOrphans.map(oldName => (
                <div key={oldName} className="p-4 flex flex-col md:flex-row items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 w-full">
                    <span className="block text-[9px] font-bold text-rose-400 uppercase mb-1">Histórico</span>
                    <div className="font-black text-slate-800 uppercase text-sm">{oldName}</div>
                    </div>
                    <div className="flex-1 w-full">
                        <Autocomplete 
                            options={proGroups.map(g => ({ value: g.name, label: `${g.id} - ${g.name}`, subLabel: g.unit }))}
                            value={targetMap[oldName] || ''}
                            onChange={(val) => setTargetMap(prev => ({...prev, [oldName]: val}))}
                            placeholder="Selecione o PG Oficial..."
                            className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs focus:border-blue-500 outline-none"
                        />
                    </div>
                    <button 
                        onClick={() => handleMigratePG(oldName)}
                        disabled={!targetMap[oldName] || isProcessing}
                        className="px-4 py-3 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-md"
                    >
                        Migrar
                    </button>
                </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* --- TAB: MASTERLIST IMPORT --- */}
      {activeTab === 'masterlist' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Importar Colaboradores "Avulsos"</h3>
                <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{selectedStaff.size} Selecionados</span>
            </div>
            <div className="flex gap-4 items-end">
                <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Setor Padrão para Importação</label>
                    <Autocomplete 
                        options={proSectors.map(s => ({ value: s.name, label: `${s.id} - ${s.name}` }))}
                        value={defaultImportSector}
                        onChange={setDefaultImportSector}
                        placeholder="Ex: Geral / Sem Setor..."
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                    />
                </div>
                <button onClick={toggleSelectAllStaff} className="px-4 py-3 bg-slate-200 text-slate-600 rounded-xl font-black text-[9px] uppercase hover:bg-slate-300">
                    {selectedStaff.size === masterListCandidates.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                </button>
                <button onClick={handleImportStaff} disabled={selectedStaff.size === 0 || isProcessing} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase hover:bg-blue-700 disabled:opacity-50 shadow-lg">
                    {isProcessing ? 'Importando...' : 'Converter para ProStaff'}
                </button>
            </div>
          </div>
          
          <div className="max-h-[50vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
            {masterListCandidates.map(cand => (
                <div key={cand.name} onClick={() => {
                    const newSet = new Set(selectedStaff);
                    if (newSet.has(cand.name)) newSet.delete(cand.name);
                    else newSet.add(cand.name);
                    setSelectedStaff(newSet);
                }} className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${selectedStaff.has(cand.name) ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-300'}`}>
                    <span className="font-bold text-xs text-slate-700 truncate">{cand.name}</span>
                    <span className="text-[8px] font-black uppercase text-slate-400 bg-white px-2 py-0.5 rounded border">{cand.unit}</span>
                </div>
            ))}
            {masterListCandidates.length === 0 && (
                <div className="col-span-3 text-center p-10 text-emerald-500 font-black uppercase text-xs">
                    <i className="fas fa-check-circle text-2xl mb-2 block"></i>
                    Todos os nomes da MasterList já estão no banco! (Ou recurso desativado)
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MigrationBridge;
