import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../../contexts/ToastContext';
import PGMaestro from './PGMaestro';

interface AdminListsProps {
  lists: {
    sectorsHAB: string; sectorsHABA: string;
    groupsHAB: string; groupsHABA: string;
    staffHAB: string; staffHABA: string;
  };
  setLists: React.Dispatch<React.SetStateAction<any>>;
  onAutoSave?: (updatedLists: any) => Promise<void>;
}

const AdminLists: React.FC<AdminListsProps> = ({ lists, setLists, onAutoSave }) => {
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRefHAB = useRef<HTMLInputElement>(null);
  const fileInputRefHABA = useRef<HTMLInputElement>(null);

  // Processamento de Planilha para Colaboradores e Setores
  const processFile = async (file: File, unit: 'HAB' | 'HABA') => {
    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (json.length < 2) {
          showToast("Arquivo vazio ou sem cabeçalho.", "warning");
          setIsProcessing(false);
          return;
        }

        const headers = json[0].map(h => String(h).toLowerCase());
        const colMap = {
          id: headers.findIndex(h => h.includes('matr') || h.includes('id') || h.includes('código')),
          name: headers.findIndex(h => h.includes('nome') || h.includes('colaborador') || h.includes('funcionário')),
          sector: headers.findIndex(h => h.includes('setor') || h.includes('centro') || h.includes('custo') || h.includes('departamento'))
        };

        if (colMap.name === -1) {
          showToast("Coluna 'Nome' não encontrada na planilha.", "warning");
          setIsProcessing(false);
          return;
        }

        const newStaffList: string[] = [];
        const newSectorList: Set<string> = new Set();
        
        const currentSectors = (unit === 'HAB' ? lists.sectorsHAB : lists.sectorsHABA).split('\n').filter(s => s.trim());
        currentSectors.forEach(s => newSectorList.add(s.trim()));

        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          const name = row[colMap.name];
          if (name) {
            const id = colMap.id > -1 ? row[colMap.id] : '';
            const sector = colMap.sector > -1 ? row[colMap.sector] : '';
            let formattedStaff = String(name).trim();
            if (id) formattedStaff = `${id} | ${formattedStaff}`;
            if (sector) formattedStaff = `${formattedStaff} | ${String(sector).trim()}`;
            newStaffList.push(formattedStaff);
            if (sector) {
              const cleanSector = String(sector).trim().replace(/[|]/g, '-');
              if (cleanSector.length > 2) newSectorList.add(cleanSector);
            }
          }
        }

        const staffKey = `staff${unit}`;
        const sectorKey = `sectors${unit}`;

        setLists((prev: any) => ({
          ...prev,
          [staffKey]: prev[staffKey] ? prev[staffKey] + '\n' + newStaffList.join('\n') : newStaffList.join('\n'),
          [sectorKey]: Array.from(newSectorList).sort().join('\n')
        }));

        showToast(`${newStaffList.length} colaboradores e setores importados!`, "success");
      } catch (err) {
        showToast("Erro ao processar planilha.", "warning");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-12">
      {/* SEÇÃO 1: RH E SETORES (IMPORTAÇÃO) */}
      <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
             <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tighter uppercase">Listas Mestres (RH & Setores)</h2>
             <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Base de dados para preenchimento de formulários</p>
          </div>
          <div className="bg-blue-50 px-4 py-2 rounded-xl text-[10px] text-blue-600 font-bold border border-blue-100">
            <i className="fas fa-info-circle mr-2"></i>
            Dica: Importe a planilha de RH para atualizar colaboradores e setores.
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {['HAB', 'HABA'].map(unit => (
            <div key={unit} className="space-y-6 relative">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                 <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm bg-slate-100 px-3 py-1 rounded-lg">Unidade {unit}</h3>
                 <div>
                   <input type="file" accept=".xlsx, .csv" className="hidden" ref={unit === 'HAB' ? fileInputRefHAB : fileInputRefHABA}
                     onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0], unit as 'HAB' | 'HABA'); e.target.value = ''; }}
                   />
                   <button onClick={() => unit === 'HAB' ? fileInputRefHAB.current?.click() : fileInputRefHABA.current?.click()}
                     disabled={isProcessing} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-100 shadow-sm"
                   >
                     <i className={`fas ${isProcessing ? 'fa-spinner fa-spin' : 'fa-file-excel'}`}></i> Importar RH
                   </button>
                 </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-2"><i className="fas fa-map-marker-alt"></i> Setores</label>
                <textarea value={(lists as any)[`sectors${unit}`]} onChange={e => setLists({...lists, [`sectors${unit}`]: e.target.value})} 
                  className="w-full h-32 p-4 bg-slate-50 rounded-2xl border-2 border-transparent font-bold text-xs resize-none outline-none focus:bg-white focus:border-blue-200 transition-all" 
                  placeholder="Ex: UTI Adulto&#10;Posto 1" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-2"><i className="fas fa-user-md"></i> Colaboradores (Matrícula | Nome | Setor)</label>
                <textarea value={(lists as any)[`staff${unit}`]} onChange={e => setLists({...lists, [`staff${unit}`]: e.target.value})} 
                  className="w-full h-48 p-4 bg-slate-50 rounded-2xl border-2 border-transparent font-bold text-xs resize-none outline-none focus:bg-white focus:border-blue-200 transition-all font-mono text-slate-600" 
                  placeholder="Ex: 1020 | João Silva | Manutenção" 
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SEÇÃO 2: MAESTRO DE PGS (VÍNCULOS) */}
      <PGMaestro lists={lists} setLists={setLists} onAutoSave={onAutoSave} />

      {/* BACKDOOR DE MANUTENÇÃO */}
      <details className="opacity-10 hover:opacity-100 transition-opacity">
        <summary className="text-[8px] font-black text-slate-400 cursor-pointer uppercase tracking-widest px-4">Modo Texto Bruto (Cuidado)</summary>
        <div className="grid grid-cols-2 gap-4 mt-2">
          {['HAB', 'HABA'].map(u => (
            <textarea key={u} value={(lists as any)[`groups${u}`]} onChange={e => setLists({...lists, [`groups${u}`]: e.target.value})} 
              className="w-full h-24 p-2 bg-slate-100 rounded-lg text-[8px] font-mono" />
          ))}
        </div>
      </details>
    </div>
  );
};

export default AdminLists;