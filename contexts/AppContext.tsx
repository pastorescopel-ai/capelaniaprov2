
import React, { createContext, ReactNode } from 'react';
import { useAppData } from '../hooks/useAppData';
import { useDataMaintenance } from '../hooks/useDataMaintenance';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, Config, VisitRequest, ProStaff, ProSector, ProGroup, ProGroupLocation, ProGroupMember, ProGroupProviderMember, ProPatient, ProProvider, ParticipantType, Unit, ActivitySchedule, DailyActivityReport } from '../types';

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
  proGroupProviderMembers: ProGroupProviderMember[];
  
  activitySchedules: ActivitySchedule[];
  dailyActivityReports: DailyActivityReport[];
  
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
  unifyNumericIdsAndCleanPrefixes: () => Promise<{ success: boolean; message: string }>;
  mergePGs: (sourceId: string, targetId: string) => Promise<{ success: boolean; message: string }>;
  executeSectorMigration: (oldName: string, newName: string) => Promise<string>;
  executePGMigration: (oldName: string, newName: string) => Promise<string>;
  unifyStudentIdentity: (orphanName: string, targetStaffId: string) => Promise<string>;
  createAndLinkIdentity: (orphanName: string, newType: 'Paciente' | 'Prestador') => Promise<string>;
  healSectorConnection: (badName: string, targetSectorId: string) => Promise<string>;
  linkStudySessionIdentity: (orphanName: string, targetStaffId: string, targetSectorId: string | null, participantType: string) => Promise<string>;
  bulkHealAttendees: () => Promise<string>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

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
