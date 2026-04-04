
import { createContext, useContext } from 'react';
import { BibleStudy, BibleClass } from '../types';

export interface BibleContextType {
  bibleStudies: BibleStudy[];
  bibleClasses: BibleClass[];
  bibleClassAttendees: any[];
  setBibleStudies: React.Dispatch<React.SetStateAction<BibleStudy[]>>;
  setBibleClasses: React.Dispatch<React.SetStateAction<BibleClass[]>>;
  setBibleClassAttendees: React.Dispatch<React.SetStateAction<any[]>>;
}

export const BibleContext = createContext<BibleContextType | undefined>(undefined);

export const useBible = () => {
  const context = useContext(BibleContext);
  if (!context) {
    throw new Error('useBible must be used within a BibleProvider');
  }
  return context;
};
