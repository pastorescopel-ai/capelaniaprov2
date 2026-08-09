
import { UserRole } from '../types';
import { getFifthBusinessDay } from './formatters';

/**
 * Regra: Capelão pode editar registros do mês atual livremente.
 * Registros do mês passado só podem ser editados até o 5º dia útil do mês atual.
 * Administradores nunca são bloqueados — são os únicos que podem ajustar meses anteriores
 * fora desse prazo (não existe mais delegação de permissão para outros usuários).
 */
export const isRecordLocked = (
  dateStr: string,
  userRole: UserRole
) => {
  if (userRole === UserRole.ADMIN) return false;

  const now = new Date();
  const recordDate = new Date(dateStr);

  // Se a data do registro for futura ou do mês atual, não está bloqueado
  if (recordDate.getFullYear() > now.getFullYear() ||
     (recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() >= now.getMonth())) {
    return false;
  }

  // Verifica se estamos dentro do prazo do 5º dia útil do mês atual
  const fifthBusinessDay = getFifthBusinessDay(now.getFullYear(), now.getMonth());
  const isGracePeriod = now <= fifthBusinessDay;
  
  // Se ainda estivermos no prazo, permitimos editar o mês IMEDIATAMENTE anterior
  const isPreviousMonth = (
    (recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() === now.getMonth() - 1) ||
    (recordDate.getFullYear() === now.getFullYear() - 1 && recordDate.getMonth() === 11 && now.getMonth() === 0)
  );

  if (isGracePeriod && isPreviousMonth) {
      return false;
  }

  return true;
};

/**
 * Valida se um número de WhatsApp é válido.
 * Não permite sequências de apenas um dígito (ex: 0000000000 ou 9999999999).
 */
export const isValidWhatsApp = (value: string) => {
  const nums = String(value || "").replace(/\D/g, "");
  if (nums.length === 0) return false;
  if (nums.length < 10) return false;
  
  // Verifica se todos os dígitos são iguais (ex: 0000000000, 9999999999)
  const allSame = /^(\d)\1+$/.test(nums);
  if (allSame) return false;
  
  return true;
};
