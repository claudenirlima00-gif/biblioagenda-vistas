
import { TimeSlot, Holiday, Turma } from './types';

export const TIME_SLOTS: TimeSlot[] = [
  { start: '08:00', end: '09:00' },
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '13:00', end: '14:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
];

export const TURMAS: Turma[] = [
  Turma.INFANTIL,
  Turma.FUNDAMENTAL_1,
  Turma.FUNDAMENTAL_2,
  Turma.ENSINO_MEDIO,
  Turma.EJA,
  Turma.UNIVERSITARIO,
  Turma.OUTROS
];

// Brazilian National Holidays 2026
export const BRAZILIAN_HOLIDAYS: Holiday[] = [
  { date: '2026-01-01', name: 'Confraternização Universal' },
  { date: '2026-02-16', name: 'Carnaval' },
  { date: '2026-02-17', name: 'Carnaval' },
  { date: '2026-04-03', name: 'Sexta-feira Santa' },
  { date: '2026-04-21', name: 'Tiradentes' },
  { date: '2026-05-01', name: 'Dia do Trabalho' },
  { date: '2026-06-04', name: 'Corpus Christi' },
  { date: '2026-09-07', name: 'Independência do Brasil' },
  { date: '2026-10-12', name: 'Nossa Senhora Aparecida' },
  { date: '2026-11-02', name: 'Finados' },
  { date: '2026-11-15', name: 'Proclamação da República' },
  { date: '2026-11-20', name: 'Consciência Negra' },
  { date: '2026-12-25', name: 'Natal' },
];
