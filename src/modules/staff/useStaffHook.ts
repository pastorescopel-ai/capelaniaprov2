import { useState } from 'react';
import { User } from '../../types';
import { useApp } from '../../hooks/useApp';

import { ensureISODate } from '../../utils/formatters';

export const useStaff = (currentUser: User) => {
  const { saveRecord, deleteRecord, visitRequests = [] } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveVisit = async (visit: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const now = Date.now();
      const today = new Date().toLocaleDateString('en-CA');
      
      // 1. Identificar se há um agendamento vinculado
      let originalRequestId = visit.isMission ? visit.id : null;
      
      // 2. BUSCA INTELIGENTE: Se não veio pelo link, procura um agendamento compatível para hoje (Visita indiviual)
      if (!originalRequestId) {
        const matchingRequest = (visitRequests as any[]).find(req => 
          ['scheduled', 'assigned', 'confirmed'].includes(req.status) && 
          !req.pgName && // Garante que é uma visita individual e não PG
          req.assignedChaplainId === currentUser.id &&
          ensureISODate(req.date) === today
        );
        if (matchingRequest) originalRequestId = matchingRequest.id;
      }

      // 3. Clone para salvar como Visita
      const visitToSave = { ...visit };
      if (visit.isMission) {
        delete visitToSave.isMission;
        visitToSave.id = crypto.randomUUID();
      }

      const success = await saveRecord('staffVisits', {
        ...visitToSave,
        createdAt: visit.createdAt || now,
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

      setError('Erro ao salvar visita');
      return { success: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      return { success: false, error: err };
    } finally {
      setIsSaving(false);
    }
  };

  const deleteVisit = async (id: string) => {
    try {
      const success = await deleteRecord('staffVisits', id);
      return { success };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  return {
    saveVisit,
    deleteVisit,
    isSaving,
    error,
    currentUser
  };
};
