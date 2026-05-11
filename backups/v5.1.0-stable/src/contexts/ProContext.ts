
import { createContext, useContext } from 'react';
import { ProStaff, ProSector, ProGroup, ProGroupMember, ProGroupProviderMember, ProPatient, ProProvider as ProProviderModel, ProMonthlyStats, ProGroupLocation, ProHistoryRecord } from '../types';

export interface ProContextType {
  proStaff: ProStaff[];
  proSectors: ProSector[];
  proGroups: ProGroup[];
  proGroupMembers: ProGroupMember[];
  proGroupProviderMembers: ProGroupProviderMember[];
  proGroupLocations: ProGroupLocation[];
  proPatients: ProPatient[];
  proProviders: ProProviderModel[];
  proMonthlyStats: ProMonthlyStats[];
  proHistoryRecords: ProHistoryRecord[];
  ambassadors: any[];
  setProStaff: React.Dispatch<React.SetStateAction<ProStaff[]>>;
  setProSectors: React.Dispatch<React.SetStateAction<ProSector[]>>;
  setProGroups: React.Dispatch<React.SetStateAction<ProGroup[]>>;
  setProGroupMembers: React.Dispatch<React.SetStateAction<ProGroupMember[]>>;
  setProGroupProviderMembers: React.Dispatch<React.SetStateAction<ProGroupProviderMember[]>>;
  setProGroupLocations: React.Dispatch<React.SetStateAction<ProGroupLocation[]>>;
  setProPatients: React.Dispatch<React.SetStateAction<ProPatient[]>>;
  setProProviders: React.Dispatch<React.SetStateAction<ProProviderModel[]>>;
  setProMonthlyStats: React.Dispatch<React.SetStateAction<ProMonthlyStats[]>>;
  setProHistoryRecords: React.Dispatch<React.SetStateAction<ProHistoryRecord[]>>;
  setAmbassadors: React.Dispatch<React.SetStateAction<any[]>>;
}

export const ProContext = createContext<ProContextType | undefined>(undefined);

export const usePro = () => {
  const context = useContext(ProContext);
  if (!context) {
    throw new Error('usePro must be used within a ProProvider');
  }
  return context;
};
