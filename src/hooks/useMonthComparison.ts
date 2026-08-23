import { useMemo } from 'react';
import { Unit } from '../types';
import { ensureISODate } from '../utils/formatters';

interface WithDateUserUnit {
  userId: string;
  date: string;
  unit: Unit;
}

// Compara quantos registros o capelão logado fez ESTE mês vs no mês passado, dentro da
// unidade que ele está vendo agora -- usado nos 4 formulários de registro pra mostrar "vs. mês
// anterior" logo no cabeçalho, sem precisar ir em Relatórios pra saber se o ritmo caiu.
// `countFn` deixa o chamador decidir COMO contar (ex: Classe Bíblica dedupe por sessão via
// countUniqueClasses, os outros 3 é só o tamanho da lista filtrada do mês).
export function useMonthComparison<T extends WithDateUserUnit>(
  allHistory: T[],
  userId: string,
  unit: Unit,
  countFn: (items: T[]) => number = (items) => items.length
) {
  return useMemo(() => {
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const mine = (allHistory || []).filter(i => i.userId === userId && (i.unit || Unit.HAB) === unit);
    const curItems = mine.filter(i => ensureISODate(i.date)?.startsWith(curKey));
    const prevItems = mine.filter(i => ensureISODate(i.date)?.startsWith(prevKey));

    const current = countFn(curItems);
    const prev = countFn(prevItems);
    const deltaPct = prev > 0 ? Math.round(((current - prev) / prev) * 100) : (current > 0 ? 100 : 0);
    const prevMonthLabel = prevDate.toLocaleDateString('pt-BR', { month: 'long' });

    return { current, prev, deltaPct, prevMonthLabel };
  }, [allHistory, userId, unit, countFn]);
}
