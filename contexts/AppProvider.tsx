import React, { createContext, useContext, ReactNode } from 'react';
import { useAppData } from '../hooks/useAppData';
import { BibleProvider } from './BibleContext';
import { ProProvider } from './ProContext';

type AppContextType = ReturnType<typeof useAppData>;

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const appData = useAppData();
  
  const bibleValue = {
    bibleStudies: appData.bibleStudies,
    bibleClasses: appData.bibleClasses,
    bibleClassAttendees: appData.bibleClassAttendees,
    setBibleStudies: appData.setBibleStudies,
    setBibleClasses: appData.setBibleClasses,
    setBibleClassAttendees: appData.setBibleClassAttendees
  };

  const proValue = {
    proStaff: appData.proStaff,
    proSectors: appData.proSectors,
    proGroups: appData.proGroups,
    proGroupMembers: appData.proGroupMembers,
    proGroupProviderMembers: appData.proGroupProviderMembers,
    proGroupLocations: appData.proGroupLocations,
    proPatients: appData.proPatients,
    proProviders: appData.proProviders,
    proMonthlyStats: appData.proMonthlyStats,
    setProStaff: appData.setProStaff,
    setProSectors: appData.setProSectors,
    setProGroups: appData.setProGroups,
    setProGroupMembers: appData.setProGroupMembers,
    setProGroupProviderMembers: appData.setProGroupProviderMembers,
    setProGroupLocations: appData.setProGroupLocations,
    setProPatients: appData.setProPatients,
    setProProviders: appData.setProProviders,
    setProMonthlyStats: appData.setProMonthlyStats
  };

  return (
    <AppContext.Provider value={appData}>
      <BibleProvider value={bibleValue}>
        <ProProvider value={proValue}>
          {children}
        </ProProvider>
      </BibleProvider>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
