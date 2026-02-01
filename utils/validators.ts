
import { UserRole } from '../types';

/**
 * Regra: Capelão pode editar registros do mês atual livremente.
 * Registros do mês passado só podem ser editados até o dia 7 do mês atual.
 * Administradores nunca são bloqueados.
 */
export const isRecordLocked = (dateStr: string, userRole: UserRole) => {
  if (userRole === UserRole.ADMIN) return false;
  
  const now = new Date();
  const recordDate = new Date(dateStr);
  const currentDay = now.getDate();
  
  // Se a data do registro for futura ou do mês atual, não está bloqueado
  if (recordDate.getFullYear() > now.getFullYear() || 
     (recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() >= now.getMonth())) {
    return false;
  }

  // Se o dia atual for maior que 7, bloqueia tudo que não for do mês atual
  if (currentDay > 7) return true;

  // Se o dia for <= 7, permitimos editar o mês IMEDIATAMENTE anterior
  const isPreviousMonth = (
    (recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() === now.getMonth() - 1) ||
    (recordDate.getFullYear() === now.getFullYear() - 1 && recordDate.getMonth() === 11 && now.getMonth() === 0)
  );

  return !isPreviousMonth;
};
