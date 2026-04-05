import React, { useState, useCallback, useContext } from 'react';
import { hapticFeedback } from '../utils/haptics';
import { ToastContext, ToastContextType } from './ToastContext';

type ToastType = 'success' | 'warning' | 'info' | 'error';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ show: boolean; message: string; type: ToastType }>({ 
    show: false, 
    message: '', 
    type: 'info' 
  });

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });

    // Trigger haptic feedback based on type
    if (type === 'success') hapticFeedback.success();
    else if (type === 'error') hapticFeedback.error();
    else if (type === 'warning') hapticFeedback.warning();
    else hapticFeedback.light();

    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  }, []);

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success': return { icon: 'fa-check-circle', color: 'text-emerald-400', border: 'border-emerald-500/20' };
      case 'error': return { icon: 'fa-times-circle', color: 'text-rose-400', border: 'border-rose-500/20' };
      case 'warning': return { icon: 'fa-exclamation-triangle', color: 'text-amber-400', border: 'border-amber-500/20' };
      default: return { icon: 'fa-info-circle', color: 'text-blue-400', border: 'border-blue-500/20' };
    }
  };

  const styles = getToastStyles(toast.type);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast.show && (
        <div className="fixed bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom duration-500">
          <div className={`bg-slate-900/95 backdrop-blur-md text-white px-6 py-4 rounded-[2rem] shadow-2xl border ${styles.border} flex items-center gap-4 min-w-[280px] max-w-[90vw]`}>
            <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center ${styles.color}`}>
              <i className={`fas ${styles.icon} text-lg`}></i>
            </div>
            <div className="flex-1">
              <p className="font-black uppercase text-[10px] tracking-widest leading-tight">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToast({ ...toast, show: false })} 
              className="w-8 h-8 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center text-slate-400"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
