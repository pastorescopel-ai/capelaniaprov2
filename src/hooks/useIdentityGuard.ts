import { useApp } from '../hooks/useApp';
import { normalizeString } from '../utils/formatters';
import { Unit, ParticipantType, RecordStatus, UserRole } from '../types';

export const useIdentityGuard = () => {
  const { proStaff, bibleStudies, bibleClasses, staffVisits, users } = useApp();

  const checkIdentityConflict = (name: string, participantType: ParticipantType, unit: Unit): { hasConflict: boolean; message: string } => {
    // FLEXIBILIZAR: Desativado para permitir registros livres sem bloqueios de tipo
    return { hasConflict: false, message: '' };
  };

  // Agora é apenas informativo: retorna hasConflict pra quem chama decidir se avisa o capelão,
  // mas nunca deve mais ser usado pra bloquear o lançamento — só pra dar contexto de quem
  // já está acompanhando aquele aluno/turma.
  const checkOwnershipConflict = (
    nameOrStudents: string | string[],
    type: 'study' | 'class' | 'visit',
    unit: Unit,
    currentUserId: string,
    currentUserRole: UserRole
  ): { hasConflict: boolean; message: string; ownerName?: string } => {
    // Antes pulava Admin/Gestor pra não travar quem gerencia o sistema — mas agora que isso é só
    // um aviso informativo (não bloqueia mais o lançamento), não há motivo pra pular ninguém.
    const isEmpty = Array.isArray(nameOrStudents) ? nameOrStudents.length === 0 : !nameOrStudents;
    if (isEmpty) {
      return { hasConflict: false, message: '' };
    }

    if (type === 'visit') {
      // Visita não é um "vínculo em andamento" como estudo/turma -- é só um heads-up: esse
      // colaborador já recebeu visita antes? De quem, e quando? Não filtra por status nem por
      // capelão, avisa sempre que existir alguma visita anterior (inclusive do próprio usuário).
      const normName = normalizeString((nameOrStudents as string).split(' (')[0].trim());
      const lastVisit = [...staffVisits]
        .filter(v => normalizeString((v.staffName || '').split(' (')[0].trim()) === normName && v.unit === unit)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (lastVisit) {
        const owner = users.find(u => u.id === lastVisit.userId);
        const dateLabel = new Date((lastVisit.date.split('T')[0]) + 'T12:00:00').toLocaleDateString('pt-BR');
        const isSelf = lastVisit.userId === currentUserId;
        return {
          hasConflict: true,
          message: isSelf
            ? `Você já visitou este colaborador em ${dateLabel}.`
            : `Este colaborador já foi visitado pelo capelão "${owner?.name || 'outro capelão'}" em ${dateLabel}.`,
          ownerName: owner?.name
        };
      }
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
