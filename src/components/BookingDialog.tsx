import React, { useState, useEffect } from 'react';
import { format, addDays, isWeekend, isBefore, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Clock, Users, Building2, User, Mail, FileText, Loader2, ShieldCheck, MailCheck, AlertCircle, Calendar as CalendarIcon, GraduationCap } from 'lucide-react';
import { TIME_SLOTS, TURMAS, BRAZILIAN_HOLIDAYS } from '../constants';
import { TimeSlot, Turma, BookingData, BlockedDate } from '../types';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/firestore';
import SobralLogo from './SobralLogo';
import { sendBookingEmail } from '../services/emailService';

interface BookingDialogProps {
  date: Date;
  rescheduleBookingId?: string;
  existingBookings: BookingData[];
  blockedDates?: BlockedDate[];
  onClose: () => void;
  onComplete: () => void;
}

const BookingDialog: React.FC<BookingDialogProps> = ({ 
  date, 
  rescheduleBookingId, 
  existingBookings, 
  blockedDates = [], 
  onClose, 
  onComplete 
}) => {
  const [step, setStep] = useState<'slot' | 'form' | 'success' | 'loading'>(rescheduleBookingId ? 'loading' : 'slot');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(date);
  const [originalBooking, setOriginalBooking] = useState<BookingData | null>(null);
  const [dateValidationNotice, setDateValidationNotice] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    responsibleName: '',
    institutionName: '',
    email: '',
    turma: '' as unknown as Turma,
    quantity: '' as unknown as number,
    objective: ''
  });

  // Carregar dados se for remarcação
  useEffect(() => {
    if (rescheduleBookingId) {
      const fetchBooking = async () => {
        try {
          const bookingDoc = await getDoc(doc(db, 'bookings', rescheduleBookingId));
          if (bookingDoc.exists()) {
            const data = bookingDoc.data();
            const original = { ...data, id: bookingDoc.id } as BookingData;
            setOriginalBooking(original);
            setFormData({
              responsibleName: data.responsibleName || '',
              institutionName: data.institutionName || '',
              email: data.email || '',
              turma: data.turma || ('' as unknown as Turma),
              quantity: data.quantity || ('' as unknown as number),
              objective: data.objective || ''
            });
            const parsedDate = new Date(data.dateString + 'T12:00:00');
            setRescheduleDate(parsedDate);
            if (data.slot) {
              setSelectedSlot(data.slot);
            }
            setStep('slot');
          } else {
            setError("Agendamento não encontrado para remarcação.");
            setStep('slot');
          }
        } catch (err) {
          console.error("Erro ao carregar agendamento:", err);
          setError("Erro ao carregar dados do agendamento.");
          setStep('slot');
        }
      };
      fetchBooking();
    }
  }, [rescheduleBookingId]);

  const activeDate = rescheduleBookingId ? rescheduleDate : date;
  const activeDateString = format(activeDate, 'yyyy-MM-dd');

  const getSlotBooking = (slot: TimeSlot) => {
    return existingBookings.find(b => {
      // Ignorar o próprio agendamento se estiver remarcando
      if (rescheduleBookingId && b.id === rescheduleBookingId) return false;
      
      return b.dateString === activeDateString && 
             b.slot.start === slot.start && 
             b.slot.end === slot.end &&
             (b.status === 'confirmed' || b.status === 'pending'); 
    });
  };

  const handleDateChange = (newDateStr: string) => {
    if (!newDateStr) return;
    const [year, month, day] = newDateStr.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day, 12, 0, 0);
    const today = startOfToday();
    const minDate = addDays(today, 2);

    if (isBefore(parsedDate, minDate)) {
      setDateValidationNotice("Agendamentos exigem no mínimo 48h de antecedência. Selecione uma data futura válida.");
      return;
    }
    if (isWeekend(parsedDate)) {
      setDateValidationNotice("A biblioteca realiza visitas em grupo apenas de segunda a sexta-feira.");
      return;
    }
    const holiday = BRAZILIAN_HOLIDAYS.find(h => h.date === newDateStr);
    if (holiday) {
      setDateValidationNotice(`Esta data é um feriado: ${holiday.name}.`);
      return;
    }
    const blocked = blockedDates.find(b => b.dateString === newDateStr);
    if (blocked) {
      setDateValidationNotice(`Esta data está bloqueada: ${blocked.reason}`);
      return;
    }

    setDateValidationNotice(null);
    setRescheduleDate(parsedDate);
    setSelectedSlot(null); // Resetar horário ao trocar de data
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (getSlotBooking(slot)) return;
    setSelectedSlot(slot);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError("Por favor, selecione um horário disponível.");
      return;
    }
    if (!formData.turma) {
      setError("Por favor, selecione a turma/nível.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      const isDateChanged = originalBooking && originalBooking.dateString !== activeDateString;
      
      // Se a data mudou e a solicitação já estava confirmada, volta para 'pending'
      // Se ainda não estava confirmada (pending), permanece 'pending' com a nova data
      let newStatus: 'pending' | 'confirmed' | 'rejected' = 'pending';
      if (rescheduleBookingId && originalBooking) {
        if (isDateChanged && originalBooking.status === 'confirmed') {
          newStatus = 'pending';
        } else if (!isDateChanged) {
          // Se não mudou a data, mas mudou horário ou dados, mantém o status original ou reavalia
          newStatus = originalBooking.status;
        } else {
          newStatus = 'pending';
        }
      }

      const bookingData = {
        dateString: activeDateString,
        slot: selectedSlot,
        ...formData,
        quantity: Number(formData.quantity),
        status: newStatus,
        updatedAt: rescheduleBookingId ? new Date().toISOString() : undefined,
        createdAt: rescheduleBookingId ? (originalBooking?.createdAt || new Date().toISOString()) : new Date().toISOString()
      };

      const cleanData = Object.fromEntries(Object.entries(bookingData).filter(([_, v]) => v !== undefined));
      let finalId = rescheduleBookingId;

      if (rescheduleBookingId) {
        // Atualizar no Firestore
        await updateDoc(doc(db, 'bookings', rescheduleBookingId), cleanData);
      } else {
        // Salvar no Firestore
        const docRef = await addDoc(collection(db, 'bookings'), cleanData);
        finalId = docRef.id;
      }

      // Enviar e-mail de confirmação de recebimento / remarcação
      await sendBookingEmail(formData.email, 'pending', {
        id: finalId,
        responsibleName: formData.responsibleName,
        institutionName: formData.institutionName,
        date: format(activeDate, 'dd/MM/yyyy'),
        time: selectedSlot.start
      });

      setStep('success');
    } catch (err: any) {
      console.error("Erro Firestore:", err);
      handleFirestoreError(err, rescheduleBookingId ? OperationType.UPDATE : OperationType.CREATE, 'bookings');
      setError("Erro ao salvar agendamento no servidor. Verifique sua conexão.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className={`bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col transition-all duration-300 border border-slate-100`}>
        
        {step !== 'success' && step !== 'loading' && (
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
            <div className="flex items-center space-x-4">
              <div className="bg-[var(--color-primary-light)] p-2.5 rounded-2xl">
                 <SobralLogo size={28} className="text-[var(--color-primary)]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                  {rescheduleBookingId ? 'Remarcar / Alterar Visita' : 'Solicitar Visita'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                   {format(activeDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
              <X size={24} />
            </button>
          </div>
        )}

        <div className="overflow-y-auto">
          {step === 'loading' && (
            <div className="p-20 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="animate-spin text-[var(--color-primary)]" size={48} />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carregando dados...</p>
            </div>
          )}

          {error && (
            <div className="mx-6 mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start space-x-3 animate-in slide-in-from-top duration-300">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <div className="flex-grow">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Atenção</p>
                <p className="text-xs text-red-700 leading-relaxed font-medium">{error}</p>
                <button onClick={() => setError(null)} className="mt-2 text-[10px] font-bold text-red-600 uppercase underline">Fechar</button>
              </div>
            </div>
          )}

          {step === 'slot' && (
            <div className="p-6 space-y-6">
              {rescheduleBookingId && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center mb-1">
                        <CalendarIcon size={14} className="mr-1.5 text-[var(--color-primary)]" />
                        Alterar Data da Visita (Mínimo 48h de antecedência)
                      </label>
                      <p className="text-xs text-slate-600 font-medium">
                        Data Selecionada: <strong className="text-slate-900">{format(activeDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong>
                      </p>
                    </div>
                    <input 
                      type="date"
                      min={format(addDays(new Date(), 2), 'yyyy-MM-dd')}
                      value={format(activeDate, 'yyyy-MM-dd')}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 text-sm focus:border-[var(--color-primary)] focus:outline-none shadow-sm"
                    />
                  </div>

                  {dateValidationNotice && (
                    <div className="mt-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium">
                      ⚠️ {dateValidationNotice}
                    </div>
                  )}

                  {originalBooking?.status === 'confirmed' && (
                    <p className="text-[11px] text-amber-700 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60 font-medium">
                      ℹ️ <strong>Atenção:</strong> Se você alterar a data desta visita já confirmada, ela retornará para a aba <strong>"Aguardando"</strong> para nova aprovação pela equipe da biblioteca.
                    </p>
                  )}
                </div>
              )}

              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-center mb-4">
                  Escolha um horário disponível para {format(activeDate, "dd/MM/yyyy")}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TIME_SLOTS.map((slot, idx) => {
                    const booking = getSlotBooking(slot);
                    const occupied = !!booking;
                    const isPending = booking?.status === 'pending';
                    const isSelected = selectedSlot?.start === slot.start && selectedSlot?.end === slot.end;
                    
                    return (
                      <button
                        key={idx}
                        disabled={occupied}
                        onClick={() => handleSlotSelect(slot)}
                        className={`group flex items-center justify-between p-5 border-2 rounded-2xl transition-all ${
                          occupied 
                            ? 'bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed' 
                            : isSelected 
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]/40 shadow-sm' 
                              : 'border-slate-100 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]/20'
                        }`}
                      >
                        <div className="text-left">
                          <span className={`block text-lg font-black tracking-tighter ${occupied ? 'text-slate-400' : 'text-slate-800 group-hover:text-[var(--color-primary)]'}`}>
                            {slot.start}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duração: 1h</span>
                        </div>
                        <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                          occupied 
                            ? (isPending ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500') 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {isPending ? 'Em Análise' : (occupied ? 'Ocupado' : 'Disponível')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Horário e Data Selecionados</span>
                  <span className="text-sm font-bold text-slate-800">
                    {format(activeDate, "dd/MM/yyyy")} às {selectedSlot?.start}
                  </span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setStep('slot')} 
                  className="text-xs font-bold text-[var(--color-primary)] hover:underline"
                >
                  Alterar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><User size={12} className="mr-1" /> Responsável</label>
                  <input required disabled={isSubmitting} type="text" value={formData.responsibleName} onChange={e => setFormData(prev => ({ ...prev, responsibleName: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[var(--color-primary)] outline-none transition-all font-medium" placeholder="Nome completo" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><Building2 size={12} className="mr-1" /> Instituição / Escola</label>
                  <input required disabled={isSubmitting} type="text" value={formData.institutionName} onChange={e => setFormData(prev => ({ ...prev, institutionName: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[var(--color-primary)] outline-none transition-all font-medium" placeholder="Nome da escola" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><Mail size={12} className="mr-1" /> E-mail de Confirmação</label>
                  <input required disabled={isSubmitting} type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[var(--color-primary)] outline-none transition-all font-medium" placeholder="exemplo@email.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><GraduationCap size={12} className="mr-1" /> Turma / Nível</label>
                  <select required disabled={isSubmitting} value={formData.turma} onChange={e => setFormData(prev => ({ ...prev, turma: e.target.value as Turma }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[var(--color-primary)] outline-none transition-all font-medium appearance-none">
                    <option value="" disabled>Selecione o nível...</option>
                    {TURMAS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><Users size={12} className="mr-1" /> Qtd. Pessoas (Máx: 40)</label>
                  <input required disabled={isSubmitting} type="number" max="40" min="1" value={formData.quantity} onChange={e => setFormData(prev => ({ ...prev, quantity: e.target.value as any }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[var(--color-primary)] outline-none transition-all font-medium" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><FileText size={12} className="mr-1" /> Objetivo Pedagógico</label>
                </div>
                <textarea required disabled={isSubmitting} rows={3} value={formData.objective} onChange={e => setFormData(prev => ({ ...prev, objective: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[var(--color-primary)] outline-none transition-all font-medium resize-none text-sm" placeholder="Qual o propósito da visita?" />
              </div>
              <div className="flex items-center space-x-3 pt-4">
                 <button type="button" onClick={() => setStep('slot')} className="px-6 py-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-400 uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Voltar</button>
                 <button type="submit" disabled={isSubmitting} className="flex-grow py-4 bg-[var(--color-primary)] text-white font-black uppercase tracking-widest text-xs rounded-2xl flex items-center justify-center disabled:bg-slate-400 shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                  {isSubmitting ? <><Loader2 className="animate-spin mr-2" size={18} /> Processando...</> : 'Finalizar Agendamento'}
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="flex flex-col bg-white min-h-full animate-in fade-in zoom-in duration-500">
              <div className="bg-[var(--color-primary)] p-10 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                   <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-white rounded-full blur-3xl"></div>
                   <div className="absolute bottom-[-20%] right-[-10%] w-64 h-64 bg-white rounded-full blur-3xl"></div>
                </div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
                    <MailCheck size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                    {rescheduleBookingId ? 'Solicitação Atualizada' : 'Solicitação Recebida'}
                  </h2>
                  <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Protocolo: {Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
                </div>
              </div>

              <div className="p-8 space-y-6 flex flex-col items-center">
                <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-xl overflow-hidden">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <SobralLogo size={24} className="text-[var(--color-primary)]" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmação de Agendamento</span>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instituição</p>
                      <p className="text-sm font-bold text-slate-800">{formData.institutionName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</p>
                        <p className="text-sm font-bold text-slate-800">{format(activeDate, "dd/MM/yyyy")}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário</p>
                        <p className="text-sm font-bold text-slate-800">{selectedSlot?.start}</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-50">
                      <p className="text-[11px] text-slate-500 leading-relaxed italic">
                        "Prezado(a) <strong>{formData.responsibleName}</strong>, sua solicitação está em análise. Enviamos um e-mail para <strong>{formData.email}</strong> com os próximos passos."
                      </p>
                    </div>
                  </div>
                  <div className="bg-[var(--color-primary-light)] p-4 text-center">
                    <p className="text-[10px] font-black text-[var(--color-primary)] uppercase tracking-widest">Aguarde o e-mail de confirmação final</p>
                  </div>
                </div>

                <div className="flex flex-col items-center space-y-4 w-full max-w-md">
                  <button onClick={onComplete} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-900/20"> 
                     Entendido, Voltar ao Início
                  </button>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                    <ShieldCheck size={12} className="mr-1 text-green-500" /> Ambiente Seguro e Criptografado
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingDialog;
