import { useApp } from '../contexts/AppContext';
import { useHealerState } from './healer/useHealerState';
import { useHealerCalculations } from './healer/useHealerCalculations';
import { useHealerActions } from './healer/useHealerActions';

export type HealerTab = 'people' | 'sectors' | 'attendees' | 'studies' | 'pgs' | 'merge';
export type PersonType = 'Colaborador' | 'Ex-Colaborador' | 'Paciente' | 'Prestador';

export const useDataHealer = () => {
  const appData = useApp();
  
  // 1. UI State Management
  const state = useHealerState();

  // 2. Heavy Calculations (Orphans, Health Score, Options)
  const calculations = useHealerCalculations(appData, state);

  // 3. Data Mutations (Process, Heal, Delete)
  const actions = useHealerActions(appData, state);

  // Combine everything to return the exact same interface as before
  return {
    ...state,
    ...calculations,
    ...actions
  };
};
