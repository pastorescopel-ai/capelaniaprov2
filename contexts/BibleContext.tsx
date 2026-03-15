import React, { createContext, useContext, ReactNode } from 'react';
import { BibleStudy, BibleClass } from '../types';

interface BibleContextType {
  bibleStudies: BibleStudy[];
  bibleClasses: BibleClass[];
  bibleClassAttendees: any[];
  setBibleStudies: React.Dispatch<React.SetStateAction<BibleStudy[]>>;
  setBibleClasses: React.Dispatch<React.SetStateAction<BibleClass[]>>;
  setBibleClassAttendees: React.Dispatch<React.SetStateAction<any[]>>;
}

export const BibleContext = createContext<BibleContextType | undefined>(undefined);

export const BibleProvider: React.FC<{ children: ReactNode, value: BibleContextType }> = ({ children, value }) => {
  return <BibleContext.Provider value={value}>{children}</BibleContext.Provider>;
};

export const useBible = () => {
  const context = useContext(BibleContext);
  if (!context) {
    throw new Error('useBible must be used within a BibleProvider');
  }
  return context;
};
