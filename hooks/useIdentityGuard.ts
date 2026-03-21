import { useApp } from '../hooks/useApp';
import { normalizeString } from '../utils/formatters';
import { Unit, ParticipantType, RecordStatus, UserRole } from '../types';

export const useIdentityGuard = () => {
  const { proStaff, bibleStudies, bibleClasses, users } = useApp();

  const checkIdentityConflict = (name: string, participantType: ParticipantType, unit: Unit): { hasConflict: boolean; message: string } => {
    // FLEXIBILIZAR: Desativado para permitir registros livres sem bloqueios de tipo
    return { hasConflict: false, message: '' };
  };

  const checkOwnershipConflict = (
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
  };

  return { checkIdentityConflict, checkOwnershipConflict };
};
