
import { UserRole, EditAuthorization } from '../types';
import { getFifthBusinessDay } from './formatters';

/**
 * Regra: Capelão pode editar registros do mês atual livremente.
 * Registros do mês passado só podem ser editados até o 5º dia útil do mês atual.
 * Administradores nunca são bloqueados.
 */
export const isRecordLocked = (
  dateStr: string, 
  userRole: UserRole, 
  tab?: string, 
  authorizations: EditAuthorization[] = []
) => {
  if (userRole === UserRole.ADMIN) return false;
  
  const now = new Date();
  const recordDate = new Date(dateStr);
  
  console.log(`[DEBUG] isRecordLocked: dateStr=${dateStr}, recordDate=${recordDate}, now=${now}, userRole=${userRole}, tab=${tab}, authorizations.length=${authorizations.length}`);

  // Se a data do registro for futura ou do mês atual, não está bloqueado
  if (recordDate.getFullYear() > now.getFullYear() || 
     (recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() >= now.getMonth())) {
    console.log(`[DEBUG] isRecordLocked: Not locked (current or future month)`);
    return false;
  }

  // Verifica autorizações especiais
  let isAuthorized = false;
  if (tab && authorizations.length > 0) {
    console.log(`[DEBUG] isRecordLocked: Checking authorizations. tab=${tab}, authorizations.length=${authorizations.length}`);
    const activeAuth = authorizations.find(auth => {
      const expiry = new Date(auth.expiryDate);
      if (now > expiry) return false;
      
      const unlockMonth = new Date(auth.monthToUnlock);
      const isSameMonth = recordDate.getUTCFullYear() === unlockMonth.getUTCFullYear() && 
                          recordDate.getUTCMonth() === unlockMonth.getUTCMonth();
      
      return isSameMonth && auth.allowedTabs.includes(tab || '');
    });

    if (activeAuth) {
        console.log(`[DEBUG] isRecordLocked: Authorized`);
        isAuthorized = true;
    }
  }

  if (isAuthorized) return false;

  // Verifica se estamos dentro do prazo do 5º dia útil do mês atual
  const fifthBusinessDay = getFifthBusinessDay(now.getFullYear(), now.getMonth());
  const isGracePeriod = now <= fifthBusinessDay;
  
  // Se ainda estivermos no prazo, permitimos editar o mês IMEDIATAMENTE anterior
  const isPreviousMonth = (
    (recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() === now.getMonth() - 1) ||
    (recordDate.getFullYear() === now.getFullYear() - 1 && recordDate.getMonth() === 11 && now.getMonth() === 0)
  );

  if (isGracePeriod && isPreviousMonth) {
      console.log(`[DEBUG] isRecordLocked: Not locked (grace period)`);
      return false;
  }

  console.log(`[DEBUG] isRecordLocked: Locked (past grace period and not authorized)`);
  return true;
};
