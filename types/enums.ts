
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

export enum ParticipantType {
  STAFF = 'Colaborador',
  PATIENT = 'Paciente',
  PROVIDER = 'Prestador'
}

export enum VisitReason {
  AGENDAMENTO = 'Agendamento',
  SOLICITACAO = 'Solicitação',
  ROTINA = 'Rotina',
  ACOMPANHAMENTO = 'ACOMPANHAMENTO',
  OUTROS = 'Outros'
}

export enum ActivityFilter {
  TODAS = 'Todas',
  ESTUDOS = 'Estudos Bíblicos',
  CLASSES = 'Classes Bíblicas',
  PGS = 'Pequenos Grupos',
  VISITAS = 'Visitas'
}
