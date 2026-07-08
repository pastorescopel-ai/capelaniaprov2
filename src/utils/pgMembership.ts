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
