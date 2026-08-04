import { useApp } from '../hooks/useApp';
import { normalizeString } from '../utils/formatters';
import { Unit, ParticipantType, RecordStatus, UserRole } from '../types';

export const useIdentityGuard = () => {
  const { proStaff, bibleStudies, bibleClasses, users } = useApp();

  const checkIdentityConflict = (name: string, participantType: ParticipantType, unit: Unit): { hasConflict: boolean; message: string } => {
    // FLEXIBILIZAR: Desativado para permitir registros livres sem bloqueios de tipo
    return { hasConflict: false, message: '' };
  };

  // Agora é apenas informativo: retorna hasConflict pra quem chama decidir se avisa o capelão,
  // mas nunca deve mais ser usado pra bloquear o lançamento — só pra dar contexto de quem
  // já está acompanhando aquele aluno/turma.
  const checkOwnershipConflict = (
    nameOrStudents: string | string[],
    type: 'study' | 'class',
    unit: Unit,
    currentUserId: string,
    currentUserRole: UserRole
  ): { hasConflict: boolean; message: string; ownerName?: string } => {
    const isEmpty = Array.isArray(nameOrStudents) ? nameOrStudents.length === 0 : !nameOrStudents;
    if (currentUserRole === UserRole.ADMIN || isEmpty) {
      return { hasConflict: false, message: '' };
    }

    if (type === 'study') {
      const normName = normalizeString(nameOrStudents as string);
      const lastStudy = [...bibleStudies]
        .filter(s => normalizeString(s.name) === normName && s.unit === unit)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (lastStudy && lastStudy.status !== RecordStatus.TERMINO && lastStudy.userId !== currentUserId) {
        const owner = users.find(u => u.id === lastStudy.userId);
        return {
          hasConflict: true,
          message: `Este aluno já está em estudo com o capelão "${owner?.name || 'outro capelão'}". Fique à vontade pra lançar mesmo assim — só avisando pra alinhar com ele se necessário.`,
          ownerName: owner?.name
        };
      }
    } else {
      // Para Classes, a identidade da turma é dada pelos alunos, não mais pelo setor.
      const namesOnly = (Array.isArray(nameOrStudents) ? nameOrStudents : [nameOrStudents])
        .map(s => normalizeString(s.split(' (')[0].trim()));

      const lastClass = [...bibleClasses]
        .filter(c => c.unit === unit && Array.isArray(c.students) && c.students.some(s => namesOnly.includes(normalizeString(s.split(' (')[0].trim()))))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (lastClass && lastClass.status !== RecordStatus.TERMINO && lastClass.userId !== currentUserId) {
        const owner = users.find(u => u.id === lastClass.userId);
        return {
          hasConflict: true,
          message: `Esta turma já está tendo classe com o capelão "${owner?.name || 'outro capelão'}". Fique à vontade pra lançar mesmo assim — só avisando pra alinhar com ele se necessário.`,
          ownerName: owner?.name
        };
      }
    }

    return { hasConflict: false, message: '' };
  };

  return { checkIdentityConflict, checkOwnershipConflict };
};
