import React, { useContext, ReactNode } from 'react';
import { AppContext } from './AppContext';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const value = {
    proSectors: [],
    proStaff: [],
    config: {}
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
