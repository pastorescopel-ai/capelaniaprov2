import { useState } from 'react';
import { User } from '../../types';
import { StaffService } from '../../services/staff.service';

export const useStaff = (currentUser: User) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveVisit = async (visit: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await StaffService.saveVisit(visit);
      if (!result.success) {
        setError(result.error?.message || 'Erro ao salvar visita');
      }
      return result;
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
      return await StaffService.deleteVisit(id);
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
