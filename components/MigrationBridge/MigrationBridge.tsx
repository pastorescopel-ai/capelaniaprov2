
import React, { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { normalizeString } from '../../utils/formatters';
import { Unit, ProStaff } from '../../types';
import Autocomplete from '../Shared/Autocomplete';

type MigrationTab = 'sectors' | 'pgs' | 'students' | 'masterlist';

const MigrationBridge: React.FC = () => {
  const { 
    bibleStudies, bibleClasses, smallGroups, staffVisits, visitRequests,
    proSectors, proGroups, proStaff, 
    // masterLists removed
    executeSectorMigration, executePGMigration, unifyStudentIdentity, saveRecord 
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
        if (item.sector && item.sector.trim()) historySet.add(item.sector.trim());
      });
    });
    const officialSet = new Set(proSectors.map(s => s.name.trim()));
    return Array.from(historySet).filter(h => !officialSet.has(h)).sort();
  }, [bibleStudies, bibleClasses, smallGroups, staffVisits, proSectors]);

  // --- 2. LÓGICA DE DETECÇÃO DE ÓRFÃOS (PGs) ---
  const pgOrphans = useMemo(() => {
    const historySet = new Set<string>();
    smallGroups.forEach(g => { if(g.groupName) historySet.add(g.groupName.trim()); });
    visitRequests.forEach(r => { if(r.pgName) historySet.add(r.pgName.trim()); });
    const officialSet = new Set(proGroups.map(g => g.name.trim()));
    return Array.from(historySet).filter(h => !officialSet.has(h)).sort();
  }, [smallGroups, visitRequests, proGroups]);

  // --- 3. LÓGICA DE DETECÇÃO DE ÓRFÃOS (ALUNOS) ---
  const studentOrphans = useMemo(() => {
    const orphanSet = new Set<string>();
    const officialNamesNormalized = new Set(proStaff.map(s => normalizeString(s.name)));
    
    // Varre todas as classes para encontrar nomes que não estão no RH
    bibleClasses.forEach(cls => {
        if (cls.students && Array.isArray(cls.students)) {
            cls.students.forEach(studentName => {
                const cleanName = studentName.split(' (')[0].trim(); // Remove matrícula se houver
                const norm = normalizeString(cleanName);
                
                // Se o nome não está na lista oficial E não tem formato de matrícula válido
                if (!officialNamesNormalized.has(norm) && !studentName.match(/\(\d+\)$/)) {
                    orphanSet.add(cleanName);
                }
            });
        }
    });
    
    return Array.from(orphanSet).sort();
  }, [bibleClasses, proStaff]);

  // --- 4. LÓGICA DE IMPORTAÇÃO (MasterList -> ProStaff) ---
  const masterListCandidates: {name: string, unit: Unit}[] = [];

  // --- AÇÕES ---

  const handleMigrateSector = async (oldName: string) => {
    const newName = targetMap[oldName];
    if (!newName) return;
    setIsProcessing(true);
    try {
      const result = await executeSectorMigration(oldName, newName);
      showToast(result, "success");
      setTargetMap(prev => { const n = {...prev}; delete n[oldName]; return n; });
    } catch (e: any) { showToast("Erro: " + e.message, "warning"); } 
    finally { setIsProcessing(false); }
  };

  const handleMigratePG = async (oldName: string) => {
    const newName = targetMap[oldName];
    if (!newName) return;
    setIsProcessing(true);
    try {
      const result = await executePGMigration(oldName, newName);
      showToast(result, "success");
      setTargetMap(prev => { const n = {...prev}; delete n[oldName]; return n; });
    } catch (e: any) { showToast("Erro: " + e.message, "warning"); } 
    finally { setIsProcessing(false); }
  };

  const handleUnifyStudent = async (oldName: string) => {
      const targetLabel = targetMap[oldName]; // "Nome (1234)"
      if (!targetLabel) return;
      
      const targetId = targetLabel.match(/\((\d+)\)$/)?.[1]; // Extrai ID "1234"
      if (!targetId) {
          showToast("Selecione um colaborador com matrícula válida.", "warning");
          return;
      }

      setIsProcessing(true);
      try {
          const result = await unifyStudentIdentity(oldName, targetId);
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
    const targetSectorId = defaultImportSector ? proSectors.find(s => s.name === defaultImportSector)?.id : "";
    setIsProcessing(true);
    try {
      const newStaff: ProStaff[] = [];
      masterListCandidates.forEach(cand => {
        if (selectedStaff.has(cand.name)) {
          newStaff.push({
            id: crypto.randomUUID(), name: cand.name, unit: cand.unit, sectorId: targetSectorId || "", active: true, updatedAt: Date.now()
          });
        }
      });
      await saveRecord('proStaff', newStaff);
      showToast(`${newStaff.length} colaboradores importados com sucesso!`, "success");
      setSelectedStaff(new Set());
    } catch (e) { showToast("Erro na importação.", "warning"); } 
    finally { setIsProcessing(false); }
  };

  const toggleSelectAllStaff = () => {
    if (selectedStaff.size === masterListCandidates.length) setSelectedStaff(new Set());
    else setSelectedStaff(new Set(masterListCandidates.map(c => c.name)));
  };

  const officialStaffOptions = useMemo(() => {
      return proStaff.map(s => {
          const idStr = String(s.id).replace(/\D/g, '');
          return {
              value: s.id, // Valor interno não importa tanto aqui pois usamos o label no onSelect
              label: `${s.name} (${idStr})`,
              subLabel: proSectors.find(sec => sec.id === s.sectorId)?.name || 'Sem Setor'
          };
      });
  }, [proStaff, proSectors]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32">
      <div className="bg-amber-50 border-l-8 border-amber-400 p-6 rounded-r-2xl shadow-sm">
        <h2 className="text-2xl font-black text-amber-900 uppercase tracking-tighter flex items-center gap-3">
          <i className="fas fa-random"></i> Ponte de Migração
        </h2>
        <p className="text-amber-800 text-xs font-bold mt-2 uppercase tracking-widest leading-relaxed">
          Ferramenta para consolidar dados históricos com a nova estrutura. Use com cautela.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        <button onClick={() => setActiveTab('sectors')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'sectors' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>Setores ({sectorOrphans.length})</button>
        <button onClick={() => setActiveTab('pgs')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'pgs' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>PGs ({pgOrphans.length})</button>
        <button onClick={() => setActiveTab('students')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'students' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>Alunos Órfãos ({studentOrphans.length})</button>
        <button onClick={() => setActiveTab('masterlist')} className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'masterlist' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>Importar MasterList</button>
      </div>

      {/* --- TAB: SETORES --- */}
      {activeTab === 'sectors' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Mapeamento de Setores</h3>
            <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{sectorOrphans.length} Pendentes</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {sectorOrphans.length === 0 ? <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs">Todos os setores históricos estão vinculados!</div> : sectorOrphans.map(oldName => (
                <div key={oldName} className="p-4 flex flex-col md:flex-row items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 w-full"><span className="block text-[9px] font-bold text-rose-400 uppercase mb-1">Histórico</span><div className="font-black text-slate-800 uppercase text-sm">{oldName}</div></div>
                    <div className="flex-1 w-full"><Autocomplete options={proSectors.map(s => ({ value: s.name, label: `${s.id} - ${s.name}`, subLabel: s.unit }))} value={targetMap[oldName] || ''} onChange={(val) => setTargetMap(prev => ({...prev, [oldName]: val}))} placeholder="Selecione o Setor Oficial..." className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs focus:border-blue-500 outline-none" /></div>
                    <button onClick={() => handleMigrateSector(oldName)} disabled={!targetMap[oldName] || isProcessing} className="px-4 py-3 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-md">{isProcessing ? '...' : 'Migrar'}</button>
                </div>
            ))}
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
            {pgOrphans.length === 0 ? <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs">Todos os PGs históricos estão vinculados!</div> : pgOrphans.map(oldName => (
                <div key={oldName} className="p-4 flex flex-col md:flex-row items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 w-full"><span className="block text-[9px] font-bold text-rose-400 uppercase mb-1">Histórico</span><div className="font-black text-slate-800 uppercase text-sm">{oldName}</div></div>
                    <div className="flex-1 w-full"><Autocomplete options={proGroups.map(g => ({ value: g.name, label: `${g.id} - ${g.name}`, subLabel: g.unit }))} value={targetMap[oldName] || ''} onChange={(val) => setTargetMap(prev => ({...prev, [oldName]: val}))} placeholder="Selecione o PG Oficial..." className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs focus:border-blue-500 outline-none" /></div>
                    <button onClick={() => handleMigratePG(oldName)} disabled={!targetMap[oldName] || isProcessing} className="px-4 py-3 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-md">Migrar</button>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB: ALUNOS ÓRFÃOS --- */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div>
                <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Unificação de Alunos</h3>
                <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Vincule nomes antigos ao cadastro de RH atual</p>
            </div>
            <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{studentOrphans.length} Pendentes</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {studentOrphans.length === 0 ? <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs">Todos os alunos estão corretamente vinculados!</div> : studentOrphans.map(oldName => (
                <div key={oldName} className="p-4 flex flex-col md:flex-row items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 w-full">
                        <span className="block text-[9px] font-bold text-rose-400 uppercase mb-1">Nome no Histórico</span>
                        <div className="font-black text-slate-800 uppercase text-sm">{oldName}</div>
                    </div>
                    <div className="flex-1 w-full">
                        <Autocomplete 
                            options={officialStaffOptions}
                            value={targetMap[oldName] || ''}
                            // Aqui o Autocomplete retorna o 'value' mas o onSelectOption dá o label
                            onChange={(val) => {}} // Não usado diretamente pois queremos o onSelect
                            onSelectOption={(label) => setTargetMap(prev => ({...prev, [oldName]: label}))}
                            placeholder="Buscar Colaborador no RH..."
                            className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xs focus:border-blue-500 outline-none"
                        />
                        {targetMap[oldName] && <div className="mt-1 text-[9px] font-black text-blue-600 uppercase">Selecionado: {targetMap[oldName]}</div>}
                    </div>
                    <button 
                        onClick={() => handleUnifyStudent(oldName)}
                        disabled={!targetMap[oldName] || isProcessing}
                        className="px-4 py-3 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-md whitespace-nowrap"
                    >
                        Unificar Histórico
                    </button>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB: MASTERLIST IMPORT (Placeholder mantido para não quebrar UI se necessário) --- */}
      {activeTab === 'masterlist' && (
        <div className="p-10 text-center text-slate-400 font-bold uppercase text-xs bg-white rounded-[2.5rem] shadow-sm">
            Módulo MasterList desativado na versão ProDB. Use a importação via Excel no Admin.
        </div>
      )}
    </div>
  );
};

export default MigrationBridge;
