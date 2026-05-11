import React from 'react';

interface ForceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  cltCount: number;
  providerCount: number;
}

const ForceSyncModal: React.FC<ForceSyncModalProps> = ({ isOpen, onClose, onConfirm, cltCount, providerCount }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose} />
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 text-center space-y-6 animate-in zoom-in duration-300 border-4 border-slate-100 relative z-10">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mx-auto">
          <i className="fas fa-sync-alt"></i>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Forçar Sincronização</h3>
          <p className="text-slate-500 font-bold text-xs uppercase">
            Isso irá sobrescrever o banco de dados Supabase com os dados atuais da memória do navegador.
          </p>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl text-left space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase">Resumo da operação:</p>
          <div className="flex justify-between text-xs font-bold text-slate-700">
            <span>Membros CLT:</span>
            <span>{cltCount}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-slate-700">
            <span>Prestadores:</span>
            <span>{providerCount}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={onClose} className="py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="py-4 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-700 transition-all">Confirmar</button>
        </div>
      </div>
    </div>
  );
};

export default ForceSyncModal;
