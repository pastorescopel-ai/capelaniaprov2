
import React from 'react';

interface GlobalCloseMonthModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  selectedMonth: string;
  isProcessing: boolean;
  isAlreadyClosed: boolean;
}

const GlobalCloseMonthModal: React.FC<GlobalCloseMonthModalProps> = ({ 
  isOpen, onCancel, onConfirm, selectedMonth, isProcessing, isAlreadyClosed 
}) => {
  if (!isOpen) return null;

  const d = new Date(selectedMonth + 'T12:00:00');
  const monthName = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300 border-4 border-slate-50">
        <div className="p-10">
          <div className={`w-20 h-20 rounded-[2rem] ${isAlreadyClosed ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'} flex items-center justify-center mb-8 mx-auto shadow-inner`}>
            <i className={`fas ${isAlreadyClosed ? 'fa-sync-alt' : 'fa-lock'} text-3xl`}></i>
          </div>
          
          <h3 className="text-2xl font-black text-slate-800 mb-3 text-center uppercase tracking-tighter">
            {isAlreadyClosed ? 'Atualizar Fechamento Global' : 'Executar Fechamento Global'}
          </h3>
          <p className="text-slate-500 text-sm mb-10 text-center font-bold leading-relaxed px-4">
            Deseja {isAlreadyClosed ? 'atualizar' : 'fechar'} o mês de <span className="text-blue-600 capitalize">{monthName}</span> para <span className="text-slate-800">TODAS as unidades (HAB e HABA)</span>? 
            {isAlreadyClosed 
              ? ' Os dados anteriores serão sobrescritos pelos atuais no histórico.' 
              : ' Isso gravará os indicadores e o histórico individual como definitivos.'}
          </p>

          <div className="bg-slate-50 rounded-[2rem] p-6 mb-10 space-y-4 border border-slate-100">
            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="fas fa-check text-[10px] text-emerald-600"></i>
              </div>
              <p className="text-[11px] text-slate-600 font-black uppercase tracking-tight leading-tight">
                Processa HAB e HABA simultaneamente
              </p>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="fas fa-check text-[10px] text-emerald-600"></i>
              </div>
              <p className="text-[11px] text-slate-600 font-black uppercase tracking-tight leading-tight">
                Gera registros individuais para o B.I. (Histórico)
              </p>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="fas fa-exclamation text-[10px] text-rose-600"></i>
              </div>
              <p className="text-[11px] text-rose-700 font-black uppercase tracking-tight leading-tight">
                Atenção: Esta ação impacta todos os relatórios globais.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={onCancel} 
              disabled={isProcessing}
              className="px-8 py-5 rounded-2xl bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50 active:scale-95"
            >
              Cancelar
            </button>
            <button 
              onClick={onConfirm} 
              disabled={isProcessing}
              className={`px-8 py-5 rounded-2xl ${isAlreadyClosed ? 'bg-amber-500' : 'bg-[#005a9c]'} text-white font-black text-[10px] uppercase tracking-widest hover:brightness-110 shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95`}
            >
              {isProcessing ? (
                <>
                  <i className="fas fa-circle-notch fa-spin"></i>
                  Processando
                </>
              ) : (
                <>
                  <i className="fas fa-check-circle"></i>
                  {isAlreadyClosed ? 'Confirmar Atualização' : 'Confirmar Fechamento'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalCloseMonthModal;
