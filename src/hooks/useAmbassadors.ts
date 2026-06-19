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
  
  // Estado do Ciclo Selecionado: Padrão para o mês atual
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });

  const fetchAmbassadors = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ambassadors')
        .select('*')
        .eq('cycle_month', selectedMonth);
      
      if (error) {
        showToast('Erro ao carregar embaixadores', 'error');
      } else if (data) {
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
    } catch (err: any) {
      console.warn('[useAmbassadors] Falha na rede ao carregar embaixadores:', err.message || err);
      // Tenta recuperar do cache offline local se disponível
      try {
        const cached = localStorage.getItem('capelania_offline_ambassadors');
        if (cached) {
          const parsed = JSON.parse(cached);
          const filtered = parsed.filter((d: any) => d.cycleMonth === selectedMonth || d.cycle_month === selectedMonth);
          setAmbassadors(filtered);
        }
      } catch (e: any) {
        if (console.debug) {
          console.debug("Cache offline de embaixadores não disponível:", e.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast, selectedMonth]);

  useEffect(() => {
    if (supabase) {
      fetchAmbassadors();
    }
  }, [fetchAmbassadors]);

  const deleteAmbassador = async (id: string) => {
    try {
      const { error } = await supabase.from('ambassadors').delete().eq('id', id);
      if (error) {
        showToast('Erro ao excluir', 'error');
      } else {
        showToast('Excluído com sucesso', 'success');
        setAmbassadors(prev => prev.filter(a => a.id !== id));
      }
    } catch (err) {
      showToast('Erro de conexão ao excluir embaixador', 'error');
    }
  };

  const deleteCycleAmbassadors = async (cycleMonth: string) => {
    try {
      const { error } = await supabase.from('ambassadors').delete().eq('cycle_month', cycleMonth);
      if (error) {
        showToast('Erro ao limpar ciclo', 'error');
        return false;
      }
      showToast('Ciclo limpo com sucesso', 'success');
      fetchAmbassadors();
      return true;
    } catch (err) {
      showToast('Erro de conexão ao limpar ciclo', 'error');
      return false;
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
        const nomeStr = String(nome).trim();

        // Validação: Matrícula deve ser apenas números
        if (!/^\d+$/.test(regId)) {
          throw new Error(`Matrícula inválida na linha: ${regId}. Apenas números são permitidos.`);
        }

        // Validação: Nome não pode conter números
        if (/\d/.test(nomeStr)) {
          throw new Error(`Nome inválido na linha: ${nomeStr}. Números não são permitidos em nomes.`);
        }

        let unit = Unit.HAB;
        let sectorIdMatch = null;
        
        const sectorMatch = proSectors.find(s => String(s.id) === String(idSetorExcel));

        if (sectorMatch) {
            unit = sectorMatch.unit;
            sectorIdMatch = sectorMatch.id;
        } else {
          // Validação: Setor deve ser identificado
          throw new Error(`Setor não identificado para o embaixador: ${nomeStr} (Setor ID: ${idSetorExcel}).`);
        }

        // CORREÇÃO BUG 4: Recuperação de data real de conclusão baseada na planilha (se disponível)
        let rowCompletionDate = biCreatedAt;
        const dataCol = rowKeys.find(k => {
          const norm = normalizeString(k);
          return norm === 'data' || norm === 'data_conclusao' || norm === 'data_de_conclusao';
        });
        const rawCompletionVal = getVal('conclusao') || getVal('completion') || (dataCol ? row[dataCol] : null);

        if (rawCompletionVal) {
          let parsedDate: Date | null = null;
          if (typeof rawCompletionVal === 'number') {
            // Número serial de data do Excel (25569 = diferença de dias entre 1900 e 1970)
            const millisecondsInDay = 86400000;
            parsedDate = new Date((rawCompletionVal - 25569) * millisecondsInDay);
          } else {
            const dateStr = String(rawCompletionVal).trim();
            // Formato comum no Brasil: DD/MM/YYYY
            const dmyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
            const match = dateStr.match(dmyRegex);
            if (match) {
              const day = parseInt(match[1], 10);
              const month = parseInt(match[2], 10);
              const year = parseInt(match[3], 10);
              parsedDate = new Date(year, month - 1, day, 12, 0, 0); // Evita fuso horário
            } else {
              const parsedTime = Date.parse(dateStr);
              if (!isNaN(parsedTime)) {
                parsedDate = new Date(parsedTime);
              }
            }
          }

          if (parsedDate && !isNaN(parsedDate.getTime())) {
            rowCompletionDate = parsedDate.toISOString();
          }
        }

        upsertMap.set(regId, {
          registration_id: regId,
          name: nomeStr,
          sector_id: sectorIdMatch, 
          unit: unit,
          completion_date: rowCompletionDate,
          cycle_month: cycleMonth,
          created_at: biCreatedAt,
          updated_at: new Date().toISOString()
        });
      }

      const toUpsert = Array.from(upsertMap.values());

      if (toUpsert.length > 0) {
        const { error } = await supabase.from('ambassadors').upsert(toUpsert, { onConflict: 'registration_id,cycle_month' });
        if (error) throw error;
        showToast(`${toUpsert.length} registros processados para o ciclo ${cycleMonth}!`, 'success');
        setImportPreview([]);
        setSelectedMonth(cycleMonth);
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
    deleteCycleAmbassadors,
    processImport
  };
};
