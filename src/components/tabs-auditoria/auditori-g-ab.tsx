
import React, { useState } from 'react';
import { ProGroup } from '../../types';

interface HealerPGsTabProps {
  duplicatePGs: { name: string, unit: string, groups: ProGroup[] }[];
  handleMergePGs: (sourceId: string, targetId: string) => Promise<void>;
  isProcessing: boolean;
}

const HealerPGsTab: React.FC<HealerPGsTabProps> = ({ duplicatePGs, handleMergePGs, isProcessing }) => {
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});

  if (duplicatePGs.length === 0) {
    return (
      <div className="p-20 text-center space-y-4 bg-white rounded-[3rem] shadow-sm border border-slate-100">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-3xl mx-auto">
          <i className="fas fa-check-circle"></i>
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Nenhum PG Duplicado</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Sua estrutura de grupos está organizada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {duplicatePGs.map((dup, idx) => (
          <div key={idx} className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-lg">
                  <i className="fas fa-users-rectangle"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight truncate">{dup.name}</h3>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unidade {dup.unit}</span>
                </div>
              </div>
              <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase">
                {dup.groups.length} Cadastros Detectados
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecione o cadastro que deve ser MANTIDO (Principal):</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dup.groups.map(group => (
                    <label 
                      key={group.id} 
                      className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${selectedTargets[dup.name] === group.id ? 'border-amber-500 bg-amber-50 ring-4 ring-amber-100' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                    >
                      <input 
                        type="radio" 
                        name={`target-${dup.name}`} 
                        value={group.id} 
                        checked={selectedTargets[dup.name] === group.id}
                        onChange={() => setSelectedTargets(prev => ({ ...prev, [dup.name]: group.id }))}
                        className="hidden"
                      />
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedTargets[dup.name] === group.id ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200'}`}>
                        {selectedTargets[dup.name] === group.id && <i className="fas fa-check text-[10px]"></i>}
                      </div>
                      <div className="flex-1">
                        <div className="font-black text-slate-800 text-xs uppercase">{group.id}</div>
                        <div className="text-[10px] font-bold text-slate-500">Líder: {group.currentLeader || 'N/A'}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {selectedTargets[dup.name] && (
                <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-amber-600">
                    <i className="fas fa-info-circle"></i>
                    <p className="text-[10px] font-bold uppercase leading-tight">
                      Os dados históricos dos outros cadastros serão movidos para o ID <span className="font-black">{selectedTargets[dup.name]}</span>.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {dup.groups.filter(g => g.id !== selectedTargets[dup.name]).map(sourceGroup => (
                      <button
                        key={sourceGroup.id}
                        onClick={() => handleMergePGs(sourceGroup.id, selectedTargets[dup.name])}
                        disabled={isProcessing}
                        className="px-6 py-3 bg-amber-500 text-white rounded-xl font-black text-[9px] uppercase hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 flex items-center gap-2 disabled:opacity-50"
                      >
                        <i className={`fas ${isProcessing ? 'fa-sync fa-spin' : 'fa-compress-arrows-alt'}`}></i>
                        Fundir ID {sourceGroup.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HealerPGsTab;
