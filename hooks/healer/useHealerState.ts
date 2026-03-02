import { useState } from 'react';
import { ParticipantType } from '../../types';
import { HealerTab, PersonType } from '../useDataHealer';

export const useHealerState = () => {
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

  return {
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
  };
};
