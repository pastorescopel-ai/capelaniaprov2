
import React, { createContext, useContext, useState, useCallback } from 'react';

interface ToastContextType {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  const showToast = useCallback((message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast.show && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top duration-300">
          <div className="bg-slate-900/90 backdrop-blur-md text-white px-8 py-4 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3">
            <i className="fas fa-exclamation-circle text-amber-400 text-lg"></i>
            <span className="font-black uppercase text-[10px] tracking-widest">{toast.message}</span>
            <button onClick={() => setToast({ show: false, message: '' })} className="ml-4 hover:text-rose-400 transition-colors">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de um ToastProvider');
  return context;
};
