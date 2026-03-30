
import React from 'react';

interface ReopenMonthModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  selectedMonth: string;
  isClosing: boolean;
}

const ReopenMonthModal: React.FC<ReopenMonthModalProps> = ({ isOpen, onCancel, onConfirm, selectedMonth, isClosing }) => {
  if (!isOpen) return null;

  const [year, month] = selectedMonth.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-100">
        <div className="p-8">
          <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mb-6 mx-auto">
            <i className="fas fa-unlock text-slate-500 text-2xl"></i>
          </div>
          
          <h3 className="text-xl font-black text-slate-800 mb-2 text-center uppercase tracking-tight">Reabrir Mês de Competência</h3>
          <p className="text-slate-500 text-sm mb-8 text-center font-medium">
            Você está prestes a <span className="font-black text-rose-600">REABRIR</span> o mês de <span className="font-black text-slate-700 capitalize">{monthName}</span>. 
            Isso apagará o histórico gerado e voltará o sistema para esta competência.
          </p>

          <div className="bg-rose-50 rounded-2xl p-5 mb-8 space-y-3 border border-rose-100">
            <div className="flex gap-3 items-start">
              <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="fas fa-exclamation text-[10px] text-rose-600"></i>
              </div>
              <p className="text-[11px] text-rose-700 font-black uppercase leading-relaxed">
                Atenção: O histórico detalhado deste mês será PERDIDO.
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="fas fa-exclamation text-[10px] text-rose-600"></i>
              </div>
              <p className="text-[11px] text-rose-700 font-black uppercase leading-relaxed">
                As estatísticas consolidadas também serão removidas.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={onCancel} 
              disabled={isClosing}
              className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              onClick={onConfirm} 
              disabled={isClosing}
              className="flex-1 px-6 py-4 rounded-2xl bg-rose-600 text-white font-black text-xs uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isClosing ? (
                <>
                  <i className="fas fa-circle-notch fa-spin"></i>
                  Processando
                </>
              ) : (
                'Confirmar Reabertura'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReopenMonthModal;
