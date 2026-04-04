import React, { ReactNode } from 'react';
import { useAppData } from '../hooks/useAppData';
import { BibleProvider } from './BibleProvider';
import { ProProvider } from './ProProvider';
import { AppContext } from './AppContext';

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
    proHistoryRecords: appData.proHistoryRecords,
    setProStaff: appData.setProStaff,
    setProSectors: appData.setProSectors,
    setProGroups: appData.setProGroups,
    setProGroupMembers: appData.setProGroupMembers,
    setProGroupProviderMembers: appData.setProGroupProviderMembers,
    setProGroupLocations: appData.setProGroupLocations,
    setProPatients: appData.setProPatients,
    setProProviders: appData.setProProviders,
    setProMonthlyStats: appData.setProMonthlyStats,
    setProHistoryRecords: appData.setProHistoryRecords
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
