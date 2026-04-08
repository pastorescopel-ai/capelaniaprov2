import { useState } from 'react';
import { User } from '../../types';
import { useApp } from '../../hooks/useApp';

export const useStaff = (currentUser: User) => {
  const { saveRecord, deleteRecord } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveVisit = async (visit: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const success = await saveRecord('staffVisits', visit);
      if (!success) {
        setError('Erro ao salvar visita');
        return { success: false };
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
