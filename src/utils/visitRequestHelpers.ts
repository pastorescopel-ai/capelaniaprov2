
import { SmallGroup, VisitRequest } from '../types';
import { ensureISODate, normalizeString } from './formatters';

/**
 * Regra única de "essa escala já foi registrada" -- usada tanto pelo sino de notificações
 * (NotificationCenter) quanto pelo card "Escala de Visitas PG" do Dashboard
 * (useVisitRequestsWidget). Antes cada um tinha a sua própria versão dessa checagem, com
 * critérios levemente diferentes (o sino exigia um capelão designado e ignorava o turno; o
 * card comparava o turno mas aceitava sem capelão designado) -- isso fazia o sino mostrar uma
 * contagem de pendentes diferente do que realmente aparecia no card, mesmo sem nenhuma
 * diferença de unidade envolvida.
 */
export const isVisitRequestRegistered = (req: VisitRequest, smallGroups: SmallGroup[]): boolean => {
  const reqDate = ensureISODate(req.date);
  const normName = normalizeString(req.pgName);
  if (!reqDate || !normName) return false;

  let reqShift = 'Manhã';
  if (req.scheduledTime) {
    const hour = parseInt(req.scheduledTime.split(':')[0], 10);
    if (hour >= 18) reqShift = 'Noite';
    else if (hour >= 12) reqShift = 'Tarde';
  }
  const normReqShift = normalizeString(reqShift);

  return smallGroups.some(sg => {
    const sgDate = ensureISODate(sg.date);
    if (sgDate !== reqDate) return false;
    if (normalizeString(sg.groupName) !== normName) return false;
    if (sg.unit !== req.unit) return false;

    const shiftMatches = normalizeString(sg.shift) === normReqShift;
    // Se a escala não tem capelão designado, qualquer registro do PG/dia/turno conta como
    // "já feito"; se tem, só conta o registro feito por esse mesmo capelão.
    const userMatches = !req.assignedChaplainId || String(sg.userId) === String(req.assignedChaplainId);
    return shiftMatches && userMatches;
  });
};
