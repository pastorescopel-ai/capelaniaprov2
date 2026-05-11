import React, { useRef } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Unit } from '../../types';
import * as XLSX from 'xlsx';

interface ImportTabProps {
  currentUnit: Unit;
  importPreview: any[];
  setImportPreview: (data: any[]) => void;
  processImport: (onSuccess: () => void, cycleMonth: string) => void;
  isLoading: boolean;
  onSuccess: () => void;
  selectedMonth: string;
}

const ImportTab: React.FC<ImportTabProps> = ({
  currentUnit,
  importPreview,
  setImportPreview,
  processImport,
  isLoading,
  onSuccess,
  selectedMonth
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetMonth, setTargetMonth] = React.useState(selectedMonth);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setImportPreview(data);
    };
    reader.readAsBinaryString(file);
  };

  const formatMonthLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="mb-8">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Upload size={40} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Importar Dados ({currentUnit})</h3>
          <p className="text-slate-500 mt-2 font-medium">Carregue a planilha do Google Forms (.xlsx ou .csv)</p>
        </div>

        <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} ref={fileInputRef} className="hidden" />

        {!importPreview.length ? (
          <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl hover:shadow-blue-200 hover:-translate-y-1 flex items-center gap-3 mx-auto">
            <Upload size={18} /> Selecionar Arquivo
          </button>
        ) : (
          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 text-left">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-black text-slate-700 uppercase tracking-tight">Pré-visualização</h4>
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{importPreview.length} linhas</span>
            </div>
            
            {/* Seletor de Mês de Destino */}
            <div className="mb-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mês de Referência (Competência)</label>
              <div className="flex items-center gap-3">
                <input 
                  type="month" 
                  value={targetMonth.substring(0, 7)} 
                  onChange={(e) => setTargetMonth(e.target.value + '-01')}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-4 py-3 rounded-xl border border-blue-100">
                  {formatMonthLabel(targetMonth)}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 italic">* O BI usará este mês para agrupar os dados nos relatórios.</p>
            </div>

            <div className="max-h-40 overflow-y-auto text-xs font-mono text-slate-500 mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-inner">
              <pre>{JSON.stringify(importPreview[0], null, 2)}</pre>
              <p className="mt-2 text-center italic opacity-50">... e mais {importPreview.length - 1} linhas</p>
            </div>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setImportPreview([])} className="px-6 py-3 text-slate-500 hover:bg-slate-200 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors">Cancelar</button>
              <button onClick={() => processImport(onSuccess, targetMonth)} disabled={isLoading} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-wider text-xs transition-colors shadow-lg flex items-center gap-2">
                {isLoading ? 'Processando...' : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        )}
        
        <div className="mt-12 text-left bg-amber-50 p-6 rounded-2xl border border-amber-100">
          <h5 className="font-black text-amber-800 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
            <AlertCircle size={14} /> Regras de Importação
          </h5>
          <ul className="text-xs text-amber-700 space-y-2 list-disc pl-4 font-medium">
            <li>Colunas obrigatórias: <strong>Matricula, Nome, Id_setor, Setor</strong>.</li>
            <li>O sistema permite a mesma matrícula em meses diferentes, mas não no mesmo mês.</li>
            <li>Os dados serão salvos com a data de competência selecionada acima.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ImportTab;
