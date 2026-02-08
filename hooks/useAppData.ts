
import { useState, useEffect, useCallback } from 'react';
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, Config, VisitRequest, ProStaff, ProSector, ProGroup, ProGroupLocation, ProGroupMember, ProPatient, ProProvider, ParticipantType, Unit } from '../types';
import { DataRepository } from '../services/dataRepository';
import { INITIAL_CONFIG } from '../constants';
import { supabase } from '../services/supabaseClient';
import { normalizeString } from '../utils/formatters';

export const useAppData = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [bibleStudies, setBibleStudies] = useState<BibleStudy[]>([]);
  const [bibleClasses, setBibleClasses] = useState<BibleClass[]>([]);
  const [smallGroups, setSmallGroups] = useState<SmallGroup[]>([]);
  const [staffVisits, setStaffVisits] = useState<StaffVisit[]>([]);
  const [visitRequests, setVisitRequests] = useState<VisitRequest[]>([]);
  
  const [proStaff, setProStaff] = useState<ProStaff[]>([]);
  const [proPatients, setProPatients] = useState<ProPatient[]>([]);
  const [proProviders, setProProviders] = useState<ProProvider[]>([]);
  const [proSectors, setProSectors] = useState<ProSector[]>([]);
  const [proGroups, setProGroups] = useState<ProGroup[]>([]);
  const [proGroupLocations, setProGroupLocations] = useState<ProGroupLocation[]>([]);
  const [proGroupMembers, setProGroupMembers] = useState<ProGroupMember[]>([]);
  
  const [config, setConfig] = useState<Config>(INITIAL_CONFIG);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const applySystemOverrides = useCallback((baseConfig: Config) => {
    if (baseConfig.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', baseConfig.primaryColor);
    }
    return baseConfig;
  }, []);

  const loadFromCloud = useCallback(async (showLoader = false) => {
    if (showLoader) setIsSyncing(true);
    try {
      const data = await DataRepository.syncAll();
      if (data) {
        setUsers(data.users || []);
        setBibleStudies(data.bibleStudies || []);
        setBibleClasses(data.bibleClasses || []);
        setSmallGroups(data.smallGroups || []);
        setStaffVisits(data.staffVisits || []);
        setVisitRequests(data.visitRequests || []);
        setProStaff(data.proStaff || []);
        setProPatients(data.proPatients || []);
        setProProviders(data.proProviders || []);
        setProSectors(data.proSectors || []);
        setProGroups(data.proGroups || []);
        setProGroupLocations(data.proGroupLocations || []);
        setProGroupMembers(data.proGroupMembers || []);
        if (data.config) {
          setConfig(data.config);
          applySystemOverrides(data.config);
        }
        setIsConnected(true);
      }
    } catch (e) {
      setIsConnected(false);
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [applySystemOverrides]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('realtime-db').on('postgres_changes', { event: '*', schema: 'public' }, () => loadFromCloud(false)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadFromCloud]);

  const saveRecord = async (collection: string, item: any) => {
    const success = await DataRepository.upsertRecord(collection, item);
    if (success) await loadFromCloud(false);
    return success;
  };

  /**
   * ULTIMATE_ENTITY_SYNC_ENGINE (V4.1 - Enhanced Sector Healing)
   * Motor de persistência centralizada para contatos e vínculos.
   * Garante que o banco mestre RH reflita correções de telefone E SETOR feitas em formulários.
   */
  const syncMasterContact = async (name: string, phone: string, unit: Unit, type: ParticipantType, extra?: string) => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!name) return; // Nome é obrigatório para localizar

    const normName = normalizeString(name);

    if (type === ParticipantType.STAFF) {
        // Localiza pelo nome normalizado e unidade
        const staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);
        if (staff) {
            let updates: any = {};
            let hasUpdates = false;

            // 1. Cura do Telefone
            if (cleanPhone && cleanPhone.length >= 8 && cleanPhone !== (staff.whatsapp || '')) {
                updates.whatsapp = cleanPhone;
                hasUpdates = true;
            }

            // 2. Cura do Vínculo de Setor (O "Imã")
            // Se um setor foi informado (extra) e é diferente do atual, move o colaborador.
            if (extra) {
                const targetSector = proSectors.find(s => s.name === extra && s.unit === unit);
                if (targetSector && staff.sectorId !== targetSector.id) {
                    updates.sectorId = targetSector.id;
                    updates.updatedAt = Date.now();
                    hasUpdates = true;
                    console.log(`[DataHealing] Movendo ${staff.name} para o setor ${extra}`);
                }
            }

            if (hasUpdates) {
                // Atualização silenciosa do RH oficial
                await saveRecord('proStaff', { ...staff, ...updates });
            }
        }
    } else if (type === ParticipantType.PATIENT) {
        const patient = proPatients.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (!patient || (cleanPhone && cleanPhone !== (patient.whatsapp || ''))) {
            const payload: ProPatient = patient 
                ? { ...patient, whatsapp: cleanPhone || patient.whatsapp, updatedAt: Date.now() }
                : { id: crypto.randomUUID(), name, unit, whatsapp: cleanPhone, updatedAt: Date.now() };
            await saveRecord('proPatients', payload);
        }
    } else if (type === ParticipantType.PROVIDER) {
        const provider = proProviders.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (!provider || (cleanPhone && cleanPhone !== (provider.whatsapp || '')) || (extra && extra !== provider.sector)) {
            const payload: ProProvider = provider
                ? { ...provider, whatsapp: cleanPhone || provider.whatsapp, sector: extra || provider.sector, updatedAt: Date.now() }
                : { id: crypto.randomUUID(), name, unit, whatsapp: cleanPhone, sector: extra, updatedAt: Date.now() };
            await saveRecord('proProviders', payload);
        }
    }
  };

  const deleteRecord = async (collection: string, id: string) => {
    const success = await DataRepository.deleteRecord(collection, id);
    if (success) await loadFromCloud(false);
    return success;
  };

  const saveToCloud = useCallback(async (overrides?: any, showLoader = false) => {
    if (showLoader) setIsSyncing(true);
    try {
      if (overrides?.config) await saveRecord('config', overrides.config);
      if (overrides?.users) await saveRecord('users', overrides.users);
      if (overrides?.proSectors) await saveRecord('proSectors', overrides.proSectors);
      if (overrides?.proStaff) await saveRecord('proStaff', overrides.proStaff);
      if (overrides?.proPatients) await saveRecord('proPatients', overrides.proPatients);
      if (overrides?.proProviders) await saveRecord('proProviders', overrides.proProviders);
      if (overrides?.proGroups) await saveRecord('proGroups', overrides.proGroups);
      if (overrides?.proGroupLocations) await saveRecord('proGroupLocations', overrides.proGroupLocations);
      if (overrides?.proGroupMembers) await saveRecord('proGroupMembers', overrides.proGroupMembers);
      return true;
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [saveRecord]);

  useEffect(() => {
    if (!isInitialized) { loadFromCloud(true); setIsInitialized(true); }
  }, [loadFromCloud, isInitialized]);

  return {
    users, bibleStudies, bibleClasses, smallGroups, staffVisits, visitRequests,
    proStaff, proPatients, proProviders, proSectors, proGroups, proGroupLocations, proGroupMembers, config, isSyncing, isConnected, 
    loadFromCloud, saveToCloud, saveRecord, deleteRecord, applySystemOverrides, syncMasterContact
  };
};
