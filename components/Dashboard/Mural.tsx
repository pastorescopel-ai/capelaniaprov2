
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
    <section className="bg-[#005a9c] p-8 rounded-[2.5rem] shadow-lg relative overflow-hidden border-none">
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-black text-sm uppercase tracking-[0.2em] flex items-center gap-2">
            <i className="fas fa-bullhorn text-amber-400"></i> Mural de Avisos
          </h3>
          {userRole === UserRole.ADMIN && (
            <button onClick={() => setIsEditingMural(!isEditingMural)} className="w-8 h-8 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-all flex items-center justify-center border border-white/20">
              <i className={`fas ${isEditingMural ? 'fa-times' : 'fa-edit'} text-[10px]`}></i>
            </button>
          )}
        </div>
        
        {isEditingMural ? (
          <div className="space-y-3">
            <textarea 
              value={muralDraft} 
              onChange={e => setMuralDraft(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-white text-sm focus:ring-2 focus:ring-amber-400 outline-none placeholder-white/40"
              rows={3}
              placeholder="Escreva um comunicado..."
            />
            <button onClick={handleSaveMural} className="px-6 py-2 bg-amber-400 text-slate-900 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-amber-300 transition-colors shadow-lg">
              Publicar
            </button>
          </div>
        ) : (
          <p className="text-white leading-relaxed font-bold text-base italic">
            "{config?.muralText || "Nenhum comunicado oficial registrado."}"
          </p>
        )}
      </div>
    </section>
  );
};

export default Mural;
