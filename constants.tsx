
import { UserRole, Config, Unit, RecordStatus } from './types';

declare global {
  interface Window {
    __SUPABASE_CONFIG__?: {
      supabaseUrl: string;
      supabaseKey: string;
    };
  }
}

const config = window.__SUPABASE_CONFIG__ || {};
const env = (import.meta as any).env || {};

export const SUPABASE_URL = config.supabaseUrl || env.VITE_SUPABASE_URL || "";
export const SUPABASE_KEY = config.supabaseKey || env.VITE_SUPABASE_KEY || "";

console.log("DEBUG: SUPABASE_URL =", SUPABASE_URL);
console.log("DEBUG: SUPABASE_KEY =", SUPABASE_KEY);

/**
 * DEFAULT_APP_LOGO movido para importação direta de assets.ts
 * REPORT_LOGO_BASE64 movido para importação direta de assets.ts
 */

export const STATUS_OPTIONS = [RecordStatus.INICIO, RecordStatus.CONTINUACAO, RecordStatus.TERMINO];

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: [UserRole.ADMIN, UserRole.CHAPLAIN, UserRole.INTERN] },
  { id: 'bibleStudy', label: 'Estudo Bíblico', icon: '📖', roles: [UserRole.ADMIN, UserRole.CHAPLAIN, UserRole.INTERN] },
  { id: 'bibleClass', label: 'Classe Bíblica', icon: '👥', roles: [UserRole.ADMIN, UserRole.CHAPLAIN, UserRole.INTERN] },
  { id: 'smallGroup', label: 'Pequenos Grupos', icon: '🏠', roles: [UserRole.ADMIN, UserRole.CHAPLAIN, UserRole.INTERN] },
  { id: 'staffVisit', label: 'Visitas', icon: '🤝', roles: [UserRole.ADMIN, UserRole.CHAPLAIN, UserRole.INTERN] },
  { id: 'activities', label: 'Atividades', icon: '📋', roles: [UserRole.ADMIN, UserRole.CHAPLAIN, UserRole.INTERN] },
  { id: 'pgManagement', label: 'Gestão de PGs', icon: '🧩', roles: [UserRole.ADMIN] },
  { id: 'ambassadors', label: 'Embaixadores', icon: '🌟', roles: [UserRole.ADMIN] },
  { id: 'reports', label: 'Relatórios', icon: '📈', roles: [UserRole.ADMIN] },
  { id: 'users', label: 'Equipe', icon: '👥', roles: [UserRole.ADMIN] },
  { id: 'dataHealing', label: 'Auditoria de Qualidade', icon: '🛡️', roles: [UserRole.ADMIN] }, // RENOMEADO
  { id: 'profile', label: 'Perfil', icon: '👤', roles: [UserRole.ADMIN, UserRole.CHAPLAIN, UserRole.INTERN] },
  { id: 'admin', label: 'Painel Admin', icon: '⚙️', roles: [UserRole.ADMIN] },
];

export const BLUEPRINT_LOCATIONS = [
  "Recepção Diagnóstico",
  "Endoscopia",
  "Sala de Espera Raio X",
  "Sala de Espera Diagnóstico",
  "Recepção Consultórios (Microfone)",
  "Recepção Oncologia",
  "Oncologia",
  "Recepção Laboratório",
  "Internamento",
  "Microfone Internamento",
  "Microfone Centro Cirúrgico",
  "Sala de Espera do Centro Cirúrgico"
];

export const INITIAL_CONFIG: Config = {
  muralText: "Bem-vindo ao sistema de capelania!",
  headerLine1: "Hospital Adventista de Belém",
  headerLine2: "Departamento de Capelania",
  headerLine3: "Setor de Assistência Espiritual",
  fontSize1: 24,
  fontSize2: 18,
  fontSize3: 12,
  reportLogoWidth: 150,
  reportLogoX: 40,
  reportLogoY: 20,
  headerLine1X: 200,
  headerLine1Y: 30,
  headerLine2X: 200,
  headerLine2Y: 65,
  headerLine3X: 200,
  headerLine3Y: 90,
  headerPaddingTop: 30,
  headerTextAlign: 'left',
  primaryColor: '#005a9c',
  headerProfiles: {
    ambassadors: {
      id: 'ambassadors',
      name: 'Embaixadores da Esperança',
      logoWidth: 100,
      logoX: 40,
      logoY: 20,
      paddingTop: 0,
      textAlign: 'left',
      lines: [
        { id: 'title', text: 'Embaixadores da Esperança', fontSize: 24, color: '#005a9c', x: 160, y: 30, fontWeight: '900', textTransform: 'uppercase' },
        { id: 'line1', text: 'Hospital Adventista de Belém', fontSize: 18, color: '#475569', x: 160, y: 60, fontWeight: 'bold', textTransform: 'uppercase' },
        { id: 'line2', text: 'Departamento de Capelania', fontSize: 12, color: '#94a3b8', x: 160, y: 90, fontWeight: 'normal', textTransform: 'uppercase' }
      ]
    },
    chaplaincy: {
      id: 'chaplaincy',
      name: 'Relatório de Capelania',
      logoWidth: 100,
      logoX: 40,
      logoY: 20,
      paddingTop: 0,
      textAlign: 'left',
      lines: [
        { id: 'title', text: 'Relatório de Capelania', fontSize: 24, color: '#005a9c', x: 160, y: 30, fontWeight: '900', textTransform: 'uppercase' },
        { id: 'line1', text: 'Hospital Adventista de Belém', fontSize: 18, color: '#475569', x: 160, y: 60, fontWeight: 'bold', textTransform: 'uppercase' },
        { id: 'line2', text: 'Departamento de Capelania', fontSize: 12, color: '#94a3b8', x: 160, y: 90, fontWeight: 'normal', textTransform: 'uppercase' }
      ]
    },
    smallGroups: {
      id: 'smallGroups',
      name: 'Pequenos Grupos',
      logoWidth: 100,
      logoX: 40,
      logoY: 20,
      paddingTop: 0,
      textAlign: 'left',
      lines: [
        { id: 'title', text: 'Pequenos Grupos', fontSize: 24, color: '#005a9c', x: 160, y: 30, fontWeight: '900', textTransform: 'uppercase' },
        { id: 'line1', text: 'Hospital Adventista de Belém', fontSize: 18, color: '#475569', x: 160, y: 60, fontWeight: 'bold', textTransform: 'uppercase' },
        { id: 'line2', text: 'Departamento de Capelania', fontSize: 12, color: '#94a3b8', x: 160, y: 90, fontWeight: 'normal', textTransform: 'uppercase' }
      ]
    }
  }
};
