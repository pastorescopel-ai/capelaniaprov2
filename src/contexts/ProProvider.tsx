import React, { ReactNode } from 'react';
import { ProContext, ProContextType } from './ProContext';

export const ProProvider: React.FC<{ children: ReactNode, value: ProContextType }> = ({ children, value }) => {
  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
};
