
export enum UserRole {
  ADMIN = 'ADMIN',
  CHAPLAIN = 'CHAPLAIN'
}

export enum Unit {
  HAB = 'HAB',
  HABA = 'HABA'
}

export enum RecordStatus {
  INICIO = 'Início',
  CONTINUACAO = 'Continuação',
  TERMINO = 'Término'
}

export enum VisitReason {
  AGENDAMENTO = 'Agendamento',
  ACOMPANHAMENTO = 'Acompanhamento',
  NECESSIDADE_PESSOAL = 'Necessidade Pessoal/Espiritual',
  A_PEDIDO = 'A pedido',
  OUTROS = 'Outros'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  profilePic?: string;
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
  guide: string;
  lesson: string;
  observations?: string;
  createdAt: number;
}

export interface BibleClass {
  id: string;
  userId: string;
  date: string;
  unit: Unit;
  sector: string;
  students: string[];
  status: RecordStatus;
  guide: string;
  lesson: string;
  observations?: string;
  createdAt: number;
}

export interface SmallGroup {
  id: string;
  userId: string;
  date: string;
  unit: Unit;
  sector: string;
  groupName: string;
  leader: string;
  shift: string;
  participantsCount: number;
  observations?: string;
  createdAt: number;
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
  observations?: string;
  createdAt: number;
}

export interface Config {
  googleSheetUrl: string;
  appLogo: string;
  reportLogo: string;
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
}

export interface MasterLists {
  sectorsHAB: string[];
  sectorsHABA: string[];
  staffHAB: string[];
  staffHABA: string[];
  groupsHAB: string[];
  groupsHABA: string[];
}
