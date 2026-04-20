import { useState } from 'react';
import { User } from '../../types';
import { useApp } from '../../hooks/useApp';

import { normalizeString, ensureISODate } from '../../utils/formatters';

export const usePG = (currentUser: User) => {
  const { saveRecord, visitRequests = [] } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveSmallGroup = async (pg: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const now = Date.now();
      const today = new Date().toLocaleDateString('en-CA');
      
      // 1. Identificar se há um agendamento vinculado
      let originalRequestId = pg.isMission ? pg.id : null;
      
      // 2. BUSCA INTELIGENTE: Se não veio pelo link, procura um agendamento compatível para hoje
      if (!originalRequestId && pg.groupName) {
        const normGroupName = normalizeString(pg.groupName);
        const matchingRequest = (visitRequests as any[]).find(req => 
          ['scheduled', 'assigned', 'confirmed'].includes(req.status) && 
          normalizeString(req.pgName) === normGroupName &&
          req.assignedChaplainId === currentUser.id &&
          (ensureISODate(req.date) === today)
        );
        if (matchingRequest) originalRequestId = matchingRequest.id;
      }

      // 3. Clone para salvar como Pequeno Grupo
      const pgToSave = { ...pg };
      if (pg.isMission) {
        delete pgToSave.isMission;
        pgToSave.id = crypto.randomUUID();
      }

      const success = await saveRecord('smallGroups', {
        ...pgToSave,
        createdAt: pg.createdAt || now,
        updatedAt: now
      });

      if (success) {
        // 4. Baixa automática no agendamento
        if (originalRequestId) {
          await saveRecord('visitRequests', {
            id: originalRequestId,
            status: 'completed',
            updatedAt: now
          });
        }
        return { success: true };
      }

      setError('Erro ao salvar pequeno grupo');
      return { success: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      return { success: false, error: err };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    saveSmallGroup,
    isSaving,
    error,
    currentUser
  };
};
