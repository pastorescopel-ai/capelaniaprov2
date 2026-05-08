import { normalizeString } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';

export const useHealerActions = (
  appData: any,
  state: any
) => {
  const { 
    bibleClasses, bibleStudies, smallGroups, staffVisits, visitRequests,
    proStaff, proPatients, proProviders, proSectors, proGroups,
    unifyStudentIdentity, unifyIdentityV6, mergeIdentitiesV6, createAndLinkIdentity, healSectorConnection, 
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
              console.log(`[HEALER] Iniciando unificação: ${orphanName} -> ID ${targetId}`);
              const result = await unifyIdentityV6(orphanName, targetId, 'Colaborador');
              const isError = result.startsWith('Erro:');
              
              if (!isError) {
                  // Reforço de persistência local para tabelas que o RPC pode omitir ou demorar a propagar
                  if (targetId) {
                      try {
                          await saveRecord('bibleClassAttendees', 
                              appData.bibleClassAttendees
                                  .filter((a: any) => normalizeString(a.studentName) === normalizeString(orphanName) && !a.staffId)
                                  .map((a: any) => ({ ...a, staffId: targetId }))
                          );
                      } catch (err) {
                          console.warn("Erro ao atualizar presenças manualmente.");
                      }
                  }

                  const targetStaff = proStaff.find((s: any) => String(s.id).includes(targetId));
                  if (targetStaff) {
                      const normOrphan = normalizeString(orphanName);
                      
                      const groupsToUpdate = proGroups.filter((g: any) => normalizeString(g.leader) === normOrphan || normalizeString(g.currentLeader) === normOrphan);
                      for (const g of groupsToUpdate) {
                          const { leader, ...groupWithoutLeader } = g;
                          await saveRecord('proGroups', { 
                              ...groupWithoutLeader, 
                              currentLeader: normalizeString(g.currentLeader) === normOrphan ? targetStaff.name : g.currentLeader,
                              leaderPhone: targetStaff.whatsapp || g.leaderPhone
                          });
                      }

                      const historyToUpdate = smallGroups.filter((sg: any) => normalizeString(sg.leader) === normOrphan);
                      for (const sg of historyToUpdate) {
                          await saveRecord('smallGroups', { ...sg, leader: targetStaff.name });
                      }

                      const studiesToUpdate = bibleStudies.filter((s: any) => normalizeString(s.name) === normOrphan && s.participantType !== 'Colaborador');
                      for (const s of studiesToUpdate) {
                          await saveRecord('bibleStudies', { ...s, participantType: 'Colaborador' });
                      }

                      const visitsToUpdate = staffVisits.filter((v: any) => normalizeString(v.staffName) === normOrphan && v.participantType !== 'Colaborador');
                      for (const v of visitsToUpdate) {
                          await saveRecord('staffVisits', { ...v, participantType: 'Colaborador' });
                      }
                  }
                  
                  await loadFromCloud(true);
                  showToast(`Cura profunda concluída! ${result}`, "success");
                  setResolvedItems((prev: any) => {
                      const next = new Set(prev);
                      next.add(orphanName);
                      next.add(normalizeString(orphanName));
                      return next;
                  });
                  setTargetMap((prev: any) => { const n = {...prev}; delete n[orphanName]; return n; });
              } else {
                  showToast(`Erro na unificação: ${result}`, "error");
              }
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
                  
                  const result = await unifyIdentityV6(orphanName, existing.id, selectedType);
                  const isError = result.startsWith('Erro:');
                  showToast(`Vínculo universal realizado: ${result}`, isError ? "error" : "success");
                  
                  if (!isError) {
                      setResolvedItems((prev: any) => new Set(prev).add(orphanName));
                      setTargetMap((prev: any) => { const n = {...prev}; delete n[orphanName]; return n; });
                  }
              } else {
                  if (!confirm(`Confirma criar novo cadastro de ${selectedType} para "${orphanName}"?`)) {
                      setIsProcessing(false);
                      return;
                  }
                  const result = await createAndLinkIdentity(orphanName, selectedType);
                  showToast(result, "success");
                  setResolvedItems((prev: any) => new Set(prev).add(orphanName));
                  setTargetMap((prev: any) => { const n = {...prev}; delete n[orphanName]; return n; });
              }
          } catch (e: any) { showToast("Erro: " + e.message, "error"); }
          finally { setIsProcessing(false); }
      }
  };

  const handleHealSector = async (orphan: any) => {
      const targetId = targetMap[orphan.display];
      if (!targetId) { showToast("Selecione um setor oficial da lista.", "warning"); return; }
      
      const selectedSector = proSectors.find((s: any) => String(s.id) === String(targetId) || s.name === targetId);
      if (!selectedSector) { 
        showToast("Setor de destino não encontrado. Selecione novamente.", "warning"); 
        return; 
      }

      setIsProcessing(true);
      try {
          let result: string;
          const healById = orphan.type === 'id' || orphan.type === 'mismatch';
          
          result = await healSectorConnection(orphan.originalValue, selectedSector.id, healById, selectedSector.name);
          
          await loadFromCloud(true);
          showToast(result, "success");
          setResolvedItems((prev: any) => {
            const next = new Set(prev);
            next.add(orphan.display);
            if (healById) next.add(`id:${orphan.originalValue}`);
            return next;
          });
          setTargetMap((prev: any) => { const n = {...prev}; delete n[orphan.display]; return n; });
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
          await loadFromCloud(true);
          showToast(msg, "success");
          setResolvedItems((prev: any) => {
            const next = new Set(prev);
            next.add(orphanName);
            return next;
          });
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
                  delete updates.leader;
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
          const result = await mergeIdentitiesV6(sourceId, sourceType, targetId, targetType);
          const isError = result.startsWith('Erro:');
          
          if (!isError) {
              showToast("Mesclagem concluída com sucesso! Histórico transferido e cadastro incorreto removido.", "success");
              await loadFromCloud(false);
          } else {
              showToast(result, "error");
          }
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

  const handleFixDuplicateMembership = async (personId: string, type: 'staff' | 'provider', keepId: string) => {
    const collection = type === 'staff' ? 'proGroupMembers' : 'proGroupProviderMembers';
    const idField = type === 'staff' ? 'staffId' : 'providerId';
    const membersList = type === 'staff' ? appData.proGroupMembers : appData.proGroupProviderMembers;

    const duplicates = (membersList || []).filter((m: any) => String((m as any)[idField]) === String(personId) && !m.leftAt && !m.isError);
    
    if (duplicates.length <= 1) {
      showToast("Não há duplicidade ativa para este colaborador.", "info");
      return;
    }

    const toRemove = duplicates.filter((m: any) => m.id !== keepId);
    const keepRecord = duplicates.find((m: any) => m.id === keepId);
    const keepGroupName = proGroups.find((g: any) => g.id === keepRecord?.groupId)?.name || 'selecionado';
    
    if (!confirm(`Deseja manter apenas a matrícula no grupo "${keepGroupName}" e remover as outras ${toRemove.length}?`)) return;

    setIsProcessing(true);
    try {
      // Marcamos como erro para "retirar" da visão ativa mas manter rastro se necessário
      const updates = toRemove.map(m => ({ ...m, isError: true, leftAt: Date.now() }));
      const success = await saveRecord(collection, updates);
      
      if (success) {
        showToast("Duplicidades resolvidas!", "success");
      } else {
        showToast("Erro ao resolver duplicidades.", "error");
      }
    } catch (e: any) {
      showToast("Erro: " + e.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFixAttendeeDates = async () => {
    const attendeesToFix = (appData.bibleClassAttendees || []).filter((a: any) => !a.date || !a.cycleMonth);
    
    if (attendeesToFix.length === 0) {
      showToast("Todos os registros de presença já possuem data e ciclo.", "info");
      return;
    }

    if (!confirm(`Foram encontrados ${attendeesToFix.length} registros sem data. Deseja corrigi-los usando a data da aula correspondente?`)) return;

    setIsProcessing(true);
    try {
      const updates = [];
      for (const attendee of attendeesToFix) {
        const parentClass = bibleClasses.find((c: any) => c.id === attendee.classId);
        if (parentClass && parentClass.date) {
            let cycleMonth = null;
            const d = new Date(parentClass.date + (parentClass.date.includes('T') ? '' : 'T12:00:00'));
            if (!isNaN(d.getTime())) {
                cycleMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
            }
            
            updates.push({
                ...attendee,
                date: parentClass.date,
                cycleMonth: cycleMonth
            });
        }
      }

      if (updates.length > 0) {
        // Salvar em lotes de 50 para não sobrecarregar
        const CHUNK_SIZE = 50;
        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE);
            await saveRecord('bibleClassAttendees', chunk);
        }
        showToast(`${updates.length} registros de presença foram corrigidos!`, "success");
        await loadFromCloud(false);
      } else {
        showToast("Nenhum registro pôde ser corrigido (aulas pai não encontradas).", "warning");
      }
    } catch (e: any) {
      showToast("Erro ao corrigir datas: " + e.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const getSectorSourceRecords = (orphan: any) => {
    const records: any[] = [];
    const isIdOrphan = orphan.type === 'id';
    const val = orphan.originalValue;

    if (isIdOrphan) {
      bibleStudies.forEach((s: any) => { if (String(s.sectorId) === String(val)) records.push({ type: 'Estudo Bíblico', date: s.date, id: s.id, collection: 'bibleStudies' }); });
      staffVisits.forEach((v: any) => { if (String(v.sectorId) === String(val)) records.push({ type: 'Visita Colaborador', date: v.date, id: v.id, collection: 'staffVisits' }); });
      smallGroups.forEach((g: any) => { if (String(g.sectorId) === String(val)) records.push({ type: 'Pequeno Grupo', date: g.date, id: g.id, collection: 'smallGroups' }); });
      bibleClasses.forEach((c: any) => { if (String(c.sectorId) === String(val)) records.push({ type: 'Aula Bíblica', date: c.date, id: c.id, collection: 'bibleClasses' }); });
      visitRequests.forEach((vr: any) => { if (String(vr.sectorId) === String(val)) records.push({ type: 'Solicitação Visita', date: vr.requestDate, id: vr.id, collection: 'visitRequests' }); });
    } else {
      const norm = normalizeString(val);
      bibleStudies.forEach((s: any) => { if (s.sector && normalizeString(s.sector) === norm) records.push({ type: 'Estudo Bíblico', date: s.date, id: s.id, collection: 'bibleStudies' }); });
      staffVisits.forEach((v: any) => { if (v.sector && normalizeString(v.sector) === norm) records.push({ type: 'Visita Colaborador', date: v.date, id: v.id, collection: 'staffVisits' }); });
      smallGroups.forEach((g: any) => { if (g.sector && normalizeString(g.sector) === norm) records.push({ type: 'Pequeno Grupo', date: g.date, id: g.id, collection: 'smallGroups' }); });
      bibleClasses.forEach((c: any) => { if (c.sector && normalizeString(c.sector) === norm) records.push({ type: 'Aula Bíblica', date: c.date, id: c.id, collection: 'bibleClasses' }); });
      visitRequests.forEach((vr: any) => { if (vr.sectorName && normalizeString(vr.sectorName) === norm) records.push({ type: 'Solicitação Visita', date: vr.requestDate, id: vr.id, collection: 'visitRequests' }); });
    }

    return records;
  };

  const handleDeleteSectorOrphan = async (orphan: any) => {
    const records = getSectorSourceRecords(orphan);
    if (records.length === 0) {
      showToast("Nenhum registro encontrado para este setor.", "info");
      return;
    }

    if (!confirm(`ATENÇÃO: Você está prestes a APAGAR ${records.length} registros que utilizam este setor "${orphan.display}".\n\nEsta ação é irreversível. Deseja continuar?`)) return;

    setIsProcessing(true);
    try {
      let count = 0;
      for (const rec of records) {
        const success = await deleteRecord(rec.collection, rec.id);
        if (success) count++;
      }
      showToast(`${count} registros apagados com sucesso.`, "success");
      setResolvedItems((prev: any) => new Set(prev).add(orphan.display));
      await loadFromCloud(false);
    } catch (e: any) {
      showToast("Erro ao apagar registros: " + e.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMoveSectorUnit = async (orphan: any, targetUnit: string) => {
      // Tenta encontrar o setor em qualquer unidade (já que ele é órfão na atual)
      const sector = proSectors.find((s: any) => String(s.id) === String(orphan.originalValue));
      
      if (!sector) {
          showToast("Cadastro mestre deste setor não encontrado em nenhuma unidade para mover.", "error");
          return;
      }

      if (!confirm(`Deseja mover o cadastro do setor "${sector.name}" (ID ${sector.id}) da unidade ${sector.unit} para ${targetUnit}?`)) return;

      setIsProcessing(true);
      try {
          const success = await saveRecord('proSectors', { ...sector, unit: targetUnit, updatedAt: Date.now() });
          if (success) {
            await loadFromCloud(true);
            showToast(`Setor ${sector.name} movido com sucesso para ${targetUnit}!`, "success");
            setResolvedItems((prev: any) => {
                const next = new Set(prev);
                next.add(orphan.display);
                next.add(`id:${orphan.originalValue}`);
                return next;
            });
          } else {
            showToast("Falha ao mover setor no banco de dados.", "error");
          }
      } catch (e: any) {
          showToast("Erro ao mover setor: " + e.message, "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleDeletePersonOrphan = async (orphanName: string) => {
    const records = getSourceRecords(orphanName);
    if (records.length === 0) {
      showToast("Nenhum registro encontrado para esta pessoa.", "info");
      return;
    }

    if (!confirm(`ATENÇÃO: Você está prestes a APAGAR ${records.length} registros (visitas, estudos, etc.) vinculados ao nome "${orphanName}".\n\nEsta ação é irreversível. Deseja continuar?`)) return;

    setIsProcessing(true);
    try {
      let count = 0;
      for (const rec of records) {
        let success = false;
        if (rec.actionType === 'remove_from_array' && rec.collection === 'bibleClasses') {
          const cls = bibleClasses.find((c: any) => c.id === rec.id);
          if (cls) {
            const updatedStudents = (cls.students || []).filter((s: any) => normalizeString(s) !== normalizeString(orphanName));
            await saveRecord('bibleClasses', { ...cls, students: updatedStudents });
            success = true;
          }
        } else if (rec.actionType === 'clear_field' && rec.collection === 'proGroups') {
          const pg = proGroups.find((g: any) => g.id === rec.id);
          if (pg) {
            const updates = { ...pg };
            delete updates.leader;
            if (normalizeString(pg.currentLeader) === normalizeString(orphanName)) updates.currentLeader = '';
            await saveRecord('proGroups', updates);
            success = true;
          }
        } else {
          success = await deleteRecord(rec.collection, rec.id);
        }
        if (success) count++;
      }
      showToast(`${count} registros processados/apagados para "${orphanName}".`, "success");
      setResolvedItems((prev: any) => new Set(prev).add(orphanName));
      setResolvedItems((prev: any) => new Set(prev).add(normalizeString(orphanName)));
      await loadFromCloud(false);
    } catch (e: any) {
      showToast("Erro ao processar exclusões: " + e.message, "error");
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
    handleSyncTemporalCycle,
    handleFixDuplicateMembership,
    handleFixAttendeeDates,
    getSectorSourceRecords,
    handleDeleteSectorOrphan,
    handleMoveSectorUnit,
    handleDeletePersonOrphan
  };
};
