import React, { useRef } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Unit } from '../../types';
import * as XLSX from 'xlsx';

interface ImportTabProps {
  currentUnit: Unit;
  importPreview: any[];
  setImportPreview: (data: any[]) => void;
  processImport: (onSuccess: () => void) => void;
  isLoading: boolean;
  onSuccess: () => void;
}

const ImportTab: React.FC<ImportTabProps> = ({
  currentUnit,
  importPreview,
  setImportPreview,
  processImport,
  isLoading,
  onSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            <div className="max-h-60 overflow-y-auto text-xs font-mono text-slate-500 mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-inner">
              <pre>{JSON.stringify(importPreview[0], null, 2)}</pre>
              <p className="mt-2 text-center italic opacity-50">... e mais {importPreview.length - 1} linhas</p>
            </div>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setImportPreview([])} className="px-6 py-3 text-slate-500 hover:bg-slate-200 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors">Cancelar</button>
              <button onClick={() => processImport(onSuccess)} disabled={isLoading} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-wider text-xs transition-colors shadow-lg flex items-center gap-2">
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
            <li>Colunas obrigatórias: <strong>Data, Matricula, Nome, Id_setor, Setor</strong>.</li>
            <li>O sistema atualizará automaticamente registros existentes com a mesma matrícula.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ImportTab;
