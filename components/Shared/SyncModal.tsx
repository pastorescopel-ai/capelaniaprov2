
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
      <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-300 border-4 border-slate-50">
        
        {/* Ícone Animado por Estado */}
        <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-inner transition-all duration-500">
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
              <i className="fas fa-check text-emerald-600 text-4xl"></i>
            </div>
          )}

          {status === 'error' && (
            <div className="w-full h-full bg-rose-100 rounded-full flex items-center justify-center animate-in shake">
              <i className="fas fa-times text-rose-600 text-4xl"></i>
            </div>
          )}
        </div>

        {/* Textos */}
        <div className="space-y-2 w-full">
          <h3 className={`text-2xl font-black uppercase tracking-tighter transition-colors duration-300 ${
            status === 'error' ? 'text-rose-600' : status === 'success' ? 'text-emerald-600' : 'text-slate-800'
          }`}>
            {title}
          </h3>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest leading-relaxed">
            {message}
          </p>
          
          {/* Detalhes do Erro (Se houver) */}
          {status === 'error' && errorDetails && (
            <div className="mt-4 p-4 bg-rose-50 rounded-xl border border-rose-100 text-left overflow-hidden">
              <p className="text-[9px] font-mono text-rose-800 break-words">
                <strong>Erro Técnico:</strong> {errorDetails}
              </p>
            </div>
          )}
        </div>

        {/* Botão de Fechar (Apenas se não estiver processando) */}
        {status !== 'processing' && (
          <button 
            onClick={onClose}
            className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg transition-all active:scale-95 ${
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
