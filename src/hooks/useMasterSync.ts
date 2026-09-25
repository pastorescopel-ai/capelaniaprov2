
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
  const syncMasterContact = useCallback(async (
    name: string,
    phone: string,
    unit: Unit,
    type: ParticipantType,
    extra?: string,
    // Só usado por PATIENT, pra resolver o "check de identidade" feito no formulário --
    // ver useBibleStudyForm.ts. `extra` continua carregando o leito/setor atual (`bed`) pra
    // este tipo, no mesmo slot que já era usado como setor pra PROVIDER.
    patientIdentity?: { explicitId?: string; forceCreate?: boolean }
  ): Promise<string | undefined> => {
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
        // `extra` carrega o leito/setor atual digitado agora (ex: "UI 7 - Leito 12") --
        // guardado em pro_patients.bed só como hint mutável, nunca como identidade rígida.
        const bed = (extra || '').trim();

        // CASO 1: o capelão já confirmou no formulário "é o mesmo paciente de antes" (ver o
        // check de identidade em useBibleStudyForm.ts) -- usa o id direto, SEM pesquisar por
        // nome de novo. Só atualiza o leito se mudou (ex: paciente foi transferido de setor).
        if (patientIdentity?.explicitId) {
            const existing = proPatients.find(p => String(p.id) === String(patientIdentity.explicitId));
            if (existing && bed && bed !== (existing.bed || '')) {
                await saveRecord('proPatients', { ...existing, bed, updatedAt: Date.now() } as ProPatient);
            }
            return String(patientIdentity.explicitId);
        }

        // CASO 2: o capelão confirmou "NÃO é o mesmo -- é outra pessoa com o mesmo nome" (ex:
        // paciente teve alta e outro com nome igual ocupou o leito). Cria um cadastro novo
        // mesmo já existindo alguém com esse nome, em vez de reaproveitar o antigo por engano.
        if (patientIdentity?.forceCreate) {
            const payload = { name, unit, whatsapp: isValidWhatsApp(cleanPhone) ? cleanPhone : '', bed, updatedAt: Date.now() } as any;
            const result = await DataRepository.upsertRecord('proPatients', payload);
            return result.success && result.data?.[0] ? result.data[0].id : undefined;
        }

        // CASO 3 (padrão, sem check -- chamadores que ainda não passam pela UI de confirmação):
        // mesmo comportamento de sempre, casando só por nome+unidade. Só é seguro quando NÃO
        // existe ambiguidade (nenhum outro paciente com esse nome); o formulário com o check
        // (Estudo Bíblico Individual) nunca deixa cair aqui quando há mais de um candidato.
        const patient = proPatients.find(p => normalizeString(p.name) === normName && p.unit === unit);
        if (!patient) {
            // pro_patients.id é BIGINT (auto-incremento) — nunca um id gerado no cliente.
            // Insere direto via DataRepository (em vez de saveRecord) para conseguir ler de
            // volta o id real que o Postgres atribuiu, e devolvê-lo a quem chamou.
            const payload = { name, unit, whatsapp: isValidWhatsApp(cleanPhone) ? cleanPhone : '', bed, updatedAt: Date.now() } as any;
            const result = await DataRepository.upsertRecord('proPatients', payload);
            return result.success && result.data?.[0] ? result.data[0].id : undefined;
        }
        if (bed && bed !== (patient.bed || '')) {
            await saveRecord('proPatients', { ...patient, bed, updatedAt: Date.now() } as ProPatient);
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
