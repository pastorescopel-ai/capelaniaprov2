import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Ambassador, Unit } from '../types';
import { useToast } from '../contexts/ToastContext';
import { normalizeString } from '../utils/formatters';

export const useAmbassadors = (proSectors: any[]) => {
  const { showToast } = useToast();
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  
  // Estado do Ciclo Selecionado (Padrão: Primeiro dia do mês atual)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });

  const fetchAmbassadors = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('ambassadors')
      .select('*')
      .eq('cycle_month', selectedMonth);
    
    if (error) {
      showToast('Erro ao carregar embaixadores', 'error');
    } else {
      const formatted: Ambassador[] = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        registrationId: d.registration_id,
        email: d.email,
        sectorId: d.sector_id ? String(d.sector_id) : null,
        unit: d.unit,
        completionDate: d.completion_date,
        cycleMonth: d.cycle_month,
        createdAt: d.created_at
      }));
      setAmbassadors(formatted);
    }
    setIsLoading(false);
  }, [showToast, selectedMonth]);

  useEffect(() => {
    fetchAmbassadors();
  }, [fetchAmbassadors]);

  const deleteAmbassador = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este embaixador?')) return;
    const { error } = await supabase.from('ambassadors').delete().eq('id', id);
    if (error) showToast('Erro ao excluir', 'error');
    else {
      showToast('Excluído com sucesso', 'success');
      setAmbassadors(prev => prev.filter(a => a.id !== id));
    }
  };

  const processImport = async (onSuccess: () => void, cycleMonth: string) => {
    setIsLoading(true);
    try {
      if (importPreview.length === 0) throw new Error("A planilha está vazia.");
      if (!cycleMonth) throw new Error("Selecione o mês de referência.");

      const headers = Object.keys(importPreview[0]).map(h => normalizeString(h));
      const requiredFields = ['matricula', 'nome', 'id_setor', 'setor'];
      const forbiddenFields = ['pg', 'pequenos grupos', 'pequeno grupo'];

      if (headers.some(h => forbiddenFields.some(f => h.includes(f)))) {
        throw new Error("A planilha contém colunas proibidas (PG ou Pequenos Grupos).");
      }

      const missingFields = requiredFields.filter(req => !headers.some(h => h.includes(req)));
      if (missingFields.length > 0) {
         throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}.`);
      }

      const upsertMap = new Map<string, any>();

      // Para o BI: Definimos o created_at como o primeiro dia do mês de competência
      // Isso garante que o BI agrupe corretamente por mês.
      const competenceDate = new Date(cycleMonth + 'T12:00:00Z');
      const biCreatedAt = competenceDate.toISOString();

      for (const row of importPreview) {
        const rowKeys = Object.keys(row);
        const getVal = (keyPart: string) => {
          const key = rowKeys.find(k => normalizeString(k).includes(keyPart));
          return key ? row[key] : null;
        };

        const matricula = getVal('matricula');
        const nome = getVal('nome');
        const idSetorExcel = getVal('id_setor');

        if (!matricula || !nome) continue;

        const regId = String(matricula).trim();

        let unit = Unit.HAB;
        let sectorIdMatch = null;
        
        const sectorMatch = proSectors.find(s => String(s.id) === String(idSetorExcel));

        if (sectorMatch) {
            unit = sectorMatch.unit;
            sectorIdMatch = sectorMatch.id;
        }

        upsertMap.set(regId, {
          registration_id: regId,
          name: String(nome).trim(),
          sector_id: sectorIdMatch, 
          unit: unit,
          completion_date: biCreatedAt, // Usamos a data de competência como data de conclusão também
          cycle_month: cycleMonth,
          created_at: biCreatedAt, // Crucial para o BI
          updated_at: new Date().toISOString()
        });
      }

      const toUpsert = Array.from(upsertMap.values());

      if (toUpsert.length > 0) {
        // Agora o conflito é por (registration_id, cycle_month)
        const { error } = await supabase.from('ambassadors').upsert(toUpsert, { onConflict: 'registration_id,cycle_month' });
        if (error) throw error;
        showToast(`${toUpsert.length} registros processados para o ciclo ${cycleMonth}!`, 'success');
        setImportPreview([]);
        setSelectedMonth(cycleMonth); // Muda a visão para o mês importado
        fetchAmbassadors();
        onSuccess();
      } else {
        showToast('Nenhum dado válido encontrado.', 'warning');
      }
    } catch (error: any) {
      showToast(`Erro: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    ambassadors,
    isLoading,
    importPreview,
    setImportPreview,
    selectedMonth,
    setSelectedMonth,
    fetchAmbassadors,
    deleteAmbassador,
    processImport
  };
};
