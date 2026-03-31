
import React, { useState, useEffect } from 'react';
import Calendar from './components/Calendar';
import BookingDialog from './components/BookingDialog';
import AdminDashboard from './components/AdminDashboard';
import { BookingData, BlockedDate } from './types';
import { BookOpen, MapPin, Mail, Sparkles, Clock, Users, AlertCircle, Lock, ShieldCheck, ChevronLeft, Loader2, UserPlus } from 'lucide-react';
import { db, auth } from './firebase';
import { collection, onSnapshot, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  signInWithEmailAndPassword 
} from './firebase';
import ErrorBoundary from './components/ErrorBoundary';
import { handleFirestoreError, OperationType } from './services/firestore';

const App: React.FC = () => {
  const [view, setView] = useState<'public' | 'admin-login' | 'admin'>('public');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [loginMethod, setLoginMethod] = useState<'google' | 'email'>('google');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [allBookings, setAllBookings] = useState<BookingData[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    // Monitorar estado de autenticação
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Verificar se é admin ou equipe
        if (currentUser.email === 'claudenir.lima00@gmail.com') {
          setIsAdminUser(true);
          setView('admin');
        } else if (currentUser.email) {
          try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.email));
            if (userDoc.exists()) {
              setIsAdminUser(true);
              setView('admin');
            } else {
              setIsAdminUser(false);
            }
          } catch (err) {
            console.error("Erro ao verificar permissões:", err);
          }
        }
      } else {
        setIsAdminUser(false);
      }
    });

    // Monitorar Bookings em tempo real
    const qBookings = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const unsubscribeBookings = onSnapshot(qBookings, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: new Date(doc.data().dateString + 'T12:00:00'),
      })) as BookingData[];
      setAllBookings(bookingsData);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'bookings');
      setError("Erro ao sincronizar agendamentos.");
      setIsLoading(false);
    });

    // Monitorar Datas Bloqueadas em tempo real
    const qBlocked = query(collection(db, 'blocked_dates'), orderBy('dateString', 'asc'));
    const unsubscribeBlocked = onSnapshot(qBlocked, (snapshot) => {
      const blockedData = snapshot.docs.map(doc => ({
        ...doc.data(),
      })) as BlockedDate[];
      setBlockedDates(blockedData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'blocked_dates');
    });

    return () => {
      unsubscribeAuth();
      unsubscribeBookings();
      unsubscribeBlocked();
    };
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loginMethod === 'email') {
      if (!adminEmail || !adminPassword) {
        setLoginError("Preencha e-mail e senha.");
        return;
      }
      setIsLoading(true);
      setLoginError(null);
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        // O onAuthStateChanged cuidará do redirecionamento
        setAdminPassword('');
        setAdminEmail('');
      } catch (err: any) {
        console.error("Erro no login com e-mail:", err);
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setLoginError("E-mail ou senha incorretos.");
        } else {
          setLoginError("Erro ao autenticar. Verifique se o login com e-mail está habilitado no Firebase.");
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Primeiro nível: Senha local (lustosa) para acesso ao Google Login
    if (adminPassword === 'lustosa') {
      setIsLoading(true);
      setLoginError(null);
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        
        if (result.user.email === 'claudenir.lima00@gmail.com') {
          setView('admin');
          setIsAdminUser(true);
          setAdminPassword('');
        } else if (result.user.email) {
          const userDoc = await getDoc(doc(db, 'users', result.user.email));
          if (userDoc.exists()) {
            setView('admin');
            setIsAdminUser(true);
            setAdminPassword('');
          } else {
            await signOut(auth);
            setLoginError("Acesso negado. E-mail não autorizado.");
          }
        }
      } catch (err) {
        console.error("Erro no login:", err);
        setLoginError("Erro ao autenticar com Google.");
      } finally {
        setIsLoading(false);
      }
    } else {
      setLoginError("Senha administrativa incorreta.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('public');
  };

  if (view === 'admin') {
    return (
      <ErrorBoundary>
        <AdminDashboard 
          onLogout={handleLogout} 
          bookings={allBookings} 
          blockedDates={blockedDates}
        />
      </ErrorBoundary>
    );
  }

  if (view === 'admin-login') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Elementos Decorativos de Fundo */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[#1e40af]"></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#1e40af]/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>

        <div className="w-full max-w-md relative z-10">
          <button 
            onClick={() => setView('public')}
            className="mb-8 flex items-center text-slate-400 hover:text-slate-800 transition-colors text-xs font-black uppercase tracking-widest"
          >
            <ChevronLeft size={16} className="mr-2" /> Voltar ao Início
          </button>

          <div className="bg-white p-12 rounded-[3rem] shadow-2xl shadow-slate-200/60 border border-slate-100 space-y-10">
            <div className="text-center space-y-4">
              <div className="bg-[#1e40af] w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto text-white shadow-2xl shadow-blue-900/30 rotate-6 overflow-hidden">
                <img src="https://i.postimg.cc/x881K4FF/Logo_emprestimo.png" alt="Logo" className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Área Privada</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Acesso Equipe Biblioteca</p>
              </div>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
              <button 
                onClick={() => setLoginMethod('google')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loginMethod === 'google' ? 'bg-white text-[#1e40af] shadow-sm' : 'text-slate-400'}`}
              >
                Google
              </button>
              <button 
                onClick={() => setLoginMethod('email')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loginMethod === 'email' ? 'bg-white text-[#1e40af] shadow-sm' : 'text-slate-400'}`}
              >
                E-mail
              </button>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-6">
              {loginError && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={18} />
                  <p className="text-[10px] font-black uppercase tracking-widest leading-tight">{loginError}</p>
                </div>
              )}
              {loginMethod === 'email' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                    <input 
                      required
                      type="email" 
                      value={adminEmail} 
                      onChange={e => setAdminEmail(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#1e40af] focus:bg-white outline-none transition-all font-bold text-sm"
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                    <input 
                      required
                      type="password" 
                      value={adminPassword} 
                      onChange={e => setAdminPassword(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#1e40af] focus:bg-white outline-none transition-all font-bold text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chave de Segurança</label>
                  <input 
                    autoFocus
                    type="password" 
                    value={adminPassword} 
                    onChange={e => setAdminPassword(e.target.value)}
                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#1e40af] focus:bg-white outline-none transition-all text-center text-2xl font-black tracking-[0.5em] placeholder:tracking-normal"
                    placeholder="••••"
                  />
                </div>
              )}
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-[#1e40af] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-900 transition-all shadow-xl shadow-blue-900/10 active:scale-95 flex items-center justify-center disabled:bg-slate-300"
              >
                {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : 'Autenticar Painel'}
              </button>
            </form>

            <div className="pt-4 text-center">
               <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Sobral • Ceará • Brasil</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-[#1e40af] p-2 rounded-xl shadow-lg shadow-blue-900/20 rotate-2 overflow-hidden">
              <img src="https://i.postimg.cc/x881K4FF/Logo_emprestimo.png" alt="Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black text-slate-900 tracking-tighter leading-none uppercase">Biblioteca Municipal de Sobral</h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lustosa da Costa</span>
            </div>
          </div>
          <button 
            onClick={() => {
              if (user && isAdminUser) {
                setView('admin');
              } else {
                setView('admin-login');
              }
            }}
            className="group flex items-center space-x-3 bg-slate-50 hover:bg-slate-900 px-5 py-2.5 rounded-xl transition-all border border-slate-100"
          >
            <Lock size={14} className="text-[#1e40af] group-hover:text-white transition-colors" /> 
            <span className="text-[10px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest">Acesso Equipe</span>
          </button>
        </div>
      </header>

      <section className="bg-white border-b border-slate-200 py-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#1e40af]/5 rounded-full -mr-48 -mt-48 blur-3xl"></div>
        <div className="max-w-5xl mx-auto px-6 text-center space-y-6 relative z-10">
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-[0.9]">Agendamento de <br/> <span className="text-[#1e40af]">Visitas Guiadas</span></h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
            Abra as portas do conhecimento para seus alunos. <br/>
            Selecione uma data no calendário abaixo para iniciar sua solicitação.
          </p>
        </div>
      </section>

      <main className="flex-grow py-16 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-3 space-y-8">
             <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8 sticky top-28">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-4">Diretrizes de Visita</h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-50 p-2.5 rounded-xl"><Clock size={18} className="text-[#1e40af]" /></div>
                  <div><p className="text-xs font-black uppercase text-slate-800 tracking-wider">Horários</p><p className="text-sm text-slate-500 font-medium">08:00 às 16:00</p></div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-50 p-2.5 rounded-xl"><Users size={18} className="text-[#1e40af]" /></div>
                  <div><p className="text-xs font-black uppercase text-slate-800 tracking-wider">Capacidade</p><p className="text-sm text-slate-500 font-medium">Máximo 40 pessoas</p></div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-50 p-2.5 rounded-xl"><MapPin size={18} className="text-[#1e40af]" /></div>
                  <div><p className="text-xs font-black uppercase text-slate-800 tracking-wider">Endereço</p><p className="text-sm text-slate-500 font-medium leading-snug">R. Randal Pompeu, S/N - Centro, Sobral</p></div>
                </div>
              </div>

              <div className="pt-4">
                 <div className="bg-slate-900 rounded-2xl p-5 text-white">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60 italic">Dica Importante</p>
                    <p className="text-xs font-medium leading-relaxed">Agende com pelo menos 48h de antecedência para garantir a melhor experiência para seu grupo.</p>
                 </div>
              </div>
            </div>
            
            {error && (
              <div className="bg-blue-50 border-2 border-blue-100 p-6 rounded-2xl flex items-start space-x-4 shadow-xl shadow-blue-900/5 animate-bounce">
                <AlertCircle className="text-blue-600 flex-shrink-0" size={24} />
                <div>
                  <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1">Status do Sistema</p>
                  <p className="text-xs font-bold text-blue-700 leading-tight">{error}</p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-9 relative">
            {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center rounded-[2.5rem]"><Loader2 className="animate-spin text-[#1e40af] mb-4" size={48} /><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Sincronizando Agenda</p></div>}
            <Calendar 
              onSelectDate={(date) => { setSelectedDate(date); setShowDialog(true); }} 
              selectedDate={selectedDate} 
              bookings={allBookings}
              blockedDates={blockedDates}
            />
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 text-white py-16 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center space-y-8 text-center">
          <div className="flex items-center space-x-3 opacity-40">
            <img src="https://i.postimg.cc/x881K4FF/Logo_emprestimo.png" alt="Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
            <div className="h-4 w-px bg-white"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Sobral Ceará</span>
          </div>
          <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">© {new Date().getFullYear()} Biblioteca Municipal de Sobral Lustosa da Costa</p>
        </div>
      </footer>

      {showDialog && selectedDate && (
        <ErrorBoundary>
          <BookingDialog 
            date={selectedDate} 
            existingBookings={allBookings}
            onClose={() => { setShowDialog(false); setSelectedDate(null); }}
            onComplete={() => { setShowDialog(false); setSelectedDate(null); }}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default App;
