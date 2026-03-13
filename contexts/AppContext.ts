import { createContext } from 'react';

interface AppContextType {
  proSectors: any[];
  proStaff: any[];
  config: any;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
