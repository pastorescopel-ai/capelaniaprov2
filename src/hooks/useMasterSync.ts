
import { useCallback } from 'react';
import { ParticipantType, Unit, ProPatient, ProProvider } from '../types';
import { normalizeString } from '../utils/formatters';
import { DataRepository } from '../services/dataRepository';

export const useMasterSync = (
  proStaff: any[],
  proSectors: any[],
  proPatients: any[],
  proProviders: any[],
  visitRequests: any[],
  saveRecord: (collection: string, item: any) => Promise<boolean>
) => {
  // Retorna o id oficial (existente ou recém-criado) do contato sincronizado, para que quem
  // chama nunca fique com participantId/providerId vazio quando o registro é novo — antes, o
  // id era lido do estado local ANTES desta função criar o registro novo, então a criação
  // acontecia mas o formulário já tinha enviado o registro pai com o id em branco.
  const syncMasterContact = useCallback(async (name: string, phone: string, unit: Unit, type: ParticipantType, extra?: string): Promise<string | undefined> => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!name) return undefined;

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
        return staff?.id;
    } else if (type === ParticipantType.PATIENT) {
        const patient = proPatients.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (!patient) {
            // pro_patients.id é BIGINT (auto-incremento) — nunca um id gerado no cliente.
            // Insere direto via DataRepository (em vez de saveRecord) para conseguir ler de
            // volta o id real que o Postgres atribuiu, e devolvê-lo a quem chamou.
            const payload = { name, unit, whatsapp: cleanPhone, updatedAt: Date.now() } as any;
            const result = await DataRepository.upsertRecord('proPatients', payload);
            return result.success && result.data?.[0] ? result.data[0].id : undefined;
        }
        if (cleanPhone && cleanPhone !== (patient.whatsapp || '')) {
            await saveRecord('proPatients', { ...patient, whatsapp: cleanPhone, updatedAt: Date.now() } as ProPatient);
        }
        return patient.id;
    } else if (type === ParticipantType.PROVIDER) {
        const provider = proProviders.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (!provider) {
            // pro_providers.id também é BIGINT — mesma lógica do ramo de Paciente acima.
            const payload = { name, unit, whatsapp: cleanPhone, sector: extra, updatedAt: Date.now() } as any;
            const result = await DataRepository.upsertRecord('proProviders', payload);
            return result.success && result.data?.[0] ? result.data[0].id : undefined;
        }
        if ((cleanPhone && cleanPhone !== (provider.whatsapp || '')) || (extra && extra !== provider.sector)) {
            await saveRecord('proProviders', { ...provider, whatsapp: cleanPhone || provider.whatsapp, sector: extra || provider.sector, updatedAt: Date.now() } as ProProvider);
        }
        return provider.id;
    }
    return undefined;
  }, [proStaff, proSectors, proPatients, proProviders, visitRequests, saveRecord]);

  return { syncMasterContact };
};
