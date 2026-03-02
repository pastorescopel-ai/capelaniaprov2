import { useApp } from '../contexts/AppContext';
import { normalizeString } from '../utils/formatters';
import { Unit, ParticipantType } from '../types';

export const useIdentityGuard = () => {
  const { proStaff } = useApp();

  const checkIdentityConflict = (name: string, participantType: ParticipantType, unit: Unit): { hasConflict: boolean; message: string } => {
    if (!name || participantType === ParticipantType.STAFF) {
      return { hasConflict: false, message: '' };
    }

    const normName = normalizeString(name);
    const staffExists = proStaff.some(s => normalizeString(s.name) === normName && s.unit === unit);

    if (staffExists) {
      return { 
        hasConflict: true, 
        message: `Atenção: "${name}" consta na lista oficial de Colaboradores. Por favor, mude o "Tipo de Pessoa" para Colaborador.` 
      };
    }

    return { hasConflict: false, message: '' };
  };

  return { checkIdentityConflict };
};
