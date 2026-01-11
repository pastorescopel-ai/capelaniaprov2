
import React from 'react';
import { UserRole, RecordStatus, VisitReason, Config } from './types';

export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwMB8cug1XCpVPkoqRac8A-zk2DEgT-r-t4v7bFK5lU0Q52OJvqh4Q0-h56okfv4Kwh/exec';

export const APP_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAGDf+RsAAAACXBIWXMAAAsTAAALEwEAmpwYAAAGOWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4xLWMwMDIgNzkuYjdjNjRjY2Y5LCAyMDI0LzA3LzE2LTEyOjM5OjA0ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjYuMSAoTWFjaW50b3NoKSIgeG1wOkNyZWF0_DATE_20250312';

export const REPORT_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAbgAAAG4CAYAAADt...';

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

export const STATUS_OPTIONS = [
  RecordStatus.INICIO,
  RecordStatus.CONTINUACAO,
  RecordStatus.TERMINO
];

export const VISIT_REASONS = Object.values(VisitReason);

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
  headerLine1X: 200,
  headerLine1Y: 30,
  headerLine2X: 200,
  headerLine2Y: 65,
  headerLine3X: 200,
  headerLine3Y: 95,
  headerPaddingTop: 40,
  headerTextAlign: 'center',
  primaryColor: '#005a9c'
};
