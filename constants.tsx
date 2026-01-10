
import React from 'react';
import { UserRole, RecordStatus, VisitReason, Config } from './types';

// =============================================================================
// CONFIGURAÇÕES INTERNAS DO SISTEMA (COLE SEUS DADOS AQUI)
// =============================================================================

/**
 * 1. URL DO GOOGLE APPS SCRIPT
 */
export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwMB8cug1XCpVPkoqRac8A-zk2DEgT-r-t4v7bFK5lU0Q52OJvqh4Q0-h56okfv4Kwh/exec';

/**
 * 2. LOGO DO APLICATIVO (BASE64)
 */
export const APP_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

/**
 * 3. LOGO DO RELATÓRIO (BASE64)
 */
export const REPORT_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

/**
 * 4. ITENS DE NAVEGAÇÃO
 */
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: [UserRole.ADMIN, UserRole.CHAPLAIN] },
  { id: 'bibleStudy', label: 'Estudo Bíblico', icon: '📖', roles: [UserRole.ADMIN, UserRole.CHAPLAIN] },
  { id: 'bibleClass', label: 'Classe Bíblica', icon: '👥', roles: [UserRole.ADMIN, UserRole.CHAPLAIN] },
  { id: 'smallGroup', label: 'Pequeno Grupo', icon: '🏠', roles: [UserRole.ADMIN, UserRole.CHAPLAIN] },
  { id: 'staffVisit', label: 'Visita Colaborador', icon: '🤝', roles: [UserRole.ADMIN, UserRole.CHAPLAIN] },
  { id: 'reports', label: 'Relatórios', icon: '📈', roles: [UserRole.ADMIN] },
  { id: 'users', label: 'Usuários', icon: '👤', roles: [UserRole.ADMIN] },
  { id: 'profile', label: 'Meu Perfil', icon: '⚙️', roles: [UserRole.ADMIN, UserRole.CHAPLAIN] },
  { id: 'admin', label: 'Painel Admin', icon: '🛠️', roles: [UserRole.ADMIN] },
];

/**
 * 5. OPÇÕES DE STATUS
 */
export const STATUS_OPTIONS = [
  RecordStatus.INICIO,
  RecordStatus.CONTINUACAO,
  RecordStatus.TERMINO
];

/**
 * 6. MOTIVOS DE VISITA
 */
export const VISIT_REASONS = Object.values(VisitReason);

/**
 * 7. CONFIGURAÇÃO INICIAL
 */
export const INITIAL_CONFIG: Config = {
  googleSheetUrl: GOOGLE_SCRIPT_URL,
  appLogo: APP_LOGO_BASE64,
  reportLogo: REPORT_LOGO_BASE64,
  muralText: 'Bem-vindo ao sistema de gestão de Capelania!',
  headerLine1: 'INSTITUIÇÃO HOSPITALAR',
  headerLine2: 'DEPARTAMENTO DE CAPELANIA',
  headerLine3: 'RELATÓRIO DE ATIVIDADES ESPIRITUAIS',
  fontSize1: 24,
  fontSize2: 18,
  fontSize3: 14,
  reportLogoWidth: 100,
  reportLogoX: 50,
  reportLogoY: 20,
  headerPaddingTop: 40,
  headerTextAlign: 'center'
};
