import { getTimestamp } from './formatters';

export const isActiveInMonth = (m: any, selectedMonth: string, monthBoundaries: { start: number; end: number }) => {
    const joinedAt = getTimestamp(m.joinedAt);
    const createdAt = getTimestamp(m.createdAt);
    const left = m.leftAt ? getTimestamp(m.leftAt) : Infinity;
    
    const migrationDate = new Date('2026-04-04').getTime();
    const currentMonthStr = new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
    const isCurrentMonth = selectedMonth === currentMonthStr;

    // EXCEÇÃO DE MIGRAÇÃO: Apenas se o createdAt foi resetado para HOJE
    // E não temos uma data de matrícula real (joinedAt)
    // E o mês selecionado é a partir do início da operação (Fevereiro/2026)
    const isMigrationReset = !isCurrentMonth && 
                             !joinedAt && 
                             createdAt >= migrationDate && 
                             left >= monthBoundaries.start &&
                             selectedMonth >= '2026-02-01';

    // Prioridade total à data de matrícula real
    const effectiveJoined = joinedAt || createdAt;
    const wasActiveInPeriod = (effectiveJoined <= monthBoundaries.end || isMigrationReset) && left >= monthBoundaries.start;

    // 1. Se o registro tem um ciclo específico
    if (m.cycleMonth) {
      // A matrícula deve persistir para os meses seguintes.
      // Se o ciclo de início é menor ou igual ao mês selecionado, ela continua ativa
      const isActuallyError = m.isError === true || m.leftAt === 1;
      const cycleVal = m.cycleMonth.substring(0, 7);
      const selectedVal = selectedMonth.substring(0, 7);
      return cycleVal <= selectedVal && left >= monthBoundaries.start && !isActuallyError;
    }

    // 2. Fallback para registros sem cycleMonth (Respeita isError e saída retroativa)
    const isActuallyError = m.isError === true || m.leftAt === 1;
    return wasActiveInPeriod && !isActuallyError;
};

// Nova função para verificar se o registro está ativo AGORA
export const isCurrentlyActive = (m: any) => {
    const now = Date.now();
    const joinedAt = getTimestamp(m.joinedAt || m.createdAt);
    const leftAt = m.leftAt ? getTimestamp(m.leftAt) : null;
    const isActuallyError = m.isError === true || m.leftAt === 1;

    // Está ativo se:
    // 1. Não houve erro
    // 2. A matrícula já ocorreu
    // 3. Ainda não ocorreu a saída (ou não tem saída)
    return !isActuallyError && 
           joinedAt <= now && 
           (leftAt === null || leftAt > now);
};

export const isLiveMembership = (m: any, selectedMonth: string, monthBoundaries: { start: number; end: number }, isOpenMonth: boolean): boolean => {
  const isActuallyError = m.isError === true || m.leftAt === 1;
  if (isActuallyError) return false;

  const cycleVal = m.cycleMonth ? m.cycleMonth.substring(0, 7) : '';
  const selectedVal = selectedMonth.substring(0, 7);
  const relevantToMonth = m.cycleMonth ? cycleVal <= selectedVal : true;
  if (!relevantToMonth) return false;

  if (!isOpenMonth) {
    // Mês passado/fechado: mantém a regra de "esteve ativo em algum ponto do mês" (auditoria histórica)
    const left = m.leftAt ? getTimestamp(m.leftAt) : Infinity;
    return left >= monthBoundaries.start;
  }

  // Mês corrente aberto: só é membro "atual" se não tiver saída, ou se a saída ainda não aconteceu
  if (!m.leftAt) return true;
  const left = getTimestamp(m.leftAt);
  return left > Date.now();
};
