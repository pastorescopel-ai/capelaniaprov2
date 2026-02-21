
import React, { useRef, useState, useMemo } from 'react';
import { useToast } from '../../contexts/ToastContext';
import PGMaestro from './PGMaestro';
import { ProStaff, ProSector, ProGroup, Unit } from '../../types';
import SyncModal, { SyncStatus } from '../Shared/SyncModal';
import Autocomplete from '../Shared/Autocomplete';
import { cleanID, normalizeString } from '../../utils/formatters';
import { useExcelProcessor, ProcessedRow } from '../../hooks/useExcelProcessor';

interface AdminListsProps {
  proData?: { staff: ProStaff[]; sectors: ProSector[]; groups: ProGroup[] };
  onSavePro?: (staff: ProStaff[], sectors: ProSector[], groups: ProGroup[]) => Promise<boolean>;
}

const AdminLists: React.FC<AdminListsProps> = ({ proData, onSavePro }) => {
  const { showToast } = useToast();
  const { processExcelFile, isProcessing: isReadingFile } = useExcelProcessor();
  
  const [activeTab, setActiveTab] = useState<'staff' | 'sectors' | 'pgs'>('staff');
  const [activeUnit, setActiveUnit] = useState<Unit>(Unit.HAB);
  const [syncState, setSyncState] = useState<{isOpen: boolean; status: SyncStatus; title: string; message: string; error?: string;}>({ isOpen: false, status: 'idle', title: '', message: '' });
  
  const [previewData, setPreviewData] = useState<ProcessedRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20; 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sectorOptions = useMemo(() => {
      if (!proData) return [];
      return proData.sectors.filter(s => s.unit === activeUnit).map(s => ({ value: s.name, label: `${s.id} - ${s.name}`, subLabel: s.name, category: 'RH' as const }));
  }, [proData, activeUnit]);

  const handleProcessFile = async (file: File) => {
      try {
          const results = await processExcelFile(file, activeTab, activeUnit, proData);
          setPreviewData(results);
          setCurrentPage(1);
          showToast(`${results.length} registros válidos lidos.`, "success");
      } catch (e: any) {
          showToast(e.message, "warning");
      } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const handleConfirmImport = async () => {
    if (!proData || !onSavePro) return;
    setSyncState({ isOpen: true, status: 'processing', title: 'Sincronizando', message: 'Calculando diferenças e salvando...' });
    
    try {
        let stats = { updated: 0, deactivated: 0, new: 0 };
        const mergeData = (currentDB: any[], incomingList: ProcessedRow[], type: 'staff'|'sector'|'pg') => {
            const map = new Map<string, any>();
            currentDB.forEach(item => { const key = cleanID(item.id); map.set(key, item); });

            incomingList.forEach(incoming => {
                const key = incoming.id; 
                const existing = map.get(key);
                if (existing) {
                    if (existing.unit === activeUnit) {
                        const updated = { ...existing, name: incoming.name, active: true, updatedAt: Date.now() };
                        if (type === 'staff') updated.sectorId = incoming.sectorIdLinked || existing.sectorId || "";
                        map.set(key, updated);
                        stats.updated++;
                    } 
                } else {
                    const newItem: any = { id: key, name: incoming.name, unit: activeUnit, active: true, updatedAt: Date.now() };
                    if (type === 'staff') newItem.sectorId = incoming.sectorIdLinked || "";
                    map.set(key, newItem);
                    stats.new++;
                }
            });

            const incomingKeys = new Set(incomingList.map(i => i.id));
            const resultList: any[] = [];
            map.forEach((value, key) => {
                if (value.unit === activeUnit) {
                    if (!incomingKeys.has(key)) {
                        if (value.active !== false) { value.active = false; value.updatedAt = Date.now(); stats.deactivated++; }
                    }
                }
                resultList.push(value);
            });
            return resultList;
        };

        if (activeTab === 'staff') {
            const finalStaff = mergeData(proData.staff, previewData, 'staff');
            await onSavePro(finalStaff, proData.sectors, proData.groups);
        } else if (activeTab === 'sectors') {
            const finalSectors = mergeData(proData.sectors, previewData, 'sector');
            await onSavePro(proData.staff, finalSectors, proData.groups);
        } else if (activeTab === 'pgs') {
            const finalGroups = mergeData(proData.groups, previewData, 'pg');
            await onSavePro(proData.staff, proData.sectors, finalGroups);
        }

        setSyncState({ isOpen: true, status: 'success', title: 'Sincronização Blindada', message: `Sucesso!\n\nNovos/Atualizados: ${stats.updated + stats.new}\nRemovidos da lista (Inativos): ${stats.deactivated}` });
        setPreviewData([]); 
    } catch (e: any) {
        setSyncState({ isOpen: true, status: 'error', title: 'Erro ao Salvar', message: "Falha na sincronização.", error: e.message });
    }
  };

  const handleManualSectorChange = (index: number, val: string) => {
      const realIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
      const newData = [...previewData];
      const item = newData[realIndex];
      const labelParts = val.split(' - ');
      const searchName = labelParts.length > 1 ? labelParts[1] : val;
      const searchId = labelParts.length > 1 ? labelParts[0] : '';

      let matchedSector = null;
      if (searchId) matchedSector = proData?.sectors.find(s => cleanID(s.id) === cleanID(searchId) && s.unit === activeUnit);
      if (!matchedSector) matchedSector = proData?.sectors.find(s => s.name === searchName && s.unit === activeUnit);

      if (matchedSector) {
          item.sectorIdLinked = matchedSector.id;
          item.linkedSectorName = matchedSector.name;
          item.sectorStatus = 'ok'; 
      } else {
          item.sectorIdLinked = null;
          item.linkedSectorName = undefined;
          item.sectorStatus = 'error'; 
      }
      item.sectorNameRaw = val; 
      setPreviewData(newData);
  };

  const displayData = useMemo(() => {
      let source: any[] = [];
      if (previewData.length > 0) return previewData;
      if (proData) {
          if (activeTab === 'staff') source = proData.staff.filter(s => s.unit === activeUnit && s.active !== false);
          else if (activeTab === 'sectors') source = proData.sectors.filter(s => s.unit === activeUnit && s.active !== false);
          else source = proData.groups.filter(s => s.unit === activeUnit && s.active !== false);
      }
      return source.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [previewData, proData, activeTab, activeUnit]);

  const totalPages = Math.ceil(displayData.length / ITEMS_PER_PAGE);
  const currentItems = displayData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const getSectorNameFromDB = (sectorId: string) => { const s = proData?.sectors.find(sec => sec.id === sectorId); return s ? s.name : sectorId; };

  const instructions = {
      staff: { icon: 'fa-user-md', title: 'Importação de Colaboradores', fields: "Obrigatório: 'Matrícula' (ou ID/Crachá) e 'Nome'.", optional: "Opcional: 'Setor', 'Departamento'.", warn: "A planilha NÃO deve conter colunas de PGs." },
      sectors: { icon: 'fa-map-marker-alt', title: 'Importação de Setores', fields: "Obrigatório: 'ID' e 'Nome Setor' (ou Departamento).", optional: "", warn: "Proibido: Colunas de Funcionários (Matrícula) ou PGs." },
      pgs: { icon: 'fa-users', title: 'Importação de Pequenos Grupos', fields: "Obrigatório: Apenas ID e Nome do PG (ou Grupo).", optional: "Líder é opcional.", warn: "Proibido: Colunas de Funcionários ou Setores." }
  };
  const currentInst = instructions[activeTab];

  return (
    <div className="space-y-12">
      <SyncModal isOpen={syncState.isOpen} status={syncState.status} title={syncState.title} message={syncState.message} errorDetails={syncState.error} onClose={() => setSyncState(prev => ({ ...prev, isOpen: false }))} />
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Importação Excel (Modo Blindado)</h2>
          <div className="flex bg-slate-50 p-1.5 rounded-xl gap-2">
             {['HAB', 'HABA'].map(u => (<button key={u} onClick={() => { setActiveUnit(u as any); setPreviewData([]); setCurrentPage(1); }} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeUnit === u ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>Unidade {u}</button>))}
          </div>
        </div>
        <div className="flex gap-4 border-b overflow-x-auto no-scrollbar">
            {[ {id:'sectors', l:'1. Setores', i:'fa-map-marker-alt'}, {id:'staff', l:'2. Colaboradores', i:'fa-user-md'}, {id:'pgs', l:'3. PGs', i:'fa-users'} ].map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setPreviewData([]); setCurrentPage(1); }} className={`pb-4 px-4 text-xs font-black uppercase flex items-center gap-2 border-b-4 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-300'}`}><i className={`fas ${tab.i}`}></i> {tab.l}</button>
            ))}
        </div>

        <div className={`p-6 rounded-2xl border-l-4 flex gap-4 items-start ${activeTab === 'pgs' ? 'bg-amber-50 border-amber-400 text-amber-900' : 'bg-blue-50 border-blue-400 text-blue-900'}`}>
            <div className="mt-1"><i className={`fas ${currentInst.icon} text-xl`}></i></div>
            <div className="space-y-1">
                <h4 className="font-black uppercase text-xs tracking-widest">{currentInst.title}</h4>
                <p className="text-[10px] font-bold">{currentInst.fields} {currentInst.optional}</p>
                <p className="text-[10px] font-black uppercase opacity-70"><i className="fas fa-exclamation-triangle mr-1"></i> {currentInst.warn}</p>
            </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <input type="file" ref={fileInputRef} accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleProcessFile(e.target.files[0])} />
                <button onClick={() => fileInputRef.current?.click()} disabled={isReadingFile} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg hover:bg-black transition-all"><i className={`fas ${isReadingFile ? 'fa-spinner fa-spin' : 'fa-file-excel'}`}></i> {isReadingFile ? 'Lendo...' : 'Carregar Planilha'}</button>
                <div className="text-xs font-bold text-slate-400">{previewData.length > 0 ? <span className="text-blue-600">{previewData.length} registros lidos.</span> : <span>Banco Atual: {displayData.length} ativos</span>}</div>
            </div>
            {previewData.length > 0 && (<button onClick={handleConfirmImport} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center gap-2"><i className="fas fa-sync"></i> Sincronizar Banco</button>)}
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead><tr className="text-[9px] font-black uppercase text-slate-400 border-b"><th className="p-4">ID (Limpo)</th><th className="p-4">Nome</th>{activeTab === 'staff' && <th className="p-4">Vínculo de Setor</th>}{activeTab !== 'staff' && <th className="p-4">Unidade</th>}</tr></thead>
                <tbody className="divide-y">{currentItems.map((item, i) => (
                    <tr key={i} className={`hover:bg-slate-50 transition-colors ${item.sectorStatus === 'error' ? 'bg-amber-50' : ''}`}>
                        <td className="p-4 text-xs font-mono font-bold text-blue-600">{item.id}</td><td className="p-4 text-sm font-bold text-slate-700">{item.name}</td>
                        {activeTab === 'staff' && (<td className="p-4">{previewData.length > 0 ? (item.sectorStatus === 'ok' ? (<div className="flex items-center justify-between group"><div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]"><i className="fas fa-check"></i></div><div><span className="text-[10px] font-black text-slate-700 uppercase block">{item.linkedSectorName}</span>{item.sectorNameRaw && item.sectorNameRaw !== item.linkedSectorName && (<span className="text-[8px] text-slate-400 block strike">Excel: {item.sectorNameRaw}</span>)}</div></div><button onClick={() => handleManualSectorChange(i, '')} className="w-6 h-6 rounded-lg bg-slate-50 text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"><i className="fas fa-pencil-alt text-[10px]"></i></button></div>) : (<div className="space-y-1"><Autocomplete options={sectorOptions} value={item.sectorNameRaw || ''} onChange={(val) => handleManualSectorChange(i, val)} placeholder="⚠️ Vincular Setor..." required={false} className="w-full p-2 text-xs font-bold rounded-xl border-2 border-amber-300 bg-white" /><span className="text-[8px] font-bold text-rose-400">ID Excel: {item.sectorIdRaw || 'N/A'}</span></div>)) : (<span className="text-[10px] font-bold uppercase text-slate-500">{getSectorNameFromDB(item.sectorId)}</span>)}</td>)}
                        {activeTab !== 'staff' && <td className="p-4 text-xs font-bold text-slate-400">{item.unit}</td>}
                    </tr>
                ))}</tbody>
            </table>
        </div>
        {totalPages > 1 && (<div className="flex items-center justify-center gap-2 pt-6"><button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600"><i className="fas fa-chevron-left"></i></button><button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600"><i className="fas fa-chevron-right"></i></button></div>)}
      </section>
      <PGMaestro proData={proData} />
    </div>
  );
};

export default AdminLists;
