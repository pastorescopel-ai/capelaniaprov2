import React, { createContext, useContext, ReactNode } from 'react';
import { ProStaff, ProSector, ProGroup, ProGroupMember, ProGroupProviderMember, ProPatient, ProProvider, ProMonthlyStats } from '../types';

interface ProContextType {
  proStaff: ProStaff[];
  proSectors: ProSector[];
  proGroups: ProGroup[];
  proGroupMembers: ProGroupMember[];
  proGroupProviderMembers: ProGroupProviderMember[];
  proPatients: ProPatient[];
  proProviders: ProProvider[];
  proMonthlyStats: ProMonthlyStats[];
  setProStaff: React.Dispatch<React.SetStateAction<ProStaff[]>>;
  setProSectors: React.Dispatch<React.SetStateAction<ProSector[]>>;
  setProGroups: React.Dispatch<React.SetStateAction<ProGroup[]>>;
  setProGroupMembers: React.Dispatch<React.SetStateAction<ProGroupMember[]>>;
  setProGroupProviderMembers: React.Dispatch<React.SetStateAction<ProGroupProviderMember[]>>;
  setProPatients: React.Dispatch<React.SetStateAction<ProPatient[]>>;
  setProProviders: React.Dispatch<React.SetStateAction<ProProvider[]>>;
  setProMonthlyStats: React.Dispatch<React.SetStateAction<ProMonthlyStats[]>>;
}

export const ProContext = createContext<ProContextType | undefined>(undefined);

export const ProProvider: React.FC<{ children: ReactNode, value: ProContextType }> = ({ children, value }) => {
  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
};

export const usePro = () => {
  const context = useContext(ProContext);
  if (!context) {
    throw new Error('usePro must be used within a ProProvider');
  }
  return context;
};
