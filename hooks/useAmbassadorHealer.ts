import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Ambassador } from '../../types';
import { useToast } from '../contexts/ToastContext';

export const useAmbassadorHealer = () => {
  const { showToast } = useToast();
  const [invalidAmbassadors, setInvalidAmbassadors] = useState<Ambassador[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchInvalidAmbassadors = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('ambassadors').select('*');
      if (error) throw error;

      const invalid = data.filter((d: any) => {
        const regId = String(d.registration_id || '').trim();
        const nomeStr = String(d.name || '').trim();
        
        const hasInvalidRegId = !/^\d+$/.test(regId);
        const hasInvalidName = /\d/.test(nomeStr);
        const hasNoSector = !d.sector_id;

        return hasInvalidRegId || hasInvalidName || hasNoSector;
      });

      setInvalidAmbassadors(invalid);
    } catch (e) {
      console.error("Erro ao buscar embaixadores inválidos", e);
      showToast("Erro ao carregar embaixadores inválidos.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const deleteInvalidAmbassadors = async () => {
    const ids = invalidAmbassadors.map(a => a.id);
    if (ids.length === 0) return;

    const { error } = await supabase.from('ambassadors').delete().in('id', ids);
    if (error) {
      showToast('Erro ao excluir embaixadores inválidos', 'error');
    } else {
      showToast(`${ids.length} embaixadores excluídos com sucesso`, 'success');
      setInvalidAmbassadors([]);
    }
  };

  return {
    invalidAmbassadors,
    isLoading,
    fetchInvalidAmbassadors,
    deleteInvalidAmbassadors
  };
};
