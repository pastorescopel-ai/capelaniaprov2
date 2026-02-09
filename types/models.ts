
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
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  profilePic?: string;
}

export interface MasterLists {
  id?: string;
  sectorsHAB: string[];
  sectorsHABA: string[];
  groupsHAB: string[];
  groupsHABA: string[];
  staffHAB: string[];
  staffHABA: string[];
  updatedAt?: number;
}

export interface BibleStudy {
  id: string;
  userId: string;
  date: string;
  unit: Unit;
  sector: string;
  name: string;
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
  status: 'pending' | 'confirmed' | 'declined' | 'assigned';
  requestNotes?: string;
  preferredChaplainId?: string;
  assignedChaplainId?: string;
  chaplainResponse?: string;
  isRead: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Interfaces Auxiliares de Integração
export interface Leader {
  full_name: string;
  whatsapp?: string;
  pg_name?: string;
  sector_name?: string;
  hospital?: string;
}

export interface Chaplain {
  id: string;
  name: string;
  active: boolean;
  hospital: string;
}

export interface MeetingSchedule {
  full_date: string;
  request_chaplain: boolean;
  request_notes?: string;
  preferred_chaplain_id?: string;
  assigned_chaplain_id?: string;
  chaplain_status: 'none' | 'pending' | 'confirmed' | 'declined';
  leader_name: string;
  leader_whatsapp?: string;
  pg_name: string;
  sector_name?: string;
  hospital?: string;
}
