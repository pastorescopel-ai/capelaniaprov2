import { useState } from 'react';
import { User } from '../../types';
import { BibleService } from '../../services/bible.service';

export const useBibleModule = (currentUser: User) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveStudy = async (study: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await BibleService.saveStudy(study);
      if (!result.success) {
        setError(result.error?.message || 'Erro ao salvar estudo bíblico');
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

  const saveClass = async (bibleClass: any) => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await BibleService.saveClass(bibleClass);
      if (!result.success) {
        setError(result.error?.message || 'Erro ao salvar classe bíblica');
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
    saveStudy,
    saveClass,
    isSaving,
    error,
    currentUser
  };
};
