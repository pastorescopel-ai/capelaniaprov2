
import { useCallback } from 'react';
import { ParticipantType, Unit, ProPatient, ProProvider } from '../types';
import { normalizeString } from '../utils/formatters';

export const useMasterSync = (
  proStaff: any[], 
  proSectors: any[], 
  proPatients: any[], 
  proProviders: any[], 
  visitRequests: any[], 
  saveRecord: (collection: string, item: any) => Promise<boolean>
) => {
  const syncMasterContact = useCallback(async (name: string, phone: string, unit: Unit, type: ParticipantType, extra?: string) => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!name) return; 

    const normName = normalizeString(name);

    if (type === ParticipantType.STAFF) {
        const staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);
        if (staff) {
            const updates: any = {};
            let hasUpdates = false;

            if (cleanPhone && cleanPhone.length >= 8 && cleanPhone !== (staff.whatsapp || '')) {
                updates.whatsapp = cleanPhone;
                hasUpdates = true;
            }

            if (extra) {
                const targetSector = proSectors.find(s => s.name === extra && s.unit === unit);
                if (targetSector && staff.sectorId !== targetSector.id) {
                    updates.sectorId = targetSector.id;
                    updates.updatedAt = Date.now();
                    hasUpdates = true;
                }
            }

            if (hasUpdates) {
                await saveRecord('proStaff', { ...staff, ...updates });
                
                if (updates.whatsapp) {
                    const pendingRequests = visitRequests.filter(req => 
                        req.unit === unit && 
                        req.status === 'assigned' && 
                        normalizeString(req.leaderName) === normName &&
                        req.leaderPhone !== updates.whatsapp
                    );
                    
                    for (const req of pendingRequests) {
                        await saveRecord('visitRequests', { ...req, leaderPhone: updates.whatsapp });
                    }
                }
            }
        }
    } else if (type === ParticipantType.PATIENT) {
        const patient = proPatients.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (!patient || (cleanPhone && cleanPhone !== (patient.whatsapp || ''))) {
            const payload: ProPatient = patient 
                ? { ...patient, whatsapp: cleanPhone || patient.whatsapp, updatedAt: Date.now() }
                : { id: crypto.randomUUID(), name, unit, whatsapp: cleanPhone, updatedAt: Date.now() } as any;
            await saveRecord('proPatients', payload);
        }
    } else if (type === ParticipantType.PROVIDER) {
        const provider = proProviders.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (!provider || (cleanPhone && cleanPhone !== (provider.whatsapp || '')) || (extra && extra !== provider.sector)) {
            const payload: ProProvider = provider
                ? { ...provider, whatsapp: cleanPhone || provider.whatsapp, sector: extra || provider.sector, updatedAt: Date.now() }
                : { id: crypto.randomUUID(), name, unit, whatsapp: cleanPhone, sector: extra, updatedAt: Date.now() } as any;
            await saveRecord('proProviders', payload);
        }
    }
  }, [proStaff, proSectors, proPatients, proProviders, visitRequests, saveRecord]);

  return { syncMasterContact };
};
