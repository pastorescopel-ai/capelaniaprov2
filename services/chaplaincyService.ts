
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DA PONTE COM CAPELANIA PRO ---
// Usamos as credenciais públicas do App de Capelania para permitir
// que o App de PGs "deposite" pedidos de visita na tabela 'visit_requests'.

const CHAPLAINCY_URL = "https://qksbywkshuznbuyzwljx.supabase.co";
const CHAPLAINCY_KEY = "sb_publishable_44GfukXRPHT92-DXRpEmSg_0CTgXA09";

export const chaplaincyClient = createClient(CHAPLAINCY_URL, CHAPLAINCY_KEY);

export interface InvitePayload {
  pg_name: string;
  leader_name: string;
  leader_phone?: string;
  unit: 'HAB' | 'HABA';
  date: string; // ISO String com fuso horário
  request_notes?: string;
  preferred_chaplain_id?: string;
}

export const sendChaplainInvite = async (data: InvitePayload) => {
  try {
    console.log("Enviando solicitação para Capelania:", data);
    
    const { error } = await chaplaincyClient
      .from('visit_requests')
      .insert({
        pg_name: data.pg_name,
        leader_name: data.leader_name,
        leader_phone: data.leader_phone,
        unit: data.unit,
        date: data.date,
        request_notes: data.request_notes,
        preferred_chaplain_id: data.preferred_chaplain_id || null,
        status: 'pending' // Status inicial padrão
      });

    if (error) {
      console.error("Erro Supabase:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Erro de conexão com serviço de capelania:", e);
    return false;
  }
};
