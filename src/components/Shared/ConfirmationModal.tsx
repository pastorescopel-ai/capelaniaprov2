import React from 'react';
import Button from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", variant = 'danger', onConfirm, onCancel 
}) => {
  if (!isOpen) return null;

  const icons = {
    danger: <i className="fas fa-trash-alt text-rose-500 text-3xl"></i>,
    primary: <i className="fas fa-info-circle text-blue-500 text-3xl"></i>,
    warning: <i className="fas fa-exclamation-triangle text-amber-500 text-3xl"></i>
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onCancel} />
      
      {/* Modal Content - Centered via Flexbox */}
      <div className="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-10 text-center space-y-8 animate-in zoom-in duration-300 border-4 border-slate-50">
        <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner ${
          variant === 'danger' ? 'bg-rose-50' : variant === 'warning' ? 'bg-amber-50' : 'bg-blue-50'
        }`}>
          {icons[variant]}
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{title}</h3>
          <p className="text-slate-500 font-bold text-[10px] leading-relaxed uppercase tracking-widest">{message}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} className={variant === 'danger' ? 'bg-rose-500 text-white border-none' : ''}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;