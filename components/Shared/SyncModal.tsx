
import React from 'react';

export type SyncStatus = 'idle' | 'processing' | 'success' | 'error';

interface SyncModalProps {
  isOpen: boolean;
  status: SyncStatus;
  title: string;
  message: string;
  errorDetails?: string;
  onClose: () => void;
}

const SyncModal: React.FC<SyncModalProps> = ({ isOpen, status, title, message, errorDetails, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop com Blur */}
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-all duration-300" />

      {/* Card do Modal */}
      <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-300 border-4 border-slate-50 max-h-[90vh] overflow-hidden">
        
        {/* Ícone Animado por Estado */}
        <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-inner transition-all duration-500 flex-shrink-0">
          {status === 'processing' && (
            <div className="relative w-full h-full">
              <div className="absolute inset-0 border-8 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-8 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-database text-blue-600 text-2xl animate-pulse"></i>
              </div>
            </div>
          )}
          
          {status === 'success' && (
            <div className="w-full h-full bg-emerald-100 rounded-full flex items-center justify-center animate-in zoom-in">
              <i className="fas fa-check text-emerald-600 text-3xl"></i>
            </div>
          )}

          {status === 'error' && (
            <div className="w-full h-full bg-rose-100 rounded-full flex items-center justify-center animate-in shake">
              <i className="fas fa-times text-rose-600 text-3xl"></i>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="space-y-1 w-full flex-shrink-0">
          <h3 className={`text-2xl font-black uppercase tracking-tighter transition-colors duration-300 ${
            status === 'error' ? 'text-rose-600' : status === 'success' ? 'text-emerald-600' : 'text-slate-800'
          }`}>
            {title}
          </h3>
        </div>

        {/* Message / Logs Area */}
        <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 overflow-y-auto no-scrollbar max-h-[40vh] text-left">
           <pre className="text-slate-600 font-mono text-[10px] whitespace-pre-wrap break-words leading-relaxed">
             {message}
           </pre>
           
           {/* Detalhes do Erro (Se houver) */}
           {status === 'error' && errorDetails && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-[9px] font-bold text-rose-700 uppercase tracking-widest mb-1">Stack Trace:</p>
              <pre className="text-[9px] font-mono text-rose-500 break-words whitespace-pre-wrap">
                {errorDetails}
              </pre>
            </div>
           )}
        </div>

        {/* Botão de Fechar */}
        {status !== 'processing' && (
          <button 
            onClick={onClose}
            className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg transition-all active:scale-95 flex-shrink-0 ${
              status === 'error' 
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200' 
                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200'
            }`}
          >
            {status === 'error' ? 'Fechar e Tentar Novamente' : 'Concluir'}
          </button>
        )}
      </div>
    </div>
  );
};

export default SyncModal;
