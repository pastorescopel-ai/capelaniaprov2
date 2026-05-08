import { useState, useEffect } from 'react';
import { ParticipantType } from '../../types';
import { HealerTab, PersonType } from '../useDataHealer';

export const useHealerState = () => {
  const [selectedUnit, setSelectedUnit] = useState<'HAB' | 'HABA'>('HAB');
  const [activeTab, setActiveTab] = useState<HealerTab>(() => (sessionStorage.getItem('healer_activeTab') as HealerTab) || 'people');
  const [activeStudyTab, setActiveStudyTab] = useState<ParticipantType>(ParticipantType.STAFF);
  
  const [targetMap, setTargetMap] = useState<Record<string, string>>(() => {
    try {
      const saved = sessionStorage.getItem('healer_targetMap');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [studyTargetMap, setStudyTargetMap] = useState<Record<string, string>>(() => {
    try {
      const saved = sessionStorage.getItem('healer_studyTargetMap');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [sectorMap, setSectorMap] = useState<Record<string, string>>(() => {
    try {
      const saved = sessionStorage.getItem('healer_sectorMap');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassOnly, setFilterClassOnly] = useState(false);
  
  const [personTypeMap, setPersonTypeMap] = useState<Record<string, PersonType>>(() => {
    try {
      const saved = sessionStorage.getItem('healer_personTypeMap');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [resolvedItems, setResolvedItems] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem('healer_resolvedItems');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const [attendeeOrphans, setAttendeeOrphans] = useState<{name: string, count: number}[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [mergeSourceType, setMergeSourceType] = useState<PersonType>('Prestador');
  const [mergeSourceId, setMergeSourceId] = useState<string>('');
  const [mergeTargetType, setMergeTargetType] = useState<PersonType>('Colaborador');
  const [mergeTargetId, setMergeTargetId] = useState<string>('');

  // Persistência
  useEffect(() => {
    sessionStorage.setItem('healer_targetMap', JSON.stringify(targetMap));
  }, [targetMap]);

  useEffect(() => {
    sessionStorage.setItem('healer_studyTargetMap', JSON.stringify(studyTargetMap));
  }, [studyTargetMap]);

  useEffect(() => {
    sessionStorage.setItem('healer_sectorMap', JSON.stringify(sectorMap));
  }, [sectorMap]);

  useEffect(() => {
    sessionStorage.setItem('healer_personTypeMap', JSON.stringify(personTypeMap));
  }, [personTypeMap]);

  useEffect(() => {
    sessionStorage.setItem('healer_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    sessionStorage.setItem('healer_resolvedItems', JSON.stringify(Array.from(resolvedItems)));
  }, [resolvedItems]);

  return {
    selectedUnit, setSelectedUnit,
    activeTab, setActiveTab,
    activeStudyTab, setActiveStudyTab,
    targetMap, setTargetMap,
    studyTargetMap, setStudyTargetMap,
    sectorMap, setSectorMap,
    searchQuery, setSearchQuery,
    filterClassOnly, setFilterClassOnly,
    personTypeMap, setPersonTypeMap,
    resolvedItems, setResolvedItems,
    attendeeOrphans, setAttendeeOrphans,
    isLoadingAttendees, setIsLoadingAttendees,
    isProcessing, setIsProcessing,
    showAllHistory, setShowAllHistory,
    mergeSourceType, setMergeSourceType,
    mergeSourceId, setMergeSourceId,
    mergeTargetType, setMergeTargetType,
    mergeTargetId, setMergeTargetId,
  };
};
