import { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp deve ser usado dentro de um AppProvider');
  return context;
};
