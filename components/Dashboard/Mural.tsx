
import React, { useState } from 'react';
import { Config, UserRole } from '../../types';
import Button from '../Shared/Button';
import { useToast } from '../../contexts/ToastContext';

interface MuralProps {
  config: Config;
  userRole: UserRole;
  onUpdateConfig: (newConfig: Config) => void;
}

const Mural: React.FC<MuralProps> = ({ config, userRole, onUpdateConfig }) => {
  const { showToast } = useToast();
  const [isEditingMural, setIsEditingMural] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [muralDraft, setMuralDraft] = useState(config?.muralText || "");

  const handleSaveMural = async () => {
    setIsSaving(true);
    try {
      await onUpdateConfig({ ...config, muralText: muralDraft });
      setIsEditingMural(false);
      showToast("Mural atualizado com sucesso!", "success");
    } catch (e) {
      showToast("Erro ao atualizar mural.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-[#005a9c] p-4 md:p-5 rounded-3xl shadow-sm relative overflow-hidden border-none">
      <div className="relative z-10 flex items-start justify-between gap-4">
        {isEditingMural ? (
          <div className="space-y-3 w-full">
            <textarea 
              value={muralDraft} 
              onChange={e => setMuralDraft(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-2xl p-3 text-white focus:ring-2 focus:ring-amber-400/50 outline-none placeholder-white/40 transition-all"
              rows={2}
              placeholder="Escreva um comunicado..."
            />
            <div className="flex gap-2">
              <Button 
                onClick={handleSaveMural} 
                isLoading={isSaving}
                className="px-5 py-2 bg-amber-400 text-slate-900 shadow-amber-400/20"
              >
                Publicar
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setIsEditingMural(false)} 
                className="px-5 py-2 bg-white/20 text-white hover:bg-white/30"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-3">
            <div className="w-8 h-8 shrink-0 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
              <i className="fas fa-bullhorn text-amber-400 text-xs"></i>
            </div>
            <p className="text-white leading-relaxed font-medium text-sm">
              {config?.muralText || "Nenhum aviso no momento."}
            </p>
          </div>
        )}
        
        {!isEditingMural && userRole === UserRole.ADMIN && (
          <button onClick={() => setIsEditingMural(true)} className="shrink-0 w-8 h-8 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center border border-white/10">
            <i className="fas fa-edit text-[10px]"></i>
          </button>
        )}
      </div>
    </section>
  );
};

export default Mural;
