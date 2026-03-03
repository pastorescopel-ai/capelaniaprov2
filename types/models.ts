import { Unit, RecordStatus, ParticipantType, VisitReason, UserRole } from './enums';

// --- TIPOS PRO ---
export interface ProSector {
  id: string;
  name: string;
  unit: Unit;
  active?: boolean;
  updatedAt?: number;
}

export interface ProStaff {
  id: string;
  name: string;
  sectorId: string;
  unit: Unit;
  whatsapp?: string;
  active?: boolean;
  updatedAt?: number;
}

export interface ProPatient {
  id: string;
  name: string;
  unit: Unit;
  whatsapp?: string;
  lastLesson?: string;
  updatedAt?: number;
}

export interface ProProvider {
  id: string;
  name: string;
  unit: Unit;
  whatsapp?: string;
  sector?: string;
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
  updatedAt?: number;
}

export interface ProGroupLocation {
  id: string;
  groupId: string;
  sectorId: string;
  unit: Unit;
  createdAt?: number;
}

export interface ProGroupMember {
  id: string;
  groupId: string;
  staffId: string;
  joinedAt?: number;
  leftAt?: number; // Data de saída para histórico (Soft Delete)
  isError?: boolean;
}

export interface ProGroupProviderMember {
  id: string;
  groupId: string;
  providerId: string;
  joinedAt?: number;
  leftAt?: number;
  isError?: boolean;
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
}

export interface BibleStudy {
  id: string;
  userId: string;
  date: string;
  unit: Unit;
  sector: string;
  sectorId?: string;
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
  reason: VisitReason;
  staffName: string;
  participantType?: ParticipantType;
  providerRole?: string;
  requiresReturn: boolean;
  returnDate?: string;
  returnCompleted: boolean;
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
  sectorName?: string;
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
