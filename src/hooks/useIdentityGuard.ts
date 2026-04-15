import { useCallback } from 'react';
import { useApp } from '../hooks/useApp';
import { normalizeString } from '../utils/formatters';
import { Unit, ParticipantType, RecordStatus, UserRole } from '../types';

export const useIdentityGuard = () => {
  const { proStaff, bibleStudies, bibleClasses, users } = useApp();

  const checkIdentityConflict = useCallback((name: string, participantType: ParticipantType, unit: Unit): { hasConflict: boolean; message: string; isWarning?: boolean } => {
    if (!name) return { hasConflict: false, message: '' };
    const normName = normalizeString(name);

    // 1. Verificação de Colaborador Oficial
    const isOfficialStaff = proStaff.some(s => normalizeString(s.name) === normName && s.unit === unit);

    if (participantType === ParticipantType.STAFF) {
      if (!isOfficialStaff) {
        return { 
          hasConflict: true, 
          message: 'Este nome não consta na lista oficial de colaboradores do RH. Para registrar como colaborador, selecione um nome da lista.' 
        };
      }
    } else {
      // 2. Alerta de Cross-Categorização (Aviso, não bloqueio)
      if (isOfficialStaff) {
        return {
          hasConflict: true,
          isWarning: true,
          message: `Atenção: "${name}" consta na lista oficial de Colaboradores. Tem certeza que deseja registrar como ${participantType}?`
        };
      }
    }

    return { hasConflict: false, message: '' };
  }, [proStaff]);

  const checkOwnershipConflict = useCallback((
    nameOrSector: string, 
    type: 'study' | 'class', 
    unit: Unit, 
    currentUserId: string, 
    currentUserRole: UserRole
  ): { hasConflict: boolean; message: string; ownerName?: string } => {
    if (currentUserRole === UserRole.ADMIN || !nameOrSector) {
      return { hasConflict: false, message: '' };
    }

    const normName = normalizeString(nameOrSector);

    if (type === 'study') {
      const lastStudy = [...bibleStudies]
        .filter(s => normalizeString(s.name) === normName && s.unit === unit)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (lastStudy && lastStudy.status !== RecordStatus.TERMINO && lastStudy.userId !== currentUserId) {
        const owner = users.find(u => u.id === lastStudy.userId);
        return {
          hasConflict: true,
          message: `Este aluno está recebendo estudo pelo capelão "${owner?.name || 'outro capelão'}". Solicite transferência ao Admin ou aguarde a conclusão.`,
          ownerName: owner?.name
        };
      }
    } else {
      // Para Classes, verificamos pelo setor
      const lastClass = [...bibleClasses]
        .filter(c => normalizeString(c.sector) === normName && c.unit === unit)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (lastClass && lastClass.status !== RecordStatus.TERMINO && lastClass.userId !== currentUserId) {
        const owner = users.find(u => u.id === lastClass.userId);
        return {
          hasConflict: true,
          message: `A classe deste setor está sendo realizada pelo capelão "${owner?.name || 'outro capelão'}". Solicite transferência ao Admin ou aguarde a conclusão.`,
          ownerName: owner?.name
        };
      }
    }

    return { hasConflict: false, message: '' };
  }, [bibleStudies, bibleClasses, users]);

  return { checkIdentityConflict, checkOwnershipConflict };
};
