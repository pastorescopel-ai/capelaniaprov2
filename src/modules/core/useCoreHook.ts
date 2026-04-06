import { useState } from 'react';
import { User } from '../../types';
import { CoreService } from '../../services/core.service';

export const useCore = (currentUser: User) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveUser = async (user: User) => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await CoreService.saveUser(user);
      if (!result.success) {
        setError(result.error?.message || 'Erro ao salvar usuário');
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
    saveUser,
    isSaving,
    error,
    currentUser
  };
};
