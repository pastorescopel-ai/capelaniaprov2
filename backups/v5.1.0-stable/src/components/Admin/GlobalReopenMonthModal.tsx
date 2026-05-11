
import React from 'react';

interface GlobalReopenMonthModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  selectedMonth: string;
  isProcessing: boolean;
}

const GlobalReopenMonthModal: React.FC<GlobalReopenMonthModalProps> = ({ 
  isOpen, onCancel, onConfirm, selectedMonth, isProcessing 
}) => {
  if (!isOpen) return null;

  const d = new Date(selectedMonth + 'T12:00:00');
  const monthName = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300 border-4 border-rose-50">
        <div className="p-10 text-center">
          <div className="w-20 h-20 rounded-[2rem] bg-rose-50 text-rose-500 flex items-center justify-center mb-8 mx-auto shadow-inner">
            <i className="fas fa-lock-open text-3xl"></i>
          </div>
          
          <h3 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tighter">
            Reabrir Mês Globalmente
          </h3>
          <p className="text-slate-500 text-sm mb-10 font-bold leading-relaxed px-4">
            Você está prestes a REABRIR o mês de <span className="text-rose-600 capitalize">{monthName}</span> para <span className="text-slate-800">HAB e HABA</span>. 
            Isso apagará o histórico definitivo e os relatórios voltarão a calcular os dados "ao vivo".
          </p>

          <div className="bg-rose-50 rounded-[2rem] p-6 mb-10 space-y-4 border border-rose-100">
            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="fas fa-exclamation text-[10px] text-rose-600"></i>
              </div>
              <p className="text-[11px] text-rose-700 font-black uppercase tracking-tight leading-tight text-left">
                Apaga os registros de estatísticas mensais
              </p>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="fas fa-exclamation text-[10px] text-rose-600"></i>
              </div>
              <p className="text-[11px] text-rose-700 font-black uppercase tracking-tight leading-tight text-left">
                Remove o snapshot individual do histórico (B.I.)
              </p>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="fas fa-exclamation text-[10px] text-rose-600"></i>
              </div>
              <p className="text-[11px] text-rose-700 font-black uppercase tracking-tight leading-tight text-left">
                Atenção: Esta ação não pode ser desfeita.
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
              className="px-8 py-5 rounded-2xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
            >
              {isProcessing ? (
                <>
                  <i className="fas fa-circle-notch fa-spin"></i>
                  Processando
                </>
              ) : (
                <>
                  <i className="fas fa-unlock"></i>
                  Confirmar Reabertura
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalReopenMonthModal;
