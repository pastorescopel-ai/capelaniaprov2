
import React from 'react';

interface RemovalModalProps {
  memberToRemove: { id: string; name: string; staffId: string } | null;
  removalType: 'exit' | 'error';
  setRemovalType: (type: 'exit' | 'error') => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const RemovalModal: React.FC<RemovalModalProps> = ({ memberToRemove, removalType, setRemovalType, onCancel, onConfirm }) => {
  if (!memberToRemove) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
            <i className="fas fa-user-minus text-rose-500"></i>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Remover Colaborador</h3>
          <p className="text-slate-500 text-sm mb-6">
            Como você deseja remover <span className="font-bold text-slate-700">{memberToRemove.name}</span> deste PG?
          </p>

          <div className="space-y-3 mb-6">
            <button 
              onClick={() => setRemovalType('exit')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${removalType === 'exit' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${removalType === 'exit' ? 'border-blue-500' : 'border-slate-300'}`}>
                  {removalType === 'exit' && <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>}
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-700">Saída do PG</p>
                  <p className="text-[11px] text-slate-500">O colaborador participou e agora está saindo. Mantém histórico.</p>
                </div>
              </div>
            </button>

            <button 
              onClick={() => setRemovalType('error')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${removalType === 'error' ? 'border-amber-500 bg-amber-50' : 'border-slate-100 hover:border-slate-200'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${removalType === 'error' ? 'border-amber-500' : 'border-slate-300'}`}>
                  {removalType === 'error' && <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>}
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-700">Erro de Cadastro</p>
                  <p className="text-[11px] text-slate-500">Ele nunca pertenceu a este PG. Marca como erro administrativo.</p>
                </div>
              </div>
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors">Cancelar</button>
            <button onClick={onConfirm} className="flex-1 px-4 py-3 rounded-xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all">Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemovalModal;
