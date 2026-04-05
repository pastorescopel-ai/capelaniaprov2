import { Unit, RecordStatus, ParticipantType, VisitReason, UserRole } from './enums';

// --- TIPOS PRO ---
export interface ProSector {
  id: string;
  name: string;
  unit: Unit;
  active?: boolean;
  cycleMonth?: string; // Mês de Referência (YYYY-MM-DD)
  createdAt?: number;
  updatedAt?: number;
}

export interface ProStaff {
  id: string;
  name: string;
  sectorId: string;
  unit: Unit;
  whatsapp?: string;
  active?: boolean;
  leftAt?: number;
  cycleMonth?: string; // Mês de Referência (YYYY-MM-DD)
  createdAt?: number;
  updatedAt?: number;
}

export interface ProPatient {
  id: string;
  name: string;
  unit: Unit;
  whatsapp?: string;
  lastLesson?: string;
  joinedAt?: number;
  leftAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ProProvider {
  id: string;
  name: string;
  unit: Unit;
  whatsapp?: string;
  sector?: string;
  joinedAt?: number;
  leftAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ProGroup {
  id: string;
  name: string;
  currentLeader?: string;
  leader?: string;
  leaderPhone?: string;
  sectorId?: string;
  unit: Unit;
  active?: boolean;
  cycleMonth?: string; // Mês de Referência (YYYY-MM-DD)
  createdAt?: number;
  updatedAt?: number;
}

export interface ProGroupLocation {
  id: string;
  groupId: string;
  sectorId: string;
  unit: Unit;
  createdAt?: number;
  updatedAt?: number;
}

export interface ProGroupMember {
  id: string;
  groupId: string;
  staffId: string;
  joinedAt?: number;
  leftAt?: number; // Data de saída para histórico (Soft Delete)
  isError?: boolean;
  cycleMonth?: string; // Mês de Competência (YYYY-MM-DD)
  createdAt?: number;
  updatedAt?: number;
}

export interface ProGroupProviderMember {
  id: string;
  groupId: string;
  providerId: string;
  joinedAt?: number;
  leftAt?: number;
  isError?: boolean;
  cycleMonth?: string; // Mês de Competência (YYYY-MM-DD)
  createdAt?: number;
  updatedAt?: number;
}

export interface ProMonthlyStats {
  id?: string;
  month: string; // YYYY-MM-DD
  type: 'sector' | 'pg' | 'summary';
  targetId: string;
  totalStaff: number;
  totalParticipants: number;
  percentage: number;
  goal: number;
  unit: Unit;
  createdAt?: number;
  updatedAt?: number;
  // --- CAMPOS PARA SNAPSHOT DE FECHAMENTO ---
  snapshotData?: {
    totalColaboradores: number;
    setorBreakdown: Record<string, number>;
    performanceMetrics: {
      pgPercentage: number;
      ambassadorPercentage: number;
      // --- NOVOS CAMPOS PARA TRAVAMENTO DE RELATÓRIOS ---
      totalBibleStudies?: number;
      totalBibleClasses?: number;
      totalSmallGroups?: number;
      totalStaffVisits?: number;
      totalUniqueStudents?: number;
      chaplainStats?: any[];
    };
    membersList: any[]; // Lista de membros ativos no fechamento
  };
}

export interface HeaderLine {
  id: string;
  text: string;
  fontSize: number;
  color: string;
  x: number;
  y: number;
  width?: number;
  fontWeight: 'normal' | 'bold' | '900';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  fontFamily?: string;
}

export interface HeaderProfile {
  id: string;
  name: string;
  logoWidth: number;
  logoX: number;
  logoY: number;
  paddingTop: number;
  textAlign: 'left' | 'center' | 'right';
  lines: HeaderLine[];
}

export interface Config {
  id?: string;
  muralText: string;
  headerLine1: string;
  headerLine2: string;
  headerLine3: string;
  fontSize1: number;
  fontSize2: number;
  fontSize3: number;
  reportLogoWidth: number;
  reportLogoX: number;
  reportLogoY: number;
  headerLine1X: number;
  headerLine1Y: number;
  headerLine2X: number;
  headerLine2Y: number;
  headerLine3X: number;
  headerLine3Y: number;
  headerPaddingTop: number;
  headerTextAlign: 'left' | 'center' | 'right';
  primaryColor: string;
  appLogoUrl?: string;
  reportLogoUrl?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: number;
  headerProfiles?: Record<string, HeaderProfile>;
  activeCompetenceMonth?: string; // YYYY-MM-01 (Mês de competência ativo para o sistema)
  createdAt?: number;
  updatedAt?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  profilePic?: string;
  attendsHaba?: boolean;
  habaDays?: number[];
  auth_id?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface BibleStudy {
  id: string;
  userId: string;
  date: string;
  unit: Unit;
  sector: string;
  sectorId?: string;
  location?: string;
  name: string;
  staffId?: string;
  whatsapp: string;
  status: RecordStatus;
  participantType?: ParticipantType;
  guide: string;
  lesson: string;
  observations: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface BibleClass {
  id: string;
  userId: string;
  date: string;
  unit: Unit;
  sector: string;
  sectorId?: string;
  location?: string;
  students: string[];
  status: RecordStatus;
  participantType?: ParticipantType;
  guide: string;
  lesson: string;
  observations: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface SmallGroup {
  id: string;
  userId: string;
  date: string;
  unit: Unit;
  sector: string;
  sectorId?: string;
  groupName: string;
  leader: string;
  leaderPhone?: string;
  shift: string;
  participantsCount: number;
  observations: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface StaffVisit {
  id: string;
  userId: string;
  date: string;
  unit: Unit;
  sector: string;
  sectorId?: string;
  location?: string;
  reason: VisitReason;
  staffName: string;
  staffId?: string;
  providerId?: string;
  whatsapp?: string;
  participantType?: ParticipantType;
  providerRole?: string;
  requiresReturn: boolean;
  returnDate?: string;
  returnCompleted?: boolean;
  observations: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface VisitRequest {
  id: string;
  pgName: string;
  leaderName: string;
  leaderPhone?: string;
  unit: 'HAB' | 'HABA';
  date: string;
  status: 'confirmed' | 'declined' | 'assigned';
  requestNotes?: string;
  assignedChaplainId?: string;
  chaplainResponse?: string;
  sectorId?: string;
  meetingLocation?: string;
  scheduledTime?: string;
  isRead: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Ambassador {
  id: string;
  name: string;
  registrationId?: string; // Matrícula
  email?: string;
  sectorId?: string;
  unit: Unit;
  completionDate: string;
  cycleMonth: string; // Mês de Referência (YYYY-MM-DD)
  createdAt?: string;
}

export interface ActivitySchedule {
  id: string;
  userId: string; // Capelão
  unit: Unit;
  month: string; // YYYY-MM-DD (primeiro dia do mês)
  dayOfWeek: number; // 0-6
  date?: string; // YYYY-MM-DD (Data específica, opcional)
  activityType: 'blueprint' | 'cult' | 'encontro' | 'visiteCantando';
  location: string; // Nome do local (Blueprint) ou ID do Setor (Culto)
  period: 'manha' | 'tarde';
  time?: string; // Horário da atividade (HH:mm)
  responsibleName?: string; // Nome do responsável (Visite Cantando)
  responsibleWhatsApp?: string; // WhatsApp do responsável (Visite Cantando)
  createdAt?: number;
  updatedAt?: number;
}

export interface DailyActivityReport {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  unit: Unit;
  completedBlueprints: string[];
  completedCults: string[];
  completedEncontro?: boolean;
  completedVisiteCantando?: boolean;
  palliativeCount: number;
  surgicalCount: number;
  pediatricCount: number;
  utiCount: number;
  observations?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface EditAuthorization {
  id: string;
  userId: string;
  userName: string;
  allowedTabs: string[]; // ['estudos', 'classes', 'pg', 'visitas', 'relatorio']
  monthToUnlock: string; // YYYY-MM-DD (primeiro dia do mês)
  expiryDate: string; // YYYY-MM-DDTHH:mm:ss (Data e hora de expiração)
  createdAt: number;
  updatedAt?: number;
  createdBy: string;
}

export interface ProHistoryRecord {
  id: string;
  month: string; // YYYY-MM-DD
  unit: Unit;
  staffId: string;
  staffName: string;
  sectorId: string;
  sectorName: string;
  groupId?: string;
  groupName?: string;
  status: string; // 'Matriculado' | 'Não Matriculado'
  isEnrolled: boolean;
  createdAt?: number;
  updatedAt?: number;
}
