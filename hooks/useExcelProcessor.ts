
import { useState, useCallback } from 'react';
import * as Xlsx from 'xlsx';
import { cleanID, normalizeString } from '../utils/formatters';
import { Unit } from '../types';

export interface ProcessedRow {
  id: string;
  name: string;
  unit: Unit;
  sectorIdRaw?: string;
  sectorNameRaw?: string;
  sectorIdLinked?: string | null;
  sectorStatus?: 'ok' | 'error' | 'new';
  linkedSectorName?: string;
}

export const useExcelProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const normalizeHeader = (h: string) => 
    String(h || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,º°ª#]/g, "").replace(/\s+/g, " ");

  const findColumnIndex = (headers: string[], synonyms: string[]) => {
      let idx = headers.findIndex(h => synonyms.some(s => h === s));
      if (idx !== -1) return idx;
      return headers.findIndex(h => synonyms.some(s => h.includes(s)));
  };

  const validateSheetType = (headers: string[], tab: string): { valid: boolean; error?: string } => {
      const hasStaffCols = headers.some(h => h.includes('MATRICULA') || h.includes('CRACHA') || h.includes('FUNCIONARIO') || h.includes('COLABORADOR'));
      const hasSectorCols = headers.some(h => h.includes('DEPARTAMENTO') || (h.includes('SETOR') && !h.includes('ID')) || h.includes('CENTRO DE CUSTO'));
      const hasID = headers.some(h => h.includes('ID') || h.includes('COD'));
      const hasPGIdentifier = headers.some(h => h.includes('PG') || h.includes('GRUPO') || h.includes('NOME') || h.includes('LIDER'));

      if (tab === 'staff') {
          if (!hasStaffCols) return { valid: false, error: "Arquivo inválido para Colaboradores. Necessário coluna 'Matrícula', 'Crachá' ou 'Funcionário'." };
      }
      if (tab === 'sectors') {
          if (!hasSectorCols) return { valid: false, error: "Arquivo inválido para Setores. Necessário coluna 'Nome Setor' ou 'Departamento'." };
          if (hasStaffCols) return { valid: false, error: "Segurança: Planilha de Colaboradores detectada. Não importe na aba de Setores." };
      }
      if (tab === 'pgs') {
          if (!hasID || !hasPGIdentifier) return { valid: false, error: "Arquivo inválido para PGs. Necessário colunas 'ID' e 'PG' (ou Nome/Grupo)." };
          if (hasStaffCols) return { valid: false, error: "Segurança: Planilha contém dados de Colaboradores. Proibido em PGs." };
          if (hasSectorCols) return { valid: false, error: "Segurança: Planilha contém dados de Setores. Proibido em PGs." };
      }
      return { valid: true };
  };

  const processExcelFile = useCallback((
    file: File, 
    activeTab: 'staff' | 'sectors' | 'pgs', 
    activeUnit: Unit,
    proData: any
  ): Promise<ProcessedRow[]> => {
    return new Promise((resolve, reject) => {
      setIsProcessing(true);
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = Xlsx.read(data, { type: 'binary' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const allRows = Xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          
          if (allRows.length < 2) throw new Error("Planilha vazia ou inválida.");

          let dataStartRow = -1;
          let headers: string[] = [];

          for(let i = 0; i < Math.min(allRows.length, 50); i++){
              const row = allRows[i].map(c => normalizeHeader(String(c)));
              const hasKeywords = row.some(cell => cell.includes('SETOR') || cell.includes('MATRICULA') || cell.includes('PG') || cell.includes('GRUPO') || cell.includes('DEPARTAMENTO') || cell.includes('ID') || cell.includes('NOME'));
              if(hasKeywords){ headers = row; dataStartRow = i + 1; break; }
          }
          
          if (dataStartRow === -1) throw new Error("Não foi possível identificar as colunas.");

          const validation = validateSheetType(headers, activeTab);
          if (!validation.valid) throw new Error(validation.error);

          const idxId = findColumnIndex(headers, ['ID', 'COD', 'MATRICULA', 'MAT', 'CRACHA', 'REGISTRO']);
          const idxName = findColumnIndex(headers, ['NOME', 'COLABORADOR', 'FUNCIONARIO', 'SETOR', 'PG', 'GRUPO', 'DESCRIÇÃO']);
          const idxSecId = findColumnIndex(headers, ['ID SETOR', 'COD SETOR', 'COD DEPARTAMENTO', 'CODIGO SETOR']);
          const idxSecName = findColumnIndex(headers, ['NOME SETOR', 'SETOR', 'DEPARTAMENTO']);

          if (idxId === -1 || idxName === -1) throw new Error("Colunas obrigatórias (ID e Nome) não encontradas.");

          const dataRows = allRows.slice(dataStartRow);
          const otherUnit = activeUnit === 'HAB' ? 'HABA' : 'HAB';
          
          // Validação de Unidade (Unit Consistency Check)
          for (let i = 0; i < Math.min(dataRows.length, 20); i++) {
              const idVal = String(dataRows[i][idxId] || '').toUpperCase();
              if (idVal.includes(otherUnit + '-') || idVal.includes(otherUnit + ' ')) {
                  throw new Error(`ERRO CRÍTICO: Planilha contém registros da unidade ${otherUnit}. Abortando.`);
              }
          }

          const seenIds = new Set<string>();
          const res: ProcessedRow[] = [];

          dataRows.forEach(row => {
              const rawId = cleanID(row[idxId]); 
              const name = String(row[idxName]||'').trim();
              const finalId = rawId || (activeTab === 'pgs' ? cleanID(name) : ''); 

              if(!finalId || seenIds.has(finalId)) return;
              seenIds.add(finalId);

              const item: ProcessedRow = { id: finalId, name, unit: activeUnit, sectorStatus: 'ok' };

              if (activeTab === 'staff') {
                  const sIdRaw = row[idxSecId] ? cleanID(row[idxSecId]) : '';
                  const sNameRaw = row[idxSecName] ? String(row[idxSecName]).trim() : '';
                  item.sectorIdRaw = sIdRaw;
                  item.sectorNameRaw = sNameRaw;
                  
                  let match = null;
                  if (sIdRaw && proData) match = proData.sectors.find((s:any) => s.unit === activeUnit && cleanID(s.id) === sIdRaw);
                  if (!match && sNameRaw && proData) {
                      const norm = normalizeString(sNameRaw);
                      match = proData.sectors.find((s:any) => s.unit === activeUnit && normalizeString(s.name) === norm);
                  }

                  if (match) {
                      item.sectorIdLinked = match.id;
                      item.linkedSectorName = match.name;
                      item.sectorStatus = 'ok';
                  } else {
                      item.sectorStatus = 'error'; 
                  }
              }
              res.push(item);
          });

          resolve(res);
        } catch (err: any) {
          reject(err);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsBinaryString(file);
    });
  }, []);

  return { processExcelFile, isProcessing };
};
