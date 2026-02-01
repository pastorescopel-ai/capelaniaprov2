import React, { createContext, useContext, ReactNode } from 'react';
import { useAppData } from '../hooks/useAppData';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, MasterLists, Config, VisitRequest } from '../types';

interface AppContextType {
  users: User[];
  bibleStudies: BibleStudy[];
  bibleClasses: BibleClass[];
  smallGroups: SmallGroup[];
  staffVisits: StaffVisit[];
  visitRequests: VisitRequest[];
  masterLists: MasterLists;
  config: Config;
  isSyncing: boolean;
  isConnected: boolean;
  loadFromCloud: (showLoader?: boolean) => Promise<void>;
  saveToCloud: (overrides?: any, showLoader?: boolean) => Promise<boolean>;
  saveRecord: (collection: string, item: any) => Promise<boolean>;
  deleteRecord: (collection: string, id: string) => Promise<boolean>;
  hashPassword: (password: string) => Promise<string>;
  applySystemOverrides: (baseConfig: Config) => Config;
  importFromDNA: (dnaData: any) => Promise<{ success: boolean; message: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const data = useAppData();
  
  // Mapeamos explicitamente o retorno do hook para o valor do contexto
  const value: AppContextType = {
    ...data
  } as AppContextType;

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp deve ser usado dentro de um AppProvider');
  return context;
};