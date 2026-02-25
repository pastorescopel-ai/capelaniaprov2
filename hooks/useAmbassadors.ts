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

  const fetchAmbassadors = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('ambassadors')
      .select('*');
    
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
        completionDate: d.completion_date
      }));
      setAmbassadors(formatted);
    }
    setIsLoading(false);
  }, [showToast]);

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

  const processImport = async (onSuccess: () => void) => {
    setIsLoading(true);
    try {
      if (importPreview.length === 0) throw new Error("A planilha está vazia.");

      const headers = Object.keys(importPreview[0]).map(h => normalizeString(h));
      const requiredFields = ['data', 'matricula', 'nome', 'id_setor', 'setor'];
      const forbiddenFields = ['pg', 'pequenos grupos', 'pequeno grupo'];

      if (headers.some(h => forbiddenFields.some(f => h.includes(f)))) {
        throw new Error("A planilha contém colunas proibidas (PG ou Pequenos Grupos).");
      }

      const missingFields = requiredFields.filter(req => !headers.some(h => h.includes(req)));
      if (missingFields.length > 0) {
         throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}.`);
      }

      const upsertMap = new Map<string, any>();

      for (const row of importPreview) {
        const rowKeys = Object.keys(row);
        const getVal = (keyPart: string) => {
          const key = rowKeys.find(k => normalizeString(k).includes(keyPart));
          return key ? row[key] : null;
        };

        const rawDate = getVal('data');
        const matricula = getVal('matricula');
        const nome = getVal('nome');
        const idSetorExcel = getVal('id_setor');

        if (!matricula || !nome) continue;

        const regId = String(matricula).trim();

        let completionDate = new Date().toISOString();
        if (rawDate) {
            if (typeof rawDate === 'number') {
                const date = new Date(Math.round((rawDate - 25569)*86400*1000));
                completionDate = date.toISOString();
            } else {
                const parsed = new Date(rawDate);
                if (!isNaN(parsed.getTime())) completionDate = parsed.toISOString();
            }
        }

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
          completion_date: completionDate,
          updated_at: new Date().toISOString()
        });
      }

      const toUpsert = Array.from(upsertMap.values());

      if (toUpsert.length > 0) {
        const { error } = await supabase.from('ambassadors').upsert(toUpsert, { onConflict: 'registration_id' });
        if (error) throw error;
        showToast(`${toUpsert.length} registros processados!`, 'success');
        setImportPreview([]);
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
    fetchAmbassadors,
    deleteAmbassador,
    processImport
  };
};
