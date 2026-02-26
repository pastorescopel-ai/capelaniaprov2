
import { UserRole, Config, Unit, RecordStatus } from './types';

export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "https://qksbywkshuznbuyzwljx.supabase.co";
export const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_KEY || "sb_publishable_44GfukXRPHT92-DXRpEmSg_0CTgXA09";

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
  { id: 'pgManagement', label: 'Gestão de PGs', icon: '🧩', roles: [UserRole.ADMIN] },
  { id: 'ambassadors', label: 'Embaixadores', icon: '🌟', roles: [UserRole.ADMIN, UserRole.CHAPLAIN, UserRole.INTERN] },
  { id: 'reports', label: 'Relatórios', icon: '📈', roles: [UserRole.ADMIN] },
  { id: 'users', label: 'Equipe', icon: '👥', roles: [UserRole.ADMIN] },
  { id: 'dataHealing', label: 'Cura de Dados', icon: '🚑', roles: [UserRole.ADMIN] }, // NOVO ITEM
  { id: 'profile', label: 'Perfil', icon: '👤', roles: [UserRole.ADMIN, UserRole.CHAPLAIN, UserRole.INTERN] },
  { id: 'admin', label: 'Painel Admin', icon: '⚙️', roles: [UserRole.ADMIN] },
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
  primaryColor: '#005a9c'
};
