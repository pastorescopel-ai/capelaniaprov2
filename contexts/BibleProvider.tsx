import React, { ReactNode } from 'react';
import { BibleContext, BibleContextType } from './BibleContext';

export const BibleProvider: React.FC<{ children: ReactNode, value: BibleContextType }> = ({ children, value }) => {
  return <BibleContext.Provider value={value}>{children}</BibleContext.Provider>;
};
