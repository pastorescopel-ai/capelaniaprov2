import { useState } from 'react';
import { User } from '../../types';
import { useApp } from '../../hooks/useApp';

export const usePG = (currentUser: User) => {
  const { saveRecord } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveSmallGroup = async (pg: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const now = Date.now();
      const success = await saveRecord('smallGroups', {
        ...pg,
        createdAt: pg.createdAt || now,
        updatedAt: now
      });
      if (!success) {
        setError('Erro ao salvar pequeno grupo');
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

  return {
    saveSmallGroup,
    isSaving,
    error,
    currentUser
  };
};
