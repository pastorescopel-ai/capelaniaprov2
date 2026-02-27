
import React, { useState } from 'react';
import { Config, UserRole } from '../../types';

interface MuralProps {
  config: Config;
  userRole: UserRole;
  onUpdateConfig: (newConfig: Config) => void;
}

const Mural: React.FC<MuralProps> = ({ config, userRole, onUpdateConfig }) => {
  const [isEditingMural, setIsEditingMural] = useState(false);
  const [muralDraft, setMuralDraft] = useState(config?.muralText || "");

  const handleSaveMural = () => {
    onUpdateConfig({ ...config, muralText: muralDraft });
    setIsEditingMural(false);
  };

  return (
    <section className="bg-[#005a9c] p-6 rounded-[2rem] shadow-sm relative overflow-hidden border-none">
      <div className="relative z-10 flex items-start justify-between gap-4">
        {isEditingMural ? (
          <div className="space-y-3 w-full">
            <textarea 
              value={muralDraft} 
              onChange={e => setMuralDraft(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-white text-sm focus:ring-2 focus:ring-amber-400 outline-none placeholder-white/40"
              rows={2}
              placeholder="Escreva um comunicado..."
            />
            <div className="flex gap-2">
              <button onClick={handleSaveMural} className="px-6 py-2 bg-amber-400 text-slate-900 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-amber-300 transition-colors shadow-lg">
                Publicar
              </button>
              <button onClick={() => setIsEditingMural(false)} className="px-6 py-2 bg-white/20 text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-white/30 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-4">
            <div className="w-10 h-10 shrink-0 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <i className="fas fa-bullhorn text-amber-400"></i>
            </div>
            <p className="text-white leading-relaxed font-bold text-sm italic">
              "{config?.muralText || "Nenhum comunicado oficial registrado."}"
            </p>
          </div>
        )}
        
        {!isEditingMural && userRole === UserRole.ADMIN && (
          <button onClick={() => setIsEditingMural(true)} className="shrink-0 w-8 h-8 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-all flex items-center justify-center border border-white/20">
            <i className="fas fa-edit text-[10px]"></i>
          </button>
        )}
      </div>
    </section>
  );
};

export default Mural;
