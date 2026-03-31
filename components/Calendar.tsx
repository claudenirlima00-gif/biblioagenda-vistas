
import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  isWeekend, 
  isBefore, 
  startOfToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Info, CheckCircle2 } from 'lucide-react';
import { BRAZILIAN_HOLIDAYS } from '../constants';
import { BookingData, BlockedDate } from '../types';

interface CalendarProps {
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
  bookings: BookingData[];
  blockedDates: BlockedDate[];
}

const Calendar: React.FC<CalendarProps> = ({ onSelectDate, selectedDate, bookings, blockedDates }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = startOfToday();

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const isHoliday = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return BRAZILIAN_HOLIDAYS.some(h => h.date === dateStr);
  };

  const getHolidayName = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return BRAZILIAN_HOLIDAYS.find(h => h.date === dateStr)?.name;
  };

  const getBlockedReason = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.find(b => b.dateString === dateStr)?.reason;
  };

  const getConfirmedBookingsCount = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter(b => {
      const bDateStr = (b as any).dateString || (b.date instanceof Date ? format(b.date, 'yyyy-MM-dd') : b.date);
      return bDateStr === dateStr && b.status === 'confirmed';
    }).length;
  };

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            title="Mês Anterior"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            title="Próximo Mês"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day, index) => (
          <div key={index} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const formattedDate = format(day, 'd');
        const cloneDay = day;
        const blockedReason = getBlockedReason(day);
        const isDisabled = isWeekend(day) || isHoliday(day) || isBefore(day, today) || !!blockedReason;
        const holidayName = getHolidayName(day);
        const confirmedCount = getConfirmedBookingsCount(day);

        days.push(
          <div
            key={day.toString()}
            className={`
              relative h-24 sm:h-32 border-t border-l border-slate-100 p-2 cursor-pointer transition-all
              ${!isSameMonth(day, monthStart) ? 'bg-slate-50 text-slate-300 pointer-events-none' : ''}
              ${isDisabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'hover:bg-blue-50/50'}
              ${selectedDate && isSameDay(day, selectedDate) ? 'bg-blue-50 ring-2 ring-[#1e40af] z-10' : ''}
            `}
            onClick={() => !isDisabled && onSelectDate(cloneDay)}
          >
            <span className={`text-sm font-semibold inline-flex items-center justify-center w-8 h-8 rounded-full ${isSameDay(day, today) ? 'text-white bg-[#1e40af] shadow-md shadow-blue-900/30' : ''}`}>
              {formattedDate}
            </span>
            
            {confirmedCount > 0 && !holidayName && (
               <div className="absolute bottom-2 right-2 flex items-center space-x-1 bg-green-100 px-1.5 py-0.5 rounded text-[10px] font-black text-green-700 uppercase">
                 <CheckCircle2 size={10} />
                 <span>{confirmedCount} Visita{confirmedCount > 1 ? 's' : ''}</span>
               </div>
            )}

            {holidayName && (
              <div className="mt-1 text-[10px] sm:text-xs text-blue-700 font-bold leading-tight">
                {holidayName}
              </div>
            )}
            {blockedReason && (
              <div className="mt-1 text-[10px] sm:text-xs text-amber-700 font-bold leading-tight uppercase">
                {blockedReason}
              </div>
            )}
            {isDisabled && isSameMonth(day, monthStart) && !holidayName && !blockedReason && (
              <div className="mt-1 text-[10px] text-slate-400 uppercase font-medium">Indisponível</div>
            )}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 border-r border-b border-slate-100" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">{rows}</div>;
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 bg-white rounded-2xl shadow-lg border border-slate-200">
      <div className="mb-6 flex items-center text-sm text-[#1e40af] bg-blue-50 p-4 rounded-xl border border-blue-100/50">
        <Info className="mr-3 text-[#1e40af] flex-shrink-0" size={20} />
        <p className="font-medium">Selecione uma data disponível para realizar o agendamento da visita do seu grupo.</p>
      </div>
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  );
};

export default Calendar;
