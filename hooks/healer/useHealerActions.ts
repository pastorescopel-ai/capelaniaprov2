import { normalizeString } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';

export const useHealerActions = (
  appData: any,
  state: any
) => {
  const { 
    bibleClasses, bibleStudies, smallGroups, staffVisits, visitRequests,
    proStaff, proPatients, proProviders, proSectors, proGroups,
    unifyStudentIdentity, createAndLinkIdentity, healSectorConnection, 
    linkStudySessionIdentity, saveRecord, mergePGs, deleteRecord, loadFromCloud,
    syncPGMembershipCycle
  } = appData;

  const {
    targetMap, setTargetMap, studyTargetMap, personTypeMap, 
    setResolvedItems, setIsProcessing
  } = state;

  const { showToast } = useToast();

  const handleProcessPerson = async (orphanName: string) => {
      const selectedType = personTypeMap[orphanName] || 'Colaborador';

      if (selectedType === 'Colaborador' || selectedType === 'Ex-Colaborador') {
          const targetLabel = targetMap[orphanName];
          if (!targetLabel) { showToast(`Selecione o ${selectedType} correspondente.`, "warning"); return; }
          const targetId = targetLabel.match(/\((\d+)\)/)?.[1];
          if (!targetId) { showToast("Matrícula inválida.", "warning"); return; }

          setIsProcessing(true);
          try {
              const result = await unifyStudentIdentity(orphanName, targetId);
              
              const targetStaff = proStaff.find((s: any) => String(s.id).includes(targetId));
              if (targetStaff) {
                  const normOrphan = normalizeString(orphanName);
                  
                  const groupsToUpdate = proGroups.filter((g: any) => normalizeString(g.leader) === normOrphan || normalizeString(g.currentLeader) === normOrphan);
                  for (const g of groupsToUpdate) {
                      await saveRecord('proGroups', { 
                          ...g, 
                          leader: normalizeString(g.leader) === normOrphan ? targetStaff.name : g.leader,
                          currentLeader: normalizeString(g.currentLeader) === normOrphan ? targetStaff.name : g.currentLeader,
                          leaderPhone: targetStaff.whatsapp || g.leaderPhone
                      });
                  }

                  const historyToUpdate = smallGroups.filter((sg: any) => normalizeString(sg.leader) === normOrphan);
                  for (const sg of historyToUpdate) {
                      await saveRecord('smallGroups', { ...sg, leader: targetStaff.name });
                  }

                  // Correção retroativa do participantType para registros que foram salvos incorretamente como Prestador/Paciente
                  const studiesToUpdate = bibleStudies.filter((s: any) => normalizeString(s.name) === normOrphan && s.participantType !== 'Colaborador');
                  for (const s of studiesToUpdate) {
                      await saveRecord('bibleStudies', { ...s, participantType: 'Colaborador' });
                  }

                  const visitsToUpdate = staffVisits.filter((v: any) => normalizeString(v.staffName) === normOrphan && v.participantType !== 'Colaborador');
                  for (const v of visitsToUpdate) {
                      await saveRecord('staffVisits', { ...v, participantType: 'Colaborador' });
                  }
              }

              showToast(`Cura profunda concluída! ${result}`, "success");
              setResolvedItems((prev: any) => new Set(prev).add(orphanName));
              setResolvedItems((prev: any) => new Set(prev).add(normalizeString(orphanName)));
              setTargetMap((prev: any) => { const n = {...prev}; delete n[orphanName]; return n; });
          } catch (e: any) { showToast("Erro: " + e.message, "error"); } 
          finally { setIsProcessing(false); }

      } else if (selectedType === 'Paciente' || selectedType === 'Prestador') {
          const targetName = targetMap[orphanName];
          
          setIsProcessing(true);
          try {
              if (targetName) {
                  const list = selectedType === 'Paciente' ? proPatients : proProviders;
                  const existing = list.find((p: any) => p.name === targetName);
                  if (!existing) throw new Error(`${selectedType} selecionado não encontrado.`);
                  
                  const result = await unifyStudentIdentity(orphanName, existing.id);
                  showToast(`Vínculo universal realizado: ${result}`, "success");
              } else {
                  if (!confirm(`Confirma criar novo cadastro de ${selectedType} para "${orphanName}"?`)) {
                      setIsProcessing(false);
                      return;
                  }
                  const result = await createAndLinkIdentity(orphanName, selectedType);
                  showToast(result, "success");
              }
              setResolvedItems((prev: any) => new Set(prev).add(orphanName));
          } catch (e: any) { showToast("Erro: " + e.message, "error"); }
          finally { setIsProcessing(false); }
      }
  };

  const handleHealSector = async (badName: string) => {
      const targetLabel = targetMap[badName];
      const selectedSector = proSectors.find((s: any) => s.name === targetLabel);
      if (!selectedSector) { showToast("Selecione um setor oficial da lista.", "warning"); return; }

      setIsProcessing(true);
      try {
          const result = await healSectorConnection(badName, selectedSector.id);
          showToast(result, "success");
          setResolvedItems((prev: any) => new Set(prev).add(badName));
          setTargetMap((prev: any) => { const n = {...prev}; delete n[badName]; return n; });
      } catch (e: any) { showToast("Erro: " + e.message, "error"); }
      finally { setIsProcessing(false); }
  };

  const handleLinkStudy = async (orphanName: string) => {
      const targetStaffId = studyTargetMap[orphanName];
      if (!targetStaffId) {
          showToast("Selecione o cadastro oficial antes de vincular.", "warning");
          return;
      }

      setIsProcessing(true);
      try {
          let participantType = 'Colaborador';
          let sectorId = null;

          const staff = proStaff.find((s: any) => String(s.id) === targetStaffId);
          if (staff) {
              participantType = 'Colaborador';
              sectorId = staff.sectorId;
          } else if (proPatients.find((p: any) => String(p.id) === targetStaffId)) {
              participantType = 'Paciente';
          } else if (proProviders.find((p: any) => String(p.id) === targetStaffId)) {
              participantType = 'Prestador';
          }

          const msg = await linkStudySessionIdentity(orphanName, targetStaffId, sectorId, participantType);
          showToast(msg, "success");
          setResolvedItems((prev: any) => new Set(prev).add(orphanName));
      } catch (e: any) {
          showToast(e.message, "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleMergePGs = async (sourceId: string, targetId: string) => {
    setIsProcessing(true);
    try {
      const result = await mergePGs(sourceId, targetId);
      if (result.success) {
        showToast(result.message, "success");
      } else {
        showToast(result.message, "error");
      }
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const getSourceRecords = (orphanName: string) => {
      const records: any[] = [];
      const norm = normalizeString(orphanName);

      const check = (name: string | undefined) => name && normalizeString(name) === norm;

      bibleClasses.forEach((c: any) => {
          if (c.students?.some((s: any) => check(s))) {
              records.push({ type: 'Aula Bíblica', date: c.date, sector: c.sector, id: c.id, collection: 'bibleClasses', actionType: 'remove_from_array', details: 'O nome está na lista de presença. A exclusão apenas removerá o aluno da aula.' });
          }
      });

      bibleStudies.forEach((s: any) => {
          if (check(s.name)) {
              records.push({ type: 'Estudo Bíblico', date: s.date, sector: s.sector, id: s.id, collection: 'bibleStudies', actionType: 'delete_record', details: 'Registro completo de estudo bíblico.' });
          }
      });

      staffVisits.forEach((v: any) => {
          if (check(v.staffName)) {
              records.push({ type: 'Visita Colaborador', date: v.date, sector: v.sector, id: v.id, collection: 'staffVisits', actionType: 'delete_record', details: 'Registro completo de visita.' });
          }
      });
      
      smallGroups.forEach((sg: any) => {
          if (check(sg.leader)) {
              records.push({ type: 'Pequeno Grupo (Histórico)', date: sg.date, sector: sg.sector, id: sg.id, collection: 'smallGroups', actionType: 'delete_record', details: 'Registro histórico de PG.' });
          }
      });

      visitRequests.forEach((vr: any) => {
          if (check(vr.leaderName)) {
              records.push({ type: 'Solicitação Visita', date: vr.requestDate, sector: vr.sectorName, id: vr.id, collection: 'visitRequests', actionType: 'delete_record', details: 'Solicitação de visita agendada.' });
          }
      });

      proGroups.forEach((pg: any) => {
          if (check(pg.leader) || check(pg.currentLeader)) {
              records.push({ type: 'Cadastro Mestre PG', sector: pg.unit, id: pg.id, collection: 'proGroups', actionType: 'clear_field', details: 'O nome consta como líder do PG. A exclusão apenas limpará o campo de líder.' });
          }
      });

      return records;
  };

  const handleDeleteSourceRecord = async (collection: string, id: string, actionType?: string, orphanName?: string) => {
      const msg = actionType === 'delete_record' 
          ? "Tem certeza absoluta? Esta ação APAGARÁ O REGISTRO COMPLETO do banco de dados." 
          : "Tem certeza? Esta ação removerá apenas este nome do registro, mantendo o restante intacto.";
          
      if (!confirm(msg)) return;
      
      setIsProcessing(true);
      try {
          if (actionType === 'remove_from_array' && collection === 'bibleClasses' && orphanName) {
              const cls = bibleClasses.find((c: any) => c.id === id);
              if (cls) {
                  const updatedStudents = (cls.students || []).filter((s: any) => normalizeString(s) !== normalizeString(orphanName));
                  await saveRecord('bibleClasses', { ...cls, students: updatedStudents });
                  showToast("Nome removido da lista de presença da aula.", "success");
              }
          } else if (actionType === 'clear_field' && collection === 'proGroups' && orphanName) {
              const pg = proGroups.find((g: any) => g.id === id);
              if (pg) {
                  const updates = { ...pg };
                  if (normalizeString(pg.leader) === normalizeString(orphanName)) updates.leader = '';
                  if (normalizeString(pg.currentLeader) === normalizeString(orphanName)) updates.currentLeader = '';
                  await saveRecord('proGroups', updates);
                  showToast("Nome removido da liderança do PG.", "success");
              }
          } else {
              const success = await deleteRecord(collection, id);
              if (success) {
                  showToast("Registro excluído com sucesso do banco de dados.", "success");
              } else {
                  showToast("Falha ao excluir o registro. Verifique as permissões ou se o registro ainda existe.", "error");
              }
          }
          await loadFromCloud(false);
      } catch (e: any) {
          showToast("Erro ao processar: " + e.message, "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleUniversalMerge = async (sourceType: string, sourceId: string, targetType: string, targetId: string) => {
      setIsProcessing(true);
      try {
          const sourceList = sourceType === 'Colaborador' ? proStaff : sourceType === 'Paciente' ? proPatients : proProviders;
          const targetList = targetType === 'Colaborador' ? proStaff : targetType === 'Paciente' ? proPatients : proProviders;

          const sourceRecord = sourceList.find((r: any) => String(r.id) === String(sourceId));
          const targetRecord = targetList.find((r: any) => String(r.id) === String(targetId));

          if (!sourceRecord) throw new Error("Cadastro de origem não encontrado.");
          if (!targetRecord) throw new Error("Cadastro de destino não encontrado.");

          const normSource = normalizeString(sourceRecord.name);
          
          // Helper function for more robust matching
          const isMatch = (nameToTest: string) => {
              if (!nameToTest) return false;
              const normTest = normalizeString(nameToTest);
              // Primeiro tenta match exato
              if (normTest === normSource) return true;
              // Se não for exato, verifica se o nome original está contido no nome testado (ou vice-versa)
              // Isso ajuda a pegar casos onde o histórico tem "Simone Sawada" e o cadastro tinha "Simone Cristina Sawada"
              return normTest.includes(normSource) || normSource.includes(normTest);
          };

          // 1. Atualizar Estudos Bíblicos
          const studiesToUpdate = bibleStudies.filter((s: any) => isMatch(s.name));
          for (const s of studiesToUpdate) {
              await saveRecord('bibleStudies', { 
                  ...s, 
                  name: targetRecord.name, 
                  staffId: targetRecord.id, 
                  participantType: targetType,
                  sectorId: targetRecord.sectorId || s.sectorId 
              });
          }

          // 2. Atualizar Visitas
          const visitsToUpdate = staffVisits.filter((v: any) => isMatch(v.staffName));
          for (const v of visitsToUpdate) {
              await saveRecord('staffVisits', { 
                  ...v, 
                  staffName: targetRecord.name, 
                  participantType: targetType 
              });
          }

          // 3. Atualizar Aulas Bíblicas
          const classesToUpdate = bibleClasses.filter((c: any) => c.students?.some((st: any) => isMatch(st)));
          for (const c of classesToUpdate) {
              const updatedStudents = c.students.map((st: any) => isMatch(st) ? targetRecord.name : st);
              await saveRecord('bibleClasses', { ...c, students: updatedStudents });
          }

          // 4. Atualizar Histórico de PGs
          const historyToUpdate = smallGroups.filter((sg: any) => isMatch(sg.leader));
          for (const sg of historyToUpdate) {
              await saveRecord('smallGroups', { ...sg, leader: targetRecord.name });
          }

          // 5. Atualizar PGs Ativos
          const groupsToUpdate = proGroups.filter((g: any) => isMatch(g.leader) || isMatch(g.currentLeader));
          for (const g of groupsToUpdate) {
              await saveRecord('proGroups', { 
                  ...g, 
                  leader: isMatch(g.leader) ? targetRecord.name : g.leader,
                  currentLeader: isMatch(g.currentLeader) ? targetRecord.name : g.currentLeader,
                  leaderPhone: targetRecord.whatsapp || g.leaderPhone
              });
          }

          // 6. Apagar o registro de origem
          const collectionMap: Record<string, string> = {
              'Colaborador': 'proStaff',
              'Paciente': 'proPatients',
              'Prestador': 'proProviders'
          };
          await deleteRecord(collectionMap[sourceType], sourceId);

          showToast("Mesclagem concluída com sucesso! Histórico transferido e cadastro incorreto removido.", "success");
          await loadFromCloud(false);
      } catch (e: any) {
          showToast("Erro na mesclagem: " + e.message, "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleSyncTemporalCycle = async () => {
    if (!confirm("Isso carimbará todos os membros de PG sem competência como 'Fevereiro/2026'. Confirma?")) return;
    
    setIsProcessing(true);
    try {
      const result = await syncPGMembershipCycle();
      if (result.success) {
        showToast(result.message, "success");
      } else {
        showToast(result.message, "error");
      }
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    handleProcessPerson,
    handleHealSector,
    handleLinkStudy,
    handleMergePGs,
    getSourceRecords,
    handleDeleteSourceRecord,
    handleUniversalMerge,
    handleSyncTemporalCycle
  };
};
