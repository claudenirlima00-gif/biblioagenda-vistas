
import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Clock, Users, Building2, User, Mail, FileText, Sparkles, Loader2, ShieldCheck, MailCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { TIME_SLOTS } from '../constants';
import { TimeSlot, Turma, BookingData } from '../types';
import { generateObjectiveSuggestion } from '../services/geminiService';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/firestore';

import { sendBookingEmail } from '../services/emailService';

interface BookingDialogProps {
  date: Date;
  existingBookings: BookingData[];
  onClose: () => void;
  onComplete: () => void;
}

const BookingDialog: React.FC<BookingDialogProps> = ({ date, existingBookings, onClose, onComplete }) => {
  const [step, setStep] = useState<'slot' | 'form' | 'success'>('slot');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    responsibleName: '',
    institutionName: '',
    email: '',
    turma: Turma.INFANTIL,
    quantity: '' as unknown as number,
    objective: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const getSlotBooking = (slot: TimeSlot) => {
    const targetDateString = format(date, 'yyyy-MM-dd');
    return existingBookings.find(b => {
      return b.dateString === targetDateString && 
             b.slot.start === slot.start && 
             b.slot.end === slot.end &&
             (b.status === 'confirmed' || b.status === 'pending'); 
    });
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (getSlotBooking(slot)) return;
    setSelectedSlot(slot);
    setStep('form');
  };

  const handleSuggestObjective = async () => {
    if (!formData.institutionName) {
      setError("Informe o nome da instituição para gerar o objetivo.");
      return;
    }
    setError(null);
    setIsGenerating(true);
    const suggestion = await generateObjectiveSuggestion(formData.turma, formData.institutionName);
    setFormData(prev => ({ ...prev, objective: suggestion }));
    setIsGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setIsSubmitting(true);
    setError(null);
    
    try {
      const bookingData = {
        dateString: format(date, 'yyyy-MM-dd'),
        slot: selectedSlot,
        ...formData,
        quantity: Number(formData.quantity),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Salvar no Firestore
      await addDoc(collection(db, 'bookings'), bookingData);

      // Enviar e-mail de confirmação de recebimento
      await sendBookingEmail(formData.email, 'pending', {
        responsibleName: formData.responsibleName,
        institutionName: formData.institutionName,
        date: format(date, 'dd/MM/yyyy'),
        time: selectedSlot.start
      });

      setStep('success');
    } catch (err: any) {
      console.error("Erro Firestore:", err);
      handleFirestoreError(err, OperationType.CREATE, 'bookings');
      setError("Erro ao salvar agendamento no servidor. Verifique sua conexão.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
      <div className={`bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col transition-all duration-300`}>
        
        {step !== 'success' && (
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-50 p-2 rounded-xl">
                 <Clock size={20} className="text-[#1e40af]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
                  Solicitar Visita
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                   {format(date, "dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
              <X size={24} />
            </button>
          </div>
        )}

        <div className="overflow-y-auto">
          {error && (
            <div className="mx-6 mt-6 p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl flex items-start space-x-3 animate-in slide-in-from-top duration-300">
              <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
              <div className="flex-grow">
                <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-1">Erro no Processamento</p>
                <p className="text-xs text-blue-700 leading-relaxed font-medium">{error}</p>
                <button onClick={() => setError(null)} className="mt-2 text-[10px] font-bold text-blue-600 uppercase underline">Entendi</button>
              </div>
            </div>
          )}

          {step === 'slot' && (
            <div className="p-6 space-y-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-center mb-6">Escolha um horário disponível</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TIME_SLOTS.map((slot, idx) => {
                  const booking = getSlotBooking(slot);
                  const occupied = !!booking;
                  const isPending = booking?.status === 'pending';
                  
                  return (
                    <button
                      key={idx}
                      disabled={occupied}
                      onClick={() => handleSlotSelect(slot)}
                      className={`group flex items-center justify-between p-5 border-2 rounded-2xl transition-all ${occupied ? 'bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed' : 'border-slate-100 hover:border-[#1e40af] hover:bg-blue-50/30'}`}
                    >
                      <div className="text-left">
                        <span className={`block text-lg font-black tracking-tighter ${occupied ? 'text-slate-400' : 'text-slate-800 group-hover:text-[#1e40af]'}`}>{slot.start}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Duração: 1h</span>
                      </div>
                      <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${occupied ? (isPending ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500') : 'bg-green-100 text-green-700'}`}>
                        {isPending ? 'Aguardando Confirmação' : (occupied ? 'Ocupado' : 'Livre')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><User size={12} className="mr-1" /> Responsável</label>
                  <input required disabled={isSubmitting} type="text" value={formData.responsibleName} onChange={e => setFormData(prev => ({ ...prev, responsibleName: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[#1e40af] outline-none transition-all font-medium" placeholder="Nome completo" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><Building2 size={12} className="mr-1" /> Instituição / Escola</label>
                  <input required disabled={isSubmitting} type="text" value={formData.institutionName} onChange={e => setFormData(prev => ({ ...prev, institutionName: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[#1e40af] outline-none transition-all font-medium" placeholder="Nome da escola" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><Mail size={12} className="mr-1" /> E-mail de Confirmação</label>
                  <input required disabled={isSubmitting} type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[#1e40af] outline-none transition-all font-medium" placeholder="exemplo@email.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><Users size={12} className="mr-1" /> Qtd. Pessoas (Máx: 40)</label>
                  <input required disabled={isSubmitting} type="number" max="40" min="1" value={formData.quantity} onChange={e => setFormData(prev => ({ ...prev, quantity: e.target.value as any }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[#1e40af] outline-none transition-all font-medium" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><FileText size={12} className="mr-1" /> Objetivo Pedagógico</label>
                   <button type="button" onClick={handleSuggestObjective} className="text-[10px] font-bold text-[#1e40af] bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center hover:bg-blue-100 transition-colors">
                     {isGenerating ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1" />} 
                     Sugestão IA
                   </button>
                </div>
                <textarea required disabled={isSubmitting} rows={3} value={formData.objective} onChange={e => setFormData(prev => ({ ...prev, objective: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[#1e40af] outline-none transition-all font-medium resize-none text-sm" placeholder="Qual o propósito da visita?" />
              </div>

              <div className="flex items-center space-x-3 pt-4">
                 <button type="button" onClick={() => setStep('slot')} className="px-6 py-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-400 uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">Voltar</button>
                 <button type="submit" disabled={isSubmitting} className="flex-grow py-4 bg-[#1e40af] text-white font-black uppercase tracking-widest text-xs rounded-2xl flex items-center justify-center disabled:bg-slate-400 shadow-xl shadow-blue-900/20 active:scale-95 transition-all">
                  {isSubmitting ? <><Loader2 className="animate-spin mr-2" size={18} /> Processando...</> : 'Finalizar Agendamento'}
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="flex flex-col bg-white min-h-full animate-in fade-in zoom-in duration-500">
              <div className="bg-[#1e40af] p-12 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                   <div className="absolute top-[-10%] left-[-10%] w-40 h-40 bg-white rounded-full blur-3xl"></div>
                   <div className="absolute bottom-[-10%] right-[-10%] w-40 h-40 bg-white rounded-full blur-3xl"></div>
                </div>
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-3"><MailCheck size={40} className="text-[#1e40af]" /></div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Solicitação Enviada!</h2>
              </div>

              <div className="p-10 space-y-8 flex flex-col items-center text-center">
                <div className="bg-slate-50 border-2 border-slate-100 p-8 rounded-[2.5rem] w-full max-w-md shadow-inner">
                   <h4 className="text-slate-800 font-black uppercase text-xs mb-4 tracking-widest flex items-center justify-center">
                     <ShieldCheck size={14} className="mr-2 text-[#1e40af]" /> 
                     Enviado com Sucesso
                   </h4>
                   <p className="text-slate-600 text-sm leading-relaxed font-medium">
                     Sua solicitação foi enviada para a equipe da biblioteca. 
                     <br/><br/>
                     <span className="text-[#1e40af] font-black">IMPORTANTE:</span> Verifique agora o e-mail <strong>{formData.email}</strong>. Enviamos uma confirmação de recebimento para você acompanhar o status.
                   </p>
                </div>

                <div className="flex items-center space-x-3 text-slate-300">
                   <div className="h-px w-8 bg-slate-200"></div>
                   <Sparkles size={18} className="text-blue-400" />
                   <div className="h-px w-8 bg-slate-200"></div>
                </div>

                <button onClick={onComplete} className="bg-slate-900 text-white px-16 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 active:scale-95 transition-all shadow-2xl shadow-slate-900/20">
                   Concluir e Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingDialog;
