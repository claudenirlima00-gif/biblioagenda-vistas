
export enum Turma {
  INFANTIL = 'Educação Infantil',
  FUNDAMENTAL_1 = 'Ensino Fundamental I',
  FUNDAMENTAL_2 = 'Ensino Fundamental II',
  ENSINO_MEDIO = 'Ensino Médio',
  EJA = 'EJA (Educação de Jovens e Adultos)',
  UNIVERSITARIO = 'Universitário',
  OUTROS = 'Outros'
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface BookingData {
  id: string; 
  date: Date;
  dateString: string; // ISO format YYYY-MM-DD
  slot: TimeSlot;
  responsibleName: string;
  institutionName: string;
  email: string;
  turma: Turma;
  quantity: number;
  objective: string;
  status: 'pending' | 'confirmed' | 'rejected';
  rejectionReason?: string;
  rejectionDetails?: string;
  createdAt: string;
}

export interface Holiday {
  date: string; // ISO format YYYY-MM-DD
  name: string;
}

export interface BlockedDate {
  dateString: string; // ISO format YYYY-MM-DD
  reason: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  createdAt: string;
}
