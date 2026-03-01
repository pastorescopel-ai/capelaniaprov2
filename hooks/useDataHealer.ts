import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { normalizeString } from '../utils/formatters';
import { ParticipantType, ProStaff, ProGroup } from '../types';
import { supabase } from '../services/supabaseClient';

export type HealerTab = 'people' | 'sectors' | 'attendees' | 'studies' | 'pgs';
export type PersonType = 'Colaborador' | 'Ex-Colaborador' | 'Paciente' | 'Prestador';

export const useDataHealer = () => {
  const { 
    bibleClasses, bibleStudies, smallGroups, staffVisits, visitRequests,
    proStaff, proPatients, proProviders, proSectors, proGroups,
    unifyStudentIdentity, createAndLinkIdentity, healSectorConnection, 
    linkStudySessionIdentity, saveRecord, mergePGs
  } = useApp();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<HealerTab>('people');
  const [activeStudyTab, setActiveStudyTab] = useState<ParticipantType>(ParticipantType.STAFF);
  const [targetMap, setTargetMap] = useState<Record<string, string>>({});
  const [studyTargetMap, setStudyTargetMap] = useState<Record<string, string>>({});
  const [sectorMap, setSectorMap] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassOnly, setFilterClassOnly] = useState(false);
  const [personTypeMap, setPersonTypeMap] = useState<Record<string, PersonType>>({});
  const [resolvedItems, setResolvedItems] = useState<Set<string>>(new Set());
  const [attendeeOrphans, setAttendeeOrphans] = useState<{name: string, count: number}[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    if (activeTab === 'attendees') {
        const fetchAttendees = async () => {
            if (!supabase) return;
            setIsLoadingAttendees(true);
            try {
                const { data, error } = await supabase
                    .from('bible_class_attendees')
                    .select('student_name')
                    .is('staff_id', null);
                
                if (error) throw error;

                if (data) {
                    const groups: Record<string, {name: string, count: number}> = {};
                    data.forEach((row: any) => {
                        const n = row.student_name;
                        if (!n) return;
                        const key = normalizeString(n);
                        if (resolvedItems.has(n) || resolvedItems.has(key)) return;

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
  }, [activeTab, resolvedItems, showToast]);

  const studyOrphans = useMemo(() => {
      const orphanMap = new Map<string, { count: number, unit: string, participantType: string }>();
      
      bibleStudies.forEach(s => {
          if (!s.staffId && !s.sectorId) {
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
  }, [bibleStudies, resolvedItems, searchQuery]);

  const peopleOrphans = useMemo(() => {
    const orphanMap = new Map<string, { sectors: Set<string>, sources: { class: number, study: number, visit: number } }>();
    
    const officialNamesNormalized = new Set([
        ...proStaff.map(s => normalizeString(s.name)),
        ...proPatients.map(p => normalizeString(p.name)),
        ...proProviders.map(p => normalizeString(p.name))
    ]);

    const normSearch = normalizeString(searchQuery);
    
    const checkAndAdd = (rawName: string, sourceSector: string | undefined, type: 'class' | 'study' | 'visit', participantType?: string) => {
        if (!rawName) return;
        const cleanName = rawName.split(' (')[0].trim();
        if (resolvedItems.has(cleanName)) return;

        const norm = normalizeString(cleanName);
        const isMatchSearch = normSearch && norm.includes(normSearch);
        const isOfficiallyListed = officialNamesNormalized.has(norm);
        const shouldShow = isMatchSearch || (!isOfficiallyListed || showAllHistory);

        if (shouldShow && !rawName.match(/\(\d+\)$/)) {
            if (participantType && participantType !== 'Colaborador' && !showAllHistory && !isMatchSearch && isOfficiallyListed) return;

            if (!orphanMap.has(cleanName)) {
                orphanMap.set(cleanName, { sectors: new Set(), sources: { class: 0, study: 0, visit: 0 } });
            }
            
            const entry = orphanMap.get(cleanName)!;
            if (sourceSector && sourceSector.trim()) entry.sectors.add(sourceSector.trim());
            entry.sources[type] = (entry.sources[type] || 0) + 1;
        }
    };

    bibleClasses.forEach(cls => {
        cls.students?.forEach(s => checkAndAdd(s, cls.sector, 'class', 'Colaborador'));
    });

    bibleStudies.forEach(s => { 
        if (s.participantType === ParticipantType.STAFF || !s.participantType || showAllHistory || normSearch) {
             checkAndAdd(s.name, s.sector, 'study', s.participantType); 
        }
    });

    staffVisits.forEach(v => { 
        if (v.participantType === ParticipantType.STAFF || !v.participantType || showAllHistory || normSearch) {
            checkAndAdd(v.staffName, v.sector, 'visit', v.participantType);
        }
    });

    smallGroups.forEach(sg => {
        checkAndAdd(sg.leader, sg.sector, 'visit', 'Colaborador');
    });

    visitRequests.forEach(vr => {
        checkAndAdd(vr.leaderName, vr.sectorName, 'visit', 'Colaborador');
    });

    proGroups.forEach(pg => {
        if (pg.currentLeader) checkAndAdd(pg.currentLeader, undefined, 'visit', 'Colaborador');
        if (pg.leader) checkAndAdd(pg.leader, undefined, 'visit', 'Colaborador');
    });
    
    return Array.from(orphanMap.entries())
        .map(([name, data]) => ({ name, sectors: Array.from(data.sectors).sort(), sources: data.sources }))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [bibleClasses, bibleStudies, staffVisits, smallGroups, visitRequests, proGroups, proStaff, proPatients, proProviders, showAllHistory, resolvedItems, searchQuery]);

  const sectorOrphans = useMemo(() => {
      const historySet = new Set<string>();
      const officialNamesNormalized = new Set(proSectors.map(s => normalizeString(s.name)));

      const checkSector = (sector: string) => {
          if (!sector) return;
          const clean = sector.trim();
          if (!clean) return;
          if (resolvedItems.has(clean)) return;

          const norm = normalizeString(clean);
          if (!officialNamesNormalized.has(norm)) {
              historySet.add(clean);
          }
      };

      bibleStudies.forEach(s => checkSector(s.sector));
      staffVisits.forEach(v => checkSector(v.sector));
      smallGroups.forEach(g => checkSector(g.sector));
      bibleClasses.forEach(c => checkSector(c.sector));
      visitRequests.forEach(vr => checkSector(vr.sectorName));

      return Array.from(historySet).sort();
  }, [bibleStudies, staffVisits, smallGroups, bibleClasses, visitRequests, proSectors, resolvedItems]);

  const officialStaffOptions = useMemo(() => {
      return proStaff.map(s => {
          const idStr = String(s.id).replace(/\D/g, '');
          const isInactive = s.active === false;
          return {
              value: s.id, 
              label: `${s.name} (${idStr})${isInactive ? ' ⚠️ [INATIVO]' : ''}`,
              subLabel: proSectors.find(sec => sec.id === s.sectorId)?.name || 'Sem Setor',
              category: 'RH' as const
          };
      });
  }, [proStaff, proSectors]);

  const officialPatientOptions = useMemo(() => {
      return proPatients.map(p => ({
          value: p.id,
          label: p.name,
          subLabel: `Unidade ${p.unit}`,
          category: 'Paciente' as const
      }));
  }, [proPatients]);

  const officialProviderOptions = useMemo(() => {
      return proProviders.map(p => ({
          value: p.id,
          label: p.name,
          subLabel: `Unidade ${p.unit}`,
          category: 'Prestador' as const
      }));
  }, [proProviders]);

  const officialSectorOptions = useMemo(() => {
      return proSectors.map(s => ({
          value: s.name,
          label: `${s.name}`,
          subLabel: `Unidade ${s.unit}`,
          category: 'RH' as const
      }));
  }, [proSectors]);

  const filteredPeopleList = useMemo(() => {
      return peopleOrphans.filter(p => !filterClassOnly || p.sources.class > 0);
  }, [peopleOrphans, filterClassOnly]);

  const handleProcessPerson = async (orphanName: string) => {
      const selectedType = personTypeMap[orphanName] || 'Colaborador';

      if (selectedType === 'Colaborador') {
          const targetLabel = targetMap[orphanName];
          if (!targetLabel) { showToast("Selecione o colaborador correspondente no RH.", "warning"); return; }
          const targetId = targetLabel.match(/\((\d+)\)/)?.[1];
          if (!targetId) { showToast("Matrícula inválida.", "warning"); return; }

          setIsProcessing(true);
          try {
              const result = await unifyStudentIdentity(orphanName, targetId);
              showToast(result, "success");
              setResolvedItems(prev => new Set(prev).add(orphanName));
              setResolvedItems(prev => new Set(prev).add(normalizeString(orphanName)));
              setTargetMap(prev => { const n = {...prev}; delete n[orphanName]; return n; });
          } catch (e: any) { showToast("Erro: " + e.message, "warning"); } 
          finally { setIsProcessing(false); }

      } else if (selectedType === 'Ex-Colaborador') {
          const sectorName = sectorMap[orphanName];
          const sector = proSectors.find(s => s.name === sectorName);
          if (!sector) { showToast("Selecione um setor para vincular o histórico do ex-colaborador.", "warning"); return; }
          if (!confirm(`Criar registro de inativo para "${orphanName}" no setor ${sector.name}?`)) return;

          setIsProcessing(true);
          try {
              const legacyId = (7000000000 + Math.floor(Math.random() * 1000000)).toString();
              const newLegacyStaff: ProStaff = {
                  id: legacyId, name: orphanName, sectorId: sector.id, unit: sector.unit, active: false, updatedAt: Date.now()
              };
              await saveRecord('proStaff', newLegacyStaff);
              const result = await unifyStudentIdentity(orphanName, legacyId);
              showToast(`Ex-Colaborador criado! ${result}`, "success");
              setResolvedItems(prev => new Set(prev).add(orphanName));
              setSectorMap(prev => { const n = {...prev}; delete n[orphanName]; return n; });
          } catch (e: any) { showToast("Erro: " + e.message, "warning"); }
          finally { setIsProcessing(false); }

      } else {
          if (!confirm(`Confirma que "${orphanName}" é um ${selectedType}?`)) return;
          setIsProcessing(true);
          try {
              const result = await createAndLinkIdentity(orphanName, selectedType);
              showToast(result, "success");
              setResolvedItems(prev => new Set(prev).add(orphanName));
          } catch (e: any) { showToast("Erro: " + e.message, "warning"); }
          finally { setIsProcessing(false); }
      }
  };

  const handleHealSector = async (badName: string) => {
      const targetLabel = targetMap[badName];
      const selectedSector = proSectors.find(s => s.name === targetLabel);
      if (!selectedSector) { showToast("Selecione um setor oficial da lista.", "warning"); return; }

      setIsProcessing(true);
      try {
          const result = await healSectorConnection(badName, selectedSector.id);
          showToast(result, "success");
          setResolvedItems(prev => new Set(prev).add(badName));
          setTargetMap(prev => { const n = {...prev}; delete n[badName]; return n; });
      } catch (e: any) { showToast("Erro: " + e.message, "warning"); }
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

          const staff = proStaff.find(s => String(s.id) === targetStaffId);
          if (staff) {
              participantType = 'Colaborador';
              sectorId = staff.sectorId;
          } else if (proPatients.find(p => String(p.id) === targetStaffId)) {
              participantType = 'Paciente';
          } else if (proProviders.find(p => String(p.id) === targetStaffId)) {
              participantType = 'Prestador';
          }

          const msg = await linkStudySessionIdentity(orphanName, targetStaffId, sectorId, participantType);
          showToast(msg, "success");
          setResolvedItems(prev => new Set(prev).add(orphanName));
      } catch (e: any) {
          showToast(e.message, "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const isHealthy = (name: string) => {
      const norm = normalizeString(name);
      return proStaff.some(s => normalizeString(s.name) === norm) ||
             proPatients.some(p => normalizeString(p.name) === norm) ||
             proProviders.some(p => normalizeString(p.name) === norm);
  };

  const duplicatePGs = useMemo(() => {
    const duplicates: { name: string, unit: string, groups: ProGroup[] }[] = [];

    ['HAB', 'HABA'].forEach(unit => {
      const unitGroups = proGroups.filter(g => g.unit === unit && g.active !== false);
      const nameMap = new Map<string, ProGroup[]>();
      
      unitGroups.forEach(g => {
        const norm = normalizeString(g.name);
        if (!nameMap.has(norm)) nameMap.set(norm, []);
        nameMap.get(norm)!.push(g);
      });

      nameMap.forEach((list) => {
        if (list.length > 1) {
          duplicates.push({ name: list[0].name, unit: unit, groups: list });
        }
      });
    });

    return duplicates;
  }, [proGroups]);

  const handleMergePGs = async (sourceId: string, targetId: string) => {
    setIsProcessing(true);
    try {
      const result = await mergePGs(sourceId, targetId);
      if (result.success) {
        showToast(result.message, "success");
      } else {
        showToast(result.message, "warning");
      }
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const healthScore = useMemo(() => {
    const totalOrphans = peopleOrphans.length + studyOrphans.length + sectorOrphans.length + attendeeOrphans.length + duplicatePGs.length;
    if (totalOrphans === 0) return 100;
    // Cada anomalia reduz 2 pontos, mínimo 0.
    const score = 100 - (totalOrphans * 2);
    return Math.max(0, score);
  }, [peopleOrphans, studyOrphans, sectorOrphans, attendeeOrphans, duplicatePGs]);

  return {
    activeTab, setActiveTab,
    activeStudyTab, setActiveStudyTab,
    targetMap, setTargetMap,
    studyTargetMap, setStudyTargetMap,
    sectorMap, setSectorMap,
    searchQuery, setSearchQuery,
    filterClassOnly, setFilterClassOnly,
    personTypeMap, setPersonTypeMap,
    attendeeOrphans, isLoadingAttendees,
    isProcessing, showAllHistory, setShowAllHistory,
    studyOrphans, peopleOrphans, sectorOrphans,
    officialStaffOptions, officialPatientOptions, officialProviderOptions, officialSectorOptions,
    filteredPeopleList,
    handleProcessPerson, handleHealSector, handleLinkStudy, isHealthy,
    healthScore,
    duplicatePGs,
    handleMergePGs
  };
};
