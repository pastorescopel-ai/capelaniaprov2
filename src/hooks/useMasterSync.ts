
import { useCallback } from 'react';
import { ParticipantType, Unit, ProPatient, ProProvider } from '../types';
import { normalizeString } from '../utils/formatters';
import { isValidWhatsApp } from '../utils/validators';
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

    // BLOQUEIO (2026-08-14): esta função NUNCA MAIS sobrescreve o WhatsApp de um cadastro que
    // já existe (colaborador, paciente ou prestador). Isso já corrompeu números certos pelo
    // menos duas vezes (maio e julho/2026) e é o suspeito nº1 do incidente em massa de 05/08 --
    // um formulário de Visita/PG/Estudo Bíblico não é o lugar certo para "corrigir" o telefone
    // mestre de alguém: quem preenche o formulário pode digitar incompleto, pode estar vendo o
    // número errado de um homônimo, ou o campo pode nem ser sobre a pessoa certa. O número só é
    // gravado aqui na CRIAÇÃO de um cadastro novo (que ainda não tem nenhum número a proteger).
    // Qualquer correção de um número já cadastrado precisa ser uma ação explícita e deliberada
    // em uma tela de edição dedicada, nunca um efeito colateral de salvar outro formulário.
    if (type === ParticipantType.STAFF) {
        const staff = proStaff.find(s => normalizeString(s.name) === normName && s.unit === unit);
        if (staff && extra) {
            const targetSector = proSectors.find(s => s.name === extra && s.unit === unit);
            if (targetSector && staff.sectorId !== targetSector.id) {
                await saveRecord('proStaff', { ...staff, sectorId: targetSector.id, updatedAt: Date.now() });
            }
        }
        return staff?.id;
    } else if (type === ParticipantType.PATIENT) {
        const patient = proPatients.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (!patient) {
            // pro_patients.id é BIGINT (auto-incremento) — nunca um id gerado no cliente.
            // Insere direto via DataRepository (em vez de saveRecord) para conseguir ler de
            // volta o id real que o Postgres atribuiu, e devolvê-lo a quem chamou.
            const payload = { name, unit, whatsapp: isValidWhatsApp(cleanPhone) ? cleanPhone : '', updatedAt: Date.now() } as any;
            const result = await DataRepository.upsertRecord('proPatients', payload);
            return result.success && result.data?.[0] ? result.data[0].id : undefined;
        }
        return patient.id;
    } else if (type === ParticipantType.PROVIDER) {
        const provider = proProviders.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (!provider) {
            // pro_providers.id também é BIGINT — mesma lógica do ramo de Paciente acima.
            const payload = { name, unit, whatsapp: isValidWhatsApp(cleanPhone) ? cleanPhone : '', sector: extra, updatedAt: Date.now() } as any;
            const result = await DataRepository.upsertRecord('proProviders', payload);
            return result.success && result.data?.[0] ? result.data[0].id : undefined;
        }
        if (extra && extra !== provider.sector) {
            await saveRecord('proProviders', { ...provider, sector: extra, updatedAt: Date.now() } as ProProvider);
        }
        return provider.id;
    }
    return undefined;
  }, [proStaff, proSectors, proPatients, proProviders, visitRequests, saveRecord]);

  return { syncMasterContact };
};
