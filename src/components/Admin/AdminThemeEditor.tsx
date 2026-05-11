import React from 'react';
import { Config } from '../../types';

interface AdminThemeEditorProps {
  config: Config;
  setConfig: (c: Config) => void;
}

const colorPresets = [
  { label: 'Azul Original', value: '#005a9c' },
  { label: 'Verde Saúde', value: '#10b981' },
  { label: 'Vinho Pastoral', value: '#991b1b' },
  { label: 'Azul Escuro', value: '#1e293b' },
  { label: 'Roxo Espiritual', value: '#6366f1' },
  { label: 'Verde Petróleo', value: '#0d9488' },
];

export const AdminThemeEditor: React.FC<AdminThemeEditorProps> = ({ config, setConfig }) => {
  return (
    <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 lg:col-span-2">
      <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">Temas</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {colorPresets.map(cp => (
          <button 
            key={cp.value} 
            onClick={() => setConfig({...config, primaryColor: cp.value})} 
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${config.primaryColor === cp.value ? 'border-slate-800 bg-slate-50' : 'border-slate-100 hover:border-slate-200'}`}
          >
            <div className="w-6 h-6 rounded-lg shadow-sm" style={{ backgroundColor: cp.value }}></div>
            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-600">{cp.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default AdminThemeEditor;
