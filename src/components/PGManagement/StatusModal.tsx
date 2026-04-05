
import React from 'react';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning';
}

const StatusModal: React.FC<StatusModalProps> = ({ isOpen, onClose, title, message, type }) => {
  if (!isOpen) return null;

  const config = {
    success: {
      icon: 'fa-check',
      color: 'emerald',
      bg: 'emerald-50',
      text: 'emerald-600'
    },
    error: {
      icon: 'fa-times',
      color: 'rose',
      bg: 'rose-50',
      text: 'rose-600'
    },
    warning: {
      icon: 'fa-exclamation',
      color: 'amber',
      bg: 'amber-50',
      text: 'amber-600'
    }
  }[type];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-100">
        <div className="p-8 text-center">
          <div className={`w-16 h-16 rounded-3xl bg-${config.bg} flex items-center justify-center mb-6 mx-auto`}>
            <i className={`fas ${config.icon} text-${config.text} text-2xl`}></i>
          </div>
          
          <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{title}</h3>
          <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed">
            {message}
          </p>

          <button 
            onClick={onClose} 
            className={`w-full px-6 py-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all`}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusModal;
