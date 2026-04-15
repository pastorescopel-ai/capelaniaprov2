import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Ambassador } from '../../types';
import { useToast } from '../contexts/ToastContext';

export const useAmbassadorHealer = () => {
  const { showToast } = useToast();
  const [invalidAmbassadors, setInvalidAmbassadors] = useState<Ambassador[]>([]);
  const [duplicateAmbassadors, setDuplicateAmbassadors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchInvalidAmbassadors = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('ambassadors').select('*');
      if (error) throw error;

      // 1. Apenas erros de formato/dados faltantes (O que o "Apagar Todos" deve limpar)
      const invalid = data.filter((d: any) => {
        const regId = String(d.registration_id || '').trim();
        const nomeStr = String(d.name || '').trim();
        
        const hasInvalidRegId = !/^\d+$/.test(regId);
        const hasInvalidName = /\d/.test(nomeStr);
        const hasNoSector = !d.sector_id;

        return hasInvalidRegId || hasInvalidName || hasNoSector;
      });

      // 2. Detecção de duplicidades (Apenas se for a mesma matrícula no MESMO mês)
      const regMap = new Map<string, any[]>();
      data.forEach((d: any) => {
        const regId = String(d.registration_id || '').trim();
        const month = String(d.cycleMonth || '').trim();
        
        if (regId && /^\d+$/.test(regId) && month) {
          const key = `${regId}_${month}`;
          if (!regMap.has(key)) regMap.set(key, []);
          regMap.get(key)!.push(d);
        }
      });

      const duplicates: any[] = [];
      regMap.forEach((list, key) => {
        if (list.length > 1) {
          const [regId, month] = key.split('_');
          duplicates.push({
            registration_id: regId,
            month: month,
            count: list.length,
            records: list
          });
        }
      });

      setInvalidAmbassadors(invalid);
      setDuplicateAmbassadors(duplicates);
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

  const deleteAmbassador = async (id: string) => {
    const { error } = await supabase.from('ambassadors').delete().eq('id', id);
    if (error) {
      showToast('Erro ao excluir embaixador', 'error');
    } else {
      showToast('Embaixador excluído com sucesso', 'success');
      fetchInvalidAmbassadors();
    }
  };

  return {
    invalidAmbassadors,
    duplicateAmbassadors,
    isLoading,
    fetchInvalidAmbassadors,
    deleteInvalidAmbassadors,
    deleteAmbassador
  };
};
