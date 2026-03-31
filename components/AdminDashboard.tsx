
import React, { useState, useEffect } from 'react';
import { BookingData, BlockedDate, User as TeamUser } from '../types';
import { format, isBefore, startOfToday, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db, auth } from '../firebase';
import { doc, updateDoc, deleteDoc, setDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/firestore';
import { sendBookingEmail } from '../services/emailService';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as signOutAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  CheckCircle2, 
  Clock, 
  Search, 
  User, 
  Mail, 
  Building2, 
  Users, 
  ChevronRight, 
  LogOut, 
  ShieldCheck,
  Trash2,
  RefreshCcw,
  AlertTriangle,
  Calendar as CalendarIcon,
  XCircle,
  History,
  Check,
  X,
  MessageSquare,
  FileText,
  CalendarX,
  Plus,
  Loader2,
  UserPlus,
  ShieldAlert
} from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
  bookings: BookingData[];
  blockedDates: BlockedDate[];
}

type AdminTab = 'pending' | 'confirmed' | 'rejected' | 'history' | 'blocked' | 'team';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  onLogout, 
  bookings, 
  blockedDates,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('pending');
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionDetails, setRejectionDetails] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // States for blocking dates
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockDate, setBlockDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [blockReason, setBlockReason] = useState('');

  // States for team management
  const [teamMembers, setTeamMembers] = useState<TeamUser[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'staff'>('staff');

  const currentUserEmail = auth.currentUser?.email;
  const isMasterAdmin = currentUserEmail === 'claudenir.lima00@gmail.com';

  useEffect(() => {
    if (isMasterAdmin) {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const members = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as TeamUser[];
        setTeamMembers(members);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
      });
      return () => unsubscribe();
    }
  }, [isMasterAdmin]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) return;

    setIsProcessing(true);
    try {
      // Criar usuário no Firebase Auth usando uma instância secundária para não deslogar o admin
      const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      try {
        await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPassword);
        await signOutAuth(secondaryAuth);
      } catch (authErr: any) {
        console.error("Erro ao criar usuário no Auth:", authErr);
        if (authErr.code === 'auth/email-already-in-use') {
          // Se já existe no Auth, apenas continuamos para atualizar o Firestore
        } else {
          throw authErr;
        }
      } finally {
        // Limpar a instância secundária
        // @ts-ignore
        secondaryApp.delete();
      }

      const newUser: Omit<TeamUser, 'id'> = {
        name: newUserName,
        email: newUserEmail,
        role: newUserRole,
        createdAt: new Date().toISOString()
      };

      const userDocId = newUserEmail; 
      await setDoc(doc(db, 'users', userDocId), newUser);
      
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      alert("Membro adicionado com sucesso! Ele já pode logar com e-mail e senha.");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
      alert(`Erro ao adicionar membro: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveUser = async (id: string) => {
    if (window.confirm('Remover este membro da equipe?')) {
      setIsProcessing(true);
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const today = startOfToday();

  const handleConfirm = async (id: string) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;

    setIsProcessing(true);
    try {
      const bookingRef = doc(db, 'bookings', id);
      await updateDoc(bookingRef, { status: 'confirmed' });
      
      // Enviar e-mail real (simulado)
      await sendBookingEmail(booking.email, 'confirmed', {
        responsibleName: booking.responsibleName,
        institutionName: booking.institutionName,
        date: format(new Date(booking.dateString + 'T12:00:00'), 'dd/MM/yyyy'),
        time: booking.slot.start
      });

      setSelectedBooking(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${id}`);
      alert("Erro ao confirmar agendamento no servidor.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedBooking || !rejectionReason) return;

    setIsProcessing(true);
    try {
      const bookingRef = doc(db, 'bookings', selectedBooking.id);
      await updateDoc(bookingRef, { 
        status: 'rejected', 
        rejectionReason, 
        rejectionDetails 
      });
      
      // Enviar e-mail real (simulado)
      await sendBookingEmail(selectedBooking.email, 'rejected', {
        responsibleName: selectedBooking.responsibleName,
        institutionName: selectedBooking.institutionName,
        reason: rejectionReason,
        details: rejectionDetails,
        date: format(new Date(selectedBooking.dateString + 'T12:00:00'), 'dd/MM/yyyy')
      });

      setShowRejectionModal(false);
      setSelectedBooking(null);
      setRejectionReason('');
      setRejectionDetails('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${selectedBooking.id}`);
      alert("Erro ao rejeitar agendamento no servidor.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'bookings', id));
      setSelectedBooking(null);
      setShowDeleteConfirm(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `bookings/${id}`);
      alert("Erro ao excluir registro no servidor.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDate || !blockReason) return;

    if (blockedDates.some(b => b.dateString === blockDate)) {
      alert("Esta data já está bloqueada.");
      return;
    }

    setIsProcessing(true);
    try {
      const newBlock: BlockedDate = {
        dateString: blockDate,
        reason: blockReason,
        createdAt: new Date().toISOString()
      };

      // Usar a data como ID para facilitar a remoção
      await setDoc(doc(db, 'blocked_dates', blockDate), newBlock);
      
      setShowBlockModal(false);
      setBlockReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'blocked_dates');
      alert("Erro ao bloquear data no servidor.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveBlock = async (dateString: string) => {
    if (window.confirm('Deseja desbloquear esta data?')) {
      setIsProcessing(true);
      try {
        await deleteDoc(doc(db, 'blocked_dates', dateString));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `blocked_dates/${dateString}`);
        alert("Erro ao remover bloqueio no servidor.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const filteredBookings = bookings.filter(b => {
    const isPast = isBefore(new Date(b.dateString + 'T12:00:00'), today);
    
    if (activeTab === 'history') {
      return b.status === 'confirmed' && isPast;
    }
    
    // Para as outras abas, mostramos apenas o que não é passado (ou o que é relevante para o status)
    if (activeTab === 'pending') return b.status === 'pending';
    if (activeTab === 'confirmed') return b.status === 'confirmed' && !isPast;
    if (activeTab === 'rejected') return b.status === 'rejected';
    
    return false;
  }).sort((a, b) => new Date(a.dateString).getTime() - new Date(b.dateString).getTime());

  const getTabLabel = (tab: AdminTab) => {
    switch (tab) {
      case 'pending': return 'Aguardando';
      case 'confirmed': return 'Confirmados';
      case 'rejected': return 'Rejeitados';
      case 'history': return 'Histórico';
      case 'blocked': return 'Bloqueios';
      case 'team': return 'Equipe';
    }
  };

  const getTabIcon = (tab: AdminTab) => {
    switch (tab) {
      case 'pending': return <Clock size={16} />;
      case 'confirmed': return <CheckCircle2 size={16} />;
      case 'rejected': return <XCircle size={16} />;
      case 'history': return <History size={16} />;
      case 'blocked': return <CalendarX size={16} />;
      case 'team': return <Users size={16} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/80">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-8 h-20 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-[#1e40af] p-2 rounded-xl text-white shadow-lg shadow-blue-900/20 rotate-3 overflow-hidden">
            <img src="https://i.postimg.cc/x881K4FF/Logo_emprestimo.png" alt="Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h1 className="font-black text-slate-900 uppercase tracking-tighter text-base leading-none">Painel de Controle</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão de Visitas Guiadas</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <button 
            onClick={onLogout} 
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center"
          >
            <LogOut size={14} className="mr-2" /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 space-y-8">
        {/* Tabs Navigation */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-[2rem] shadow-sm border border-slate-200">
          {(['pending', 'confirmed', 'rejected', 'history', 'blocked', 'team'] as const).filter(t => t !== 'team' || isMasterAdmin).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-[#1e40af] text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
            >
              {getTabIcon(tab)}
              <span>{getTabLabel(tab)}</span>
              {tab === 'pending' && bookings.filter(b => b.status === 'pending').length > 0 && (
                <span className="ml-2 bg-white text-[#1e40af] px-1.5 py-0.5 rounded-full text-[8px]">
                  {bookings.filter(b => b.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'blocked' && (
          <div className="flex justify-end">
            <button 
              onClick={() => setShowBlockModal(true)}
              className="bg-[#1e40af] text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-blue-900/20 flex items-center"
            >
              <Plus size={16} className="mr-2" /> Bloquear Nova Data
            </button>
          </div>
        )}

        {activeTab === 'team' && isMasterAdmin && (
          <div className="flex justify-end">
            <button 
              onClick={() => setShowAddUserModal(true)}
              className="bg-[#1e40af] text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-blue-900/20 flex items-center"
            >
              <UserPlus size={16} className="mr-2" /> Adicionar Membro
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="space-y-6">
          {activeTab === 'team' && isMasterAdmin ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamMembers.map((member) => (
                <div key={member.id} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleRemoveUser(member.id)}
                      className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-800 tracking-tighter">{member.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{member.role === 'admin' ? 'Administrador' : 'Equipe'}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">E-mail</p>
                    <p className="text-sm text-slate-700 font-bold truncate">{member.email}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'blocked' ? (
            blockedDates.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] py-24 flex flex-col items-center justify-center text-slate-400">
                 <CalendarX size={64} className="mb-6 opacity-10" />
                 <p className="font-bold uppercase tracking-widest text-xs">Nenhuma data bloqueada manualmente</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {blockedDates.sort((a, b) => new Date(a.dateString).getTime() - new Date(b.dateString).getTime()).map((block) => (
                  <div key={block.dateString} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleRemoveBlock(block.dateString)}
                        className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="bg-amber-50 p-2.5 rounded-xl text-amber-600">
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-800 tracking-tighter">
                          {format(new Date(block.dateString + 'T12:00:00'), 'dd/MM/yyyy')}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Bloqueada</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Motivo</p>
                      <p className="text-sm text-slate-700 font-bold">{block.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] py-24 flex flex-col items-center justify-center text-slate-400">
               <Search size={64} className="mb-6 opacity-10" />
               <p className="font-bold uppercase tracking-widest text-xs">Nenhum registro em "{getTabLabel(activeTab)}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredBookings.map((req) => (
                <div 
                  key={req.id} 
                  onClick={() => setSelectedBooking(req)}
                  className="bg-white border border-slate-200 rounded-[2rem] p-6 hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-300 transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-2 ${
                    req.status === 'confirmed' ? 'bg-green-500' : 
                    req.status === 'rejected' ? 'bg-blue-400' : 'bg-blue-600'
                  }`}></div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4 flex-grow">
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center ${
                          req.status === 'confirmed' ? 'bg-green-50 text-green-700' : 
                          req.status === 'rejected' ? 'bg-blue-50 text-blue-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {req.status === 'confirmed' ? <><CheckCircle2 size={10} className="mr-1"/> Confirmado</> : 
                           req.status === 'rejected' ? <><XCircle size={10} className="mr-1"/> Rejeitado</> : 
                           <><Clock size={10} className="mr-1"/> Aguardando</>}
                        </span>
                        <span className="text-slate-300 text-[9px] font-black uppercase tracking-widest">
                          ID: {req.id.substring(0, 8)} • Solicitado em {format(new Date(req.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      
                      <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <div className="flex items-center text-slate-900 font-black text-xl tracking-tighter">
                          <CalendarIcon size={20} className="mr-3 text-[#1e40af]" />
                          {format(new Date(req.dateString + 'T12:00:00'), 'dd/MM/yyyy')} 
                          <span className="mx-2 text-slate-300 font-light">—</span>
                          <span className="text-[#1e40af]">{req.slot.start}</span>
                        </div>
                        <div className="flex items-center text-slate-700 font-bold bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                          <Building2 size={18} className="mr-3 text-slate-400" />
                          {req.institutionName}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs font-bold text-slate-500 uppercase tracking-widest">
                         <div className="flex items-center"><User size={14} className="mr-2 text-slate-300" /> {req.responsibleName}</div>
                         <div className="flex items-center"><Mail size={14} className="mr-2 text-slate-300" /> {req.email}</div>
                         <div className="flex items-center"><Users size={14} className="mr-2 text-slate-300" /> {req.quantity} pessoas</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {activeTab === 'pending' && (
                        <div className="flex space-x-2">
                           <button 
                             disabled={isProcessing}
                             onClick={(e) => { e.stopPropagation(); handleConfirm(req.id); }}
                             className="bg-green-500 text-white p-3 rounded-xl hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 disabled:bg-slate-200"
                           >
                             {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                           </button>
                           <button 
                             disabled={isProcessing}
                             onClick={(e) => { e.stopPropagation(); setSelectedBooking(req); setShowRejectionModal(true); }}
                             className="bg-blue-400 text-white p-3 rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-400/20 disabled:bg-slate-200"
                           >
                             <X size={20} />
                           </button>
                        </div>
                      )}
                      <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400 group-hover:bg-[#1e40af] group-hover:text-white transition-all shadow-inner">
                         <ChevronRight size={24} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Booking Details Modal */}
      {selectedBooking && !showRejectionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center space-x-4">
                <div className="bg-[#1e40af] p-3 rounded-2xl text-white shadow-xl shadow-blue-900/20">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Detalhes da Solicitação</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status: {selectedBooking.status}</p>
                </div>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instituição</p>
                    <p className="text-lg font-bold text-slate-800">{selectedBooking.institutionName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável</p>
                    <p className="text-slate-600 font-medium">{selectedBooking.responsibleName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</p>
                    <p className="text-slate-600 font-medium">{selectedBooking.email}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data e Horário</p>
                    <p className="text-lg font-bold text-[#1e40af]">{format(new Date(selectedBooking.dateString + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })} às {selectedBooking.slot.start}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Público e Quantidade</p>
                    <p className="text-slate-600 font-medium">{selectedBooking.turma} • {selectedBooking.quantity} pessoas</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                  <MessageSquare size={12} className="mr-1" /> Objetivo Pedagógico
                </p>
                <p className="text-sm text-slate-700 leading-relaxed italic font-medium">"{selectedBooking.objective}"</p>
              </div>

              {selectedBooking.status === 'rejected' && (
                <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Motivo da Rejeição</p>
                  <p className="text-sm text-blue-700 font-bold">{selectedBooking.rejectionReason}</p>
                  {selectedBooking.rejectionDetails && (
                    <p className="text-xs text-blue-600 mt-2 font-medium">{selectedBooking.rejectionDetails}</p>
                  )}
                </div>
              )}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button 
                onClick={() => setShowDeleteConfirm(selectedBooking.id)}
                className="text-blue-500 hover:text-blue-700 text-[10px] font-black uppercase tracking-widest flex items-center"
              >
                <Trash2 size={14} className="mr-2" /> Excluir Registro
              </button>
              
              <div className="flex space-x-3">
                {selectedBooking.status === 'pending' && (
                  <>
                    <button 
                      disabled={isProcessing}
                      onClick={() => setShowRejectionModal(true)}
                      className="px-6 py-3 border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-white transition-all"
                    >
                      Rejeitar
                    </button>
                    <button 
                      disabled={isProcessing}
                      onClick={() => handleConfirm(selectedBooking.id)}
                      className="px-8 py-3 bg-green-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 shadow-lg shadow-green-500/20 transition-all flex items-center"
                    >
                      {isProcessing && <Loader2 className="animate-spin mr-2" size={14} />}
                      Confirmar Visita
                    </button>
                  </>
                )}
                <button 
                  onClick={() => setSelectedBooking(null)}
                  className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-8 animate-in zoom-in duration-200">
            <div className="text-center space-y-4">
              <div className="bg-blue-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-blue-600 shadow-inner">
                <ShieldAlert size={40} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Confirmar Exclusão</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">Esta ação é irreversível. O registro será removido permanentemente do banco de dados.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                disabled={isProcessing}
                onClick={() => handleDelete(showDeleteConfirm)}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center"
              >
                {isProcessing ? <Loader2 className="animate-spin mr-2" size={14} /> : <Trash2 size={14} className="mr-2" />}
                Confirmar Exclusão
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="w-full py-4 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 space-y-8 animate-in slide-in-from-bottom duration-300">
            <div className="text-center space-y-2">
              <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-blue-600 mb-4">
                <UserPlus size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Adicionar Membro</h3>
              <p className="text-xs text-slate-400 font-medium">Autorize um novo e-mail para acessar o painel.</p>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input 
                  required
                  type="text" 
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold text-sm"
                  placeholder="Ex: João Silva"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail (Acesso)</label>
                <input 
                  required
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all font-medium text-sm"
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha Inicial</label>
                <input 
                  required
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all font-medium text-sm"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nível de Acesso</label>
                <select 
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'staff')}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold text-sm"
                >
                  <option value="staff">Equipe (Visualização e Gestão)</option>
                  <option value="admin">Administrador (Gestão Total)</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 py-4 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center"
                >
                  {isProcessing ? <Loader2 className="animate-spin mr-2" size={14} /> : <Check size={14} className="mr-2" />}
                  Autorizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && selectedBooking && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 space-y-8 animate-in slide-in-from-bottom duration-300">
            <div className="text-center space-y-2">
              <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-blue-600 mb-4">
                <XCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Rejeitar Solicitação</h3>
              <p className="text-xs text-slate-400 font-medium">Selecione o motivo para informar ao solicitante.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo Principal</label>
                <select 
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all font-bold text-sm"
                >
                  <option value="">Selecione um motivo...</option>
                  <option value="Biblioteca fechada para manutenção interna">Biblioteca fechada para manutenção interna</option>
                  <option value="Feriado">Feriado</option>
                  <option value="Outro">Outro (Detalhar abaixo)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detalhes Adicionais</label>
                <textarea 
                  value={rejectionDetails}
                  onChange={(e) => setRejectionDetails(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all font-medium text-sm resize-none"
                  placeholder="Explique melhor o motivo da rejeição..."
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button 
                onClick={() => { setShowRejectionModal(false); setRejectionReason(''); setRejectionDetails(''); }}
                className="flex-1 py-4 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleReject}
                disabled={!rejectionReason}
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all disabled:bg-slate-200 disabled:shadow-none"
              >
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Date Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 space-y-8 animate-in slide-in-from-bottom duration-300">
            <div className="text-center space-y-2">
              <div className="bg-amber-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-amber-600 mb-4">
                <CalendarX size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Bloquear Data</h3>
              <p className="text-xs text-slate-400 font-medium">Impeça novos agendamentos para um dia específico.</p>
            </div>

            <form onSubmit={handleAddBlock} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data do Bloqueio</label>
                <input 
                  required
                  type="date" 
                  value={blockDate}
                  min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-amber-500 outline-none transition-all font-bold text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo do Bloqueio</label>
                <input 
                  required
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-amber-500 outline-none transition-all font-medium text-sm"
                  placeholder="Ex: Dedetização, Manutenção, Evento Interno..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button 
                  type="button"
                  onClick={() => { setShowBlockModal(false); setBlockReason(''); }}
                  className="flex-1 py-4 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 shadow-xl shadow-amber-600/20 transition-all"
                >
                  Confirmar Bloqueio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="max-w-6xl mx-auto p-12 text-center">
         <div className="inline-flex items-center space-x-2 text-slate-300">
            <ShieldCheck size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Área de Acesso Restrito • Gestão Biblioteca de Sobral</span>
         </div>
      </footer>
    </div>
  );
};

export default AdminDashboard;
