import { useState } from 'react';
import { User } from '../../types';
import { PGService } from '../../services/pg.service';

export const usePG = (currentUser: User) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveSmallGroup = async (pg: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await PGService.saveSmallGroup(pg);
      if (!result.success) {
        setError(result.error?.message || 'Erro ao salvar pequeno grupo');
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

  return {
    saveSmallGroup,
    isSaving,
    error,
    currentUser
  };
};
