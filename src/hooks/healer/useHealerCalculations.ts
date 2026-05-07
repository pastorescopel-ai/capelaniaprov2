import { useMemo, useEffect } from 'react';
import { normalizeString } from '../../utils/formatters';
import { ParticipantType } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';

export const useHealerCalculations = (
  appData: any,
  state: any
) => {
  const { 
    bibleClasses, bibleStudies, smallGroups, staffVisits, visitRequests,
    proStaff, proPatients, proProviders, proSectors, proGroups
  } = appData;

  const {
    activeTab, resolvedItems, searchQuery, showAllHistory, filterClassOnly,
    setAttendeeOrphans, setIsLoadingAttendees, setTargetMap, personTypeMap,
    selectedUnit
  } = state;

  const { showToast } = useToast();

  // --- BUSCA DE PRESENÇAS ÓRFÃS ---
  useEffect(() => {
    if (activeTab === 'attendees') {
        const fetchAttendees = async () => {
            if (!supabase) return;
            setIsLoadingAttendees(true);
            try {
                const { data, error } = await supabase
                    .from('bible_class_attendees')
                    .select('student_name, class_id, unit')
                    .is('staff_id', null)
                    .eq('unit', selectedUnit);
                
                if (error) throw error;

                if (data) {
                    const groups: Record<string, {name: string, count: number}> = {};
                    data.forEach((row: any) => {
                        const n = row.student_name;
                        if (!n) return;
                        const key = normalizeString(n);
                        if (resolvedItems.has(n) || resolvedItems.has(key)) return;

                        // Se a classe for de Prestadores ou Pacientes, não é anomalia
                        const cls = bibleClasses.find((c: any) => c.id === row.class_id);
                        if (cls && (cls.participantType === ParticipantType.PROVIDER || cls.participantType === ParticipantType.PATIENT)) {
                            return;
                        }

                        if (!groups[key]) groups[key] = { name: n, count: 0 };
                        groups[key].count++;
                    });
                    setAttendeeOrphans(Object.values(groups).sort((a, b) => b.count - a.count));
                }
            } catch (e) {
                console.error("Erro ao buscar presenças órfãs", e);
                showToast("Erro ao carregar dados do banco.", "warning");
            } finally {
                setIsLoadingAttendees(false);
            }
        };
        fetchAttendees();
    }
  }, [activeTab, resolvedItems, showToast, setAttendeeOrphans, setIsLoadingAttendees, bibleClasses, selectedUnit]);

  // --- CÁLCULO DE ÓRFÃOS DE ESTUDOS ---
  const studyOrphans = useMemo(() => {
      const orphanMap = new Map<string, { count: number, unit: string, participantType: string }>();
      
      bibleStudies.forEach((s: any) => {
          if (s.unit !== selectedUnit) return;
          if (!s.staffId && !s.sectorId) {
              // Se for Prestador ou Paciente, não é anomalia de estudo
              if (s.participantType === ParticipantType.PROVIDER || s.participantType === ParticipantType.PATIENT) return;

              const cleanName = s.name.trim();
              if (resolvedItems.has(cleanName)) return;
              
              const normSearch = normalizeString(searchQuery);
              if (normSearch && !normalizeString(cleanName).includes(normSearch)) return;

              if (!orphanMap.has(cleanName)) {
                  orphanMap.set(cleanName, { count: 0, unit: s.unit, participantType: s.participantType || 'Colaborador' });
              }
              orphanMap.get(cleanName)!.count++;
          }
      });

      return Array.from(orphanMap.entries())
          .map(([name, data]) => ({ name, count: data.count, unit: data.unit, participantType: data.participantType }))
          .sort((a, b) => b.count - a.count);
  }, [bibleStudies, resolvedItems, searchQuery, selectedUnit]);

  // --- CÁLCULO DE ÓRFÃOS DE PESSOAS ---
  const peopleOrphans = useMemo(() => {
    const orphanMap = new Map<string, { sectors: Set<string>, sources: { class: number, study: number, visit: number } }>();
    
    const staffFiltered = proStaff.filter((s: any) => s.unit === selectedUnit);
    const patientsFiltered = proPatients.filter((p: any) => p.unit === selectedUnit);
    const providersFiltered = proProviders.filter((p: any) => p.unit === selectedUnit);

    const officialNamesNormalized = new Set([
        ...staffFiltered.map((s: any) => normalizeString(s.name)),
        ...patientsFiltered.map((p: any) => normalizeString(p.name)),
        ...providersFiltered.map((p: any) => normalizeString(p.name))
    ]);

    const normSearch = normalizeString(searchQuery);
    
    const checkAndAdd = (rawName: string | null | undefined, sourceSector: string | undefined, type: 'class' | 'study' | 'visit' | 'group', participantType?: string, unit?: string) => {
        if (unit && unit !== selectedUnit) return;
        
        const effectiveName = rawName?.trim() || "[REGISTRO SEM NOME]";
        const cleanName = effectiveName.split(' (')[0].trim();
        if (resolvedItems.has(cleanName)) return;

        // Se for Prestador ou Paciente, não é anomalia (conforme pedido do usuário)
        if (participantType === ParticipantType.PROVIDER || participantType === ParticipantType.PATIENT) return;

        const norm = normalizeString(cleanName);
        const isMatchSearch = normSearch && norm.includes(normSearch);
        
        const hasIdLink = rawName && rawName.match(/\(\d+\)$/);
        const isOfficiallyListed = officialNamesNormalized.has(norm);
        
        if (isOfficiallyListed && !isMatchSearch && !showAllHistory) return;
        if (hasIdLink && !isMatchSearch && !showAllHistory) return;

        const shouldShow = isMatchSearch || showAllHistory || !isOfficiallyListed;

        if (shouldShow) {
            if (participantType && participantType !== 'Colaborador' && !showAllHistory && !isMatchSearch && isOfficiallyListed && hasIdLink) return;

            if (!orphanMap.has(cleanName)) {
                orphanMap.set(cleanName, { sectors: new Set(), sources: { class: 0, study: 0, visit: 0, group: 0 } });
            }
            
            const entry = orphanMap.get(cleanName)!;
            if (sourceSector && sourceSector.trim()) entry.sectors.add(sourceSector.trim());
            entry.sources[type] = (entry.sources[type] || 0) + 1;
        }
    };

    bibleClasses.forEach((cls: any) => {
        if (cls.unit !== selectedUnit) return;
        cls.students?.forEach((s: any) => checkAndAdd(s, cls.sector, 'class', cls.participantType || 'Colaborador', cls.unit));
    });

    bibleStudies.forEach((s: any) => { 
        if (s.unit !== selectedUnit) return;
        if (s.participantType === ParticipantType.STAFF || !s.participantType || showAllHistory || normSearch) {
             checkAndAdd(s.name, s.sector, 'study', s.participantType, s.unit); 
        }
    });

    staffVisits.forEach((v: any) => { 
        if (v.unit !== selectedUnit) return;
        if (v.participantType === ParticipantType.STAFF || !v.participantType || showAllHistory || normSearch) {
            checkAndAdd(v.staffName, v.sector, 'visit', v.participantType, v.unit);
        }
    });

    smallGroups.forEach((sg: any) => {
        if (sg.unit !== selectedUnit) return;
        checkAndAdd(sg.leader, sg.sector, 'group', 'Colaborador', sg.unit);
    });

    visitRequests.forEach((vr: any) => {
        if (vr.unit !== selectedUnit) return;
        checkAndAdd(vr.leaderName, vr.sectorName, 'visit', 'Colaborador', vr.unit);
    });

    proGroups.forEach((pg: any) => {
        if (pg.unit !== selectedUnit) return;
        if (pg.currentLeader) checkAndAdd(pg.currentLeader, undefined, 'group', 'Colaborador', pg.unit);
        if (pg.leader) checkAndAdd(pg.leader, undefined, 'group', 'Colaborador', pg.unit);
    });
    
    return Array.from(orphanMap.entries())
        .map(([name, data]) => ({ name, sectors: Array.from(data.sectors).sort(), sources: data.sources }))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [bibleClasses, bibleStudies, staffVisits, smallGroups, visitRequests, proGroups, proStaff, proPatients, proProviders, showAllHistory, resolvedItems, searchQuery, selectedUnit]);

  // --- CÁLCULO DE ÓRFÃOS DE SETORES ---
  const sectorOrphans = useMemo(() => {
      const orphans = new Map<string, { type: 'name' | 'id', count: number, originalValue: string }>();
      const sectorsFiltered = proSectors.filter((s: any) => s.unit === selectedUnit);
      const officialNamesNormalized = new Set(sectorsFiltered.map((s: any) => normalizeString(s.name)));
      const officialIds = new Set(sectorsFiltered.map((s: any) => String(s.id)));

      const checkSector = (name: string | undefined, id: string | undefined, unit: string) => {
          if (unit !== selectedUnit) return;
          
          // 1. Verificar por ID primeiro (mais importante)
          if (id) {
              const idStr = String(id);
              if (!officialIds.has(idStr) && !resolvedItems.has(`id:${idStr}`)) {
                  const key = `ID: ${idStr}`;
                  if (!orphans.has(key)) {
                    orphans.set(key, { type: 'id', count: 0, originalValue: idStr });
                  }
                  orphans.get(key)!.count++;
                  return; // Se tem ID e é inválido, priorizamos tratar o ID
              }
          }

          // 2. Verificar por nome se não houver ID ou se o ID for válido mas o nome em cache estiver estranho
          // (Geralmente focamos no nome apenas se o ID estiver ausente)
          if (!id && name) {
              const clean = name.trim();
              if (!clean || resolvedItems.has(clean)) return;
              const norm = normalizeString(clean);
              if (!officialNamesNormalized.has(norm)) {
                  if (!orphans.has(clean)) {
                      orphans.set(clean, { type: 'name', count: 0, originalValue: clean });
                  }
                  orphans.get(clean)!.count++;
              }
          }
      };

      bibleStudies.forEach((s: any) => checkSector(s.sector, s.sectorId, s.unit));
      staffVisits.forEach((v: any) => checkSector(v.sector, v.sectorId, v.unit));
      smallGroups.forEach((g: any) => checkSector(g.sector, g.sectorId, g.unit));
      bibleClasses.forEach((c: any) => checkSector(c.sector, c.sectorId, c.unit));
      visitRequests.forEach((vr: any) => checkSector(vr.sectorName, vr.sectorId, vr.unit));
      proGroups.forEach((pg: any) => checkSector(undefined, pg.sectorId, pg.unit));
      proStaff.forEach((s: any) => {
          if (s.unit === selectedUnit && s.sectorId && !officialIds.has(String(s.sectorId))) {
              checkSector(undefined, s.sectorId, s.unit);
          }
      });

      return Array.from(orphans.entries())
        .map(([display, entry]) => ({ display, ...entry }))
        .sort((a, b) => b.count - a.count);
  }, [bibleStudies, staffVisits, smallGroups, bibleClasses, visitRequests, proSectors, proGroups, proStaff, resolvedItems, selectedUnit]);

  // --- OPÇÕES OFICIAIS ---
  const officialStaffOptions = useMemo(() => {
      return proStaff.filter((s: any) => s.unit === selectedUnit).map((s: any) => {
          const idStr = String(s.id).replace(/\D/g, '');
          const isInactive = s.active === false;
          return {
              value: s.id, 
              label: `${s.name} (${idStr})${isInactive ? ' ⚠️ [INATIVO]' : ''}`,
              subLabel: proSectors.find((sec: any) => String(sec.id) === String(s.sectorId))?.name || 'Sem Setor',
              category: 'RH' as const
          };
      });
  }, [proStaff, proSectors, selectedUnit]);

  const officialPatientOptions = useMemo(() => {
      return proPatients.filter((p: any) => p.unit === selectedUnit).map((p: any) => ({
          value: p.id,
          label: p.name,
          subLabel: `Unidade ${p.unit}`,
          category: 'Paciente' as const
      }));
  }, [proPatients, selectedUnit]);

  const officialProviderOptions = useMemo(() => {
      return proProviders.filter((p: any) => p.unit === selectedUnit).map((p: any) => ({
          value: p.id,
          label: p.name,
          subLabel: `Unidade ${p.unit}`,
          category: 'Prestador' as const
      }));
  }, [proProviders, selectedUnit]);

  const officialSectorOptions = useMemo(() => {
      return proSectors.filter((s: any) => s.unit === selectedUnit).map((s: any) => ({
          value: String(s.id),
          label: `${s.name}`,
          subLabel: `Setor ID: ${s.id}`,
          category: 'RH' as const
      }));
  }, [proSectors, selectedUnit]);

  const filteredPeopleList = useMemo(() => {
      return peopleOrphans.filter(p => !filterClassOnly || p.sources.class > 0);
  }, [peopleOrphans, filterClassOnly]);

  // --- MOTOR DE SUGESTÃO INTELIGENTE ---
  useEffect(() => {
    if (activeTab === 'people' && peopleOrphans.length > 0) {
        setTargetMap((prev: any) => {
            const next = { ...prev };
            let changed = false;
            peopleOrphans.forEach(orphan => {
                if (!next[orphan.name]) {
                    const normOrphan = normalizeString(orphan.name);
                    if (normOrphan && normOrphan !== normalizeString("[REGISTRO SEM NOME]")) {
                        const currentType = personTypeMap[orphan.name] || 'Colaborador';
                        let match: any;

                        if (currentType === 'Colaborador' || currentType === 'Ex-Colaborador') {
                            match = proStaff.find((s: any) => {
                                const normStaff = normalizeString(s.name);
                                return normStaff.includes(normOrphan) || normOrphan.includes(normStaff);
                            });
                        } else if (currentType === 'Paciente') {
                            match = proPatients.find((p: any) => {
                                const normP = normalizeString(p.name);
                                return normP.includes(normOrphan) || normOrphan.includes(normP);
                            });
                        } else if (currentType === 'Prestador') {
                            match = proProviders.find((p: any) => {
                                const normP = normalizeString(p.name);
                                return normP.includes(normOrphan) || normOrphan.includes(normP);
                            });
                        }
                        
                        if (match) {
                            if (currentType === 'Colaborador' || currentType === 'Ex-Colaborador') {
                                const idStr = String(match.id).replace(/\D/g, '');
                                next[orphan.name] = `${match.name} (${idStr})`;
                            } else {
                                next[orphan.name] = match.name;
                            }
                            changed = true;
                        }
                    }
                }
            });
            return changed ? next : prev;
        });
    }
  }, [peopleOrphans, activeTab, proStaff, proPatients, proProviders, personTypeMap, setTargetMap]);

  // --- MOTOR DE SUGESTÃO PARA SETORES ---
  useEffect(() => {
    if (activeTab === 'sectors' && sectorOrphans.length > 0) {
        setTargetMap((prev: any) => {
            const next = { ...prev };
            let changed = false;
            sectorOrphans.forEach(orphan => {
                if (!next[orphan]) {
                    const normOrphan = normalizeString(orphan);
                    const match = proSectors.find((s: any) => {
                        if (s.unit !== selectedUnit) return false;
                        const normSec = normalizeString(s.name);
                        return normSec.includes(normOrphan) || normOrphan.includes(normSec) || normSec.startsWith(normOrphan.substring(0, 5));
                    });
                    if (match) {
                        next[orphan] = match.name;
                        changed = true;
                    }
                }
            });
            return changed ? next : prev;
        });
    }
  }, [sectorOrphans, activeTab, proSectors, selectedUnit, setTargetMap]);

  // --- PGS DUPLICADOS (RESPEITA UNIDADE) ---
  const duplicatePGs = useMemo(() => {
    const duplicates: { name: string, unit: string, groups: any[] }[] = [];
    const unitGroups = proGroups.filter((g: any) => g.unit === selectedUnit && g.active !== false);
    const nameMap = new Map<string, any[]>();
    
    unitGroups.forEach((g: any) => {
      const norm = normalizeString(g.name);
      if (!nameMap.has(norm)) nameMap.set(norm, []);
      nameMap.get(norm)!.push(g);
    });

    nameMap.forEach((list) => {
      if (list.length > 1) {
        duplicates.push({ name: list[0].name, unit: selectedUnit, groups: list });
      }
    });

    return duplicates;
  }, [proGroups, selectedUnit]);

  // --- MATRÍCULAS DUPLICADAS (RESPEITA UNIDADE) ---
  const duplicateMemberships = useMemo(() => {
    const duplicates: { personName: string, personId: string, type: 'staff' | 'provider', memberships: any[] }[] = [];
    const staffInUnit = proStaff.filter((s: any) => s.unit === selectedUnit).map(s => String(s.id));
    const providersInUnit = proProviders.filter((p: any) => p.unit === selectedUnit).map(p => String(p.id));
    
    // 1. CLT
    const staffMap = new Map<string, any[]>();
    (appData.proGroupMembers || []).forEach((m: any) => {
      if (m.leftAt || m.isError) return;
      const sid = String(m.staffId);
      if (!staffInUnit.includes(sid)) return;
      if (!staffMap.has(sid)) staffMap.set(sid, []);
      staffMap.get(sid)!.push(m);
    });

    staffMap.forEach((list, sid) => {
      if (list.length > 1) {
        const person = proStaff.find((s: any) => String(s.id) === sid);
        duplicates.push({
          personName: person?.name || `ID: ${sid}`,
          personId: sid,
          type: 'staff',
          memberships: list
        });
      }
    });

    // 2. Prestadores
    const providerMap = new Map<string, any[]>();
    (appData.proGroupProviderMembers || []).forEach((m: any) => {
      if (m.leftAt || m.isError) return;
      const pid = String(m.providerId);
      if (!providersInUnit.includes(pid)) return;
      if (!providerMap.has(pid)) providerMap.set(pid, []);
      providerMap.get(pid)!.push(m);
    });

    providerMap.forEach((list, pid) => {
      if (list.length > 1) {
        const person = proProviders.find((p: any) => String(p.id) === pid);
        duplicates.push({
          personName: person?.name || `ID: ${pid}`,
          personId: pid,
          type: 'provider',
          memberships: list
        });
      }
    });

    return duplicates;
  }, [appData.proGroupMembers, appData.proGroupProviderMembers, proStaff, proProviders, selectedUnit]);

  // --- HEALTH SCORE ---
  const healthScore = useMemo(() => {
    const totalOrphans = peopleOrphans.length + studyOrphans.length + sectorOrphans.length + state.attendeeOrphans.length + duplicatePGs.length + duplicateMemberships.length;
    if (totalOrphans === 0) return 100;
    const score = 100 - (totalOrphans * 2);
    return Math.max(0, score);
  }, [peopleOrphans, studyOrphans, sectorOrphans, state.attendeeOrphans, duplicatePGs, duplicateMemberships]);

  const isHealthy = (name: string) => {
      const norm = normalizeString(name);
      return proStaff.some((s: any) => normalizeString(s.name) === norm) ||
             proPatients.some((p: any) => normalizeString(p.name) === norm) ||
             proProviders.some((p: any) => normalizeString(p.name) === norm);
  };

  return {
    studyOrphans,
    peopleOrphans,
    sectorOrphans,
    officialStaffOptions,
    officialPatientOptions,
    officialProviderOptions,
    officialSectorOptions,
    filteredPeopleList,
    duplicatePGs,
    duplicateMemberships,
    healthScore,
    isHealthy
  };
};
