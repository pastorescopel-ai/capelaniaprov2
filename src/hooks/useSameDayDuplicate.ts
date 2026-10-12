import { useMemo, useState } from 'react';

// Acha, na lista de lançamentos, um registro do MESMO dia que bate com o que está sendo digitado
// (o `matcher` decide o que é "igual" em cada formulário). Só avisa -- "Lançar outro mesmo
// assim" dispensa o aviso daquele registro; um registro diferente volta a avisar.
export function useSameDayDuplicate<T extends { id: string; date?: string }>(
  records: T[],
  matcher: (r: T) => boolean,
  enabled: boolean,
  deps: unknown[]
) {
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const match = useMemo(() => {
    if (!enabled) return null;
    return records.find(matcher) || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, enabled, ...deps]);
  const visible = match && match.id !== dismissedId ? match : null;
  return { duplicate: visible, dismiss: () => match && setDismissedId(match.id) };
}

export const sameDay = (a?: string, b?: string) => !!a && !!b && String(a).slice(0, 10) === String(b).slice(0, 10);

export const mergeById = <T extends { id: string }>(...lists: T[][]): T[] => {
  const m = new Map<string, T>();
  lists.forEach(l => (l || []).forEach(r => { if (!m.has(r.id)) m.set(r.id, r); }));
  return Array.from(m.values());
};
