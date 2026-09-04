import { useState } from 'react';
import { User } from '../../types';
import { useApp } from '../../hooks/useApp';
import { DataRepository } from '../../services/dataRepository';

export const useStaff = (currentUser: User) => {
  const { saveRecord, deleteRecord } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveVisit = async (visit: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const now = Date.now();
      const success = await saveRecord('staffVisits', {
        ...visit,
        createdAt: visit.createdAt || now,
        updatedAt: now
      });
      if (!success) {
        const detail = DataRepository.getLastError();
        const message = detail?.message || 'Erro ao salvar visita';
        setError(message);
        return { success: false, error: { message } };
      }
      return { success: true };
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
