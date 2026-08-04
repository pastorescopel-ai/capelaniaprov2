import { createContext, useContext } from 'react';

type ToastType = 'success' | 'warning' | 'info' | 'error';

export interface ToastContextType {
  // persistent: true mantém o toast na tela até o usuário fechar manualmente, em vez de
  // sumir sozinho em 4s — usado pra avisos que valem a pena ler com calma (ex: conflito de
  // capelão responsável), não pra confirmações rápidas de "salvo com sucesso".
  showToast: (message: string, type?: ToastType, persistent?: boolean) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de um ToastProvider');
  return context;
};
