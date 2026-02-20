
import React, { createContext, useContext, ReactNode } from 'react';
import { useAppData } from '../hooks/useAppData';
import { useDataMaintenance } from '../hooks/useDataMaintenance';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, Config, VisitRequest, ProStaff, ProSector, ProGroup, ProGroupLocation, ProGroupMember, ProPatient, ProProvider, ParticipantType, Unit } from '../types';

interface AppContextType {
  users: User[];
  bibleStudies: BibleStudy[];
  bibleClasses: BibleClass[];
  smallGroups: SmallGroup[];
  staffVisits: StaffVisit[];
  visitRequests: VisitRequest[];
  
  proStaff: ProStaff[];
  proPatients: ProPatient[];
  proProviders: ProProvider[];
  proSectors: ProSector[];
  proGroups: ProGroup[];
  proGroupLocations: ProGroupLocation[];
  proGroupMembers: ProGroupMember[];
  
  config: Config;
  isSyncing: boolean;
  isConnected: boolean;
  
  loadFromCloud: (showLoader?: boolean) => Promise<void>;
  saveToCloud: (overrides?: any, showLoader?: boolean) => Promise<boolean>;
  saveRecord: (collection: string, item: any) => Promise<boolean>;
  deleteRecord: (collection: string, id: string) => Promise<boolean>;
  applySystemOverrides: (baseConfig: Config) => Config;
  syncMasterContact: (name: string, phone: string, unit: Unit, type: ParticipantType, extra?: string) => Promise<void>;
  
  // Maintenance Functions
  importFromDNA: (dnaData: any) => Promise<{ success: boolean; message: string }>;
  migrateLegacyStructure: () => Promise<{ success: boolean; message: string; details?: string }>;
  unifyNumericIdsAndCleanPrefixes: () => Promise<{ success: boolean; message: string }>;
  mergePGs: (sourceId: string, targetId: string) => Promise<{ success: boolean; message: string }>;
  executeSectorMigration: (oldName: string, newName: string) => Promise<string>;
  executePGMigration: (oldName: string, newName: string) => Promise<string>;
  unifyStudentIdentity: (orphanName: string, targetStaffId: string) => Promise<string>;
  convertIdentityType: (orphanName: string, newType: 'Paciente' | 'Prestador') => Promise<string>;
  healSectorConnection: (badName: string, targetSectorId: string) => Promise<string>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const appData = useAppData();
  
  // Initialize maintenance hook with the reloader from appData
  const maintenance = useDataMaintenance(appData.loadFromCloud);
  
  const value: AppContextType = {
    ...appData,
    ...maintenance,
    // Combine loading states for UI feedback
    isSyncing: appData.isSyncing || maintenance.isMaintenanceRunning
  };

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
