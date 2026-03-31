import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Sparkles, 
  RotateCw, 
  BookOpen, 
  GraduationCap,
  Menu,
  X,
  Settings as SettingsIcon,
  LogOut,
  LogIn,
  UserPlus as UserPlusIcon,
  BookMarked,
  Calendar,
  Swords,
  Search,
  ChevronLeft,
  ChevronRight,
  Camera,
  TrendingUp
} from 'lucide-react';
import { auth } from './firebase';
import { firestoreService } from './lib/firestore';
import { 
  onAuthStateChanged, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  User
} from 'firebase/auth';
import StudentManagement from './components/StudentManagement';
import MaterialGenerator from './components/MaterialGenerator';
import WheelOfFortune from './components/WheelOfFortune';
import StoryFactory from './components/StoryFactory';
import Settings from './components/Settings';
import SavedMaterials from './components/SavedMaterials';
import SpecialDays from './components/SpecialDays';
import DuelMode from './components/DuelMode';
import WeeklyResearch from './components/WeeklyResearch';
import PhotoToQuestion from './components/PhotoToQuestion';
import AdminDashboard from './components/AdminDashboard';

type Tab = 'students' | 'generator' | 'wheel' | 'story' | 'saved' | 'settings' | 'special' | 'duel' | 'research' | 'photo' | 'admin';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('students');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupGrade, setSignupGrade] = useState('1');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState<'kvkk' | 'terms' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success after opening dialog
    }
  };

  useEffect(() => {
    if (activeTab === 'duel') {
      setIsSidebarCollapsed(true);
    }
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userData = await firestoreService.getUser(user.uid);
        setUserRole(userData?.role || 'user');
      } else {
        setUserRole(null);
      }
      setAuthLoading(false);
    });
    // Force dark mode
    document.documentElement.classList.add('dark');
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      setShowLegalModal(null);
    }
  }, [user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isSignUp) {
      if (!firstName || !lastName) {
        setError('Lütfen adınızı ve soyadınızı girin.');
        return;
      }
      if (!agreedToTerms) {
        setError('Lütfen kullanıcı sözleşmesini ve KVKK metnini onaylayın.');
        return;
      }
    }
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await firestoreService.saveUser({
          uid: userCredential.user.uid,
          email: userCredential.user.email || '',
          role: 'user',
          grade: signupGrade,
          firstName,
          lastName
        });
        await firestoreService.saveSettings({
          defaultGrade: signupGrade,
          ownerId: userCredential.user.uid
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSignUp && !agreedToTerms) {
      setError('Lütfen kullanıcı sözleşmesini ve KVKK metnini onaylayın.');
      return;
    }
    setError('');
    try {
      if (!auth) {
        throw new Error('Firebase Auth is not initialized.');
      }
      const provider = new GoogleAuthProvider();
      if (!provider) {
        throw new Error('Google Auth Provider could not be created.');
      }
      const result = await signInWithPopup(auth, provider);
      
      // Check if user already exists to avoid overwriting name/surname if they already set it
      const existingSettings = await firestoreService.getSettings();
      if (!existingSettings) {
        await firestoreService.saveUser({
          uid: result.user.uid,
          email: result.user.email || '',
          role: 'user',
          firstName: result.user.displayName?.split(' ')[0] || '',
          lastName: result.user.displayName?.split(' ').slice(1).join(' ') || ''
        });
        await firestoreService.saveSettings({
          defaultGrade: '1',
          ownerId: result.user.uid
        });
      }
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      if (err.code === 'auth/argument-error') {
        setError('Giriş yapılamadı. Firebase Auth veya Sağlayıcı hatası. Lütfen sayfayı yenileyip tekrar deneyin.');
      } else {
        setError(err.message);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Lütfen e-posta adresinizi girin.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Şifre sıfırlama bağlantısı e-postanıza gönderildi. Lütfen spam (gereksiz) kutunuzu da kontrol etmeyi unutmayın.');
    } catch (err: any) {
      setError('Şifre sıfırlama e-postası gönderilemedi. Lütfen e-posta adresinizi kontrol edin.');
    }
  };

  const handleLogout = () => signOut(auth);

  const tabs = [
    { id: 'students', label: 'Öğrenciler', icon: Users, color: 'text-blue-500' },
    { id: 'generator', label: 'Materyal Üretici', icon: Sparkles, color: 'text-yellow-500' },
    { id: 'photo', label: 'Fotoğraftan Soru', icon: Camera, color: 'text-pink-500' },
    { id: 'wheel', label: 'Çarkıfelek', icon: RotateCw, color: 'text-purple-500' },
    { id: 'duel', label: 'Düello Modu', icon: Swords, color: 'text-red-500' },
    { id: 'story', label: 'Hikaye Fabrikası', icon: BookOpen, color: 'text-green-500' },
    { id: 'special', label: 'Belirli Günler', icon: Calendar, color: 'text-orange-500' },
    { id: 'research', label: 'Haftalık Araştırma', icon: Search, color: 'text-cyan-500' },
    { id: 'saved', label: 'Kayıtlı Materyaller', icon: BookMarked, color: 'text-pink-500' },
    { id: 'settings', label: 'Ayarlar', icon: SettingsIcon, color: 'text-slate-500' },
    ...(userRole === 'admin' ? [{ id: 'admin', label: 'Yönetici Paneli', icon: TrendingUp, color: 'text-indigo-500' }] : []),
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-primary"
        >
          <GraduationCap size={64} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {!user ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-8 rounded-[2rem] w-full max-w-md space-y-8"
          >
            <div className="text-center space-y-2">
              <div className="inline-block p-4 bg-primary rounded-3xl text-white mb-4">
                <GraduationCap size={48} />
              </div>
              <h1 className="text-3xl font-black text-primary">Aysun Öğretmen</h1>
              <p className="opacity-60 font-medium">Hoş geldiniz! Lütfen giriş yapın.</p>
            </div>

            {isForgotPassword ? (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-primary">Şifremi Unuttum</h2>
                  <p className="text-sm text-slate-400">E-posta adresinizi girin, size bir sıfırlama bağlantısı gönderelim.</p>
                </div>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <input
                    type="email"
                    placeholder="E-posta"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field border-slate-700 bg-slate-800 text-white"
                    required
                  />
                  {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                  {message && <p className="text-green-500 text-xs font-bold">{message}</p>}
                  <button type="submit" className="btn-primary w-full">
                    Sıfırlama Bağlantısı Gönder
                  </button>
                </form>
                <button 
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError('');
                    setMessage('');
                  }}
                  className="w-full text-sm font-bold text-primary hover:underline"
                >
                  Giriş Ekranına Dön
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleAuth} className="space-y-4">
                  {isSignUp && (
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Adınız"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="input-field border-slate-700 bg-slate-800 text-white"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Soyadınız"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="input-field border-slate-700 bg-slate-800 text-white"
                        required
                      />
                    </div>
                  )}
                  <input
                    type="email"
                    placeholder="E-posta"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field border-slate-700 bg-slate-800 text-white"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Şifre"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field border-slate-700 bg-slate-800 text-white"
                    required
                  />
                  
                  {isSignUp && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold opacity-50 uppercase text-slate-400">Okuttuğunuz Sınıf Seviyesi</label>
                        <select 
                          value={signupGrade} 
                          onChange={(e) => setSignupGrade(e.target.value)}
                          className="input-field border-slate-700 bg-slate-800 text-white"
                        >
                          {[1, 2, 3, 4].map(n => <option key={n} value={n.toString()}>{n}. Sınıf</option>)}
                        </select>
                      </div>

                      <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                        <input 
                          type="checkbox" 
                          id="terms"
                          checked={agreedToTerms}
                          onChange={(e) => setAgreedToTerms(e.target.checked)}
                          className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-800 text-primary focus:ring-primary"
                        />
                        <label htmlFor="terms" className="text-xs text-slate-400 leading-relaxed">
                          <span 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowLegalModal('terms');
                            }} 
                            className="text-primary hover:underline font-bold cursor-pointer"
                          >
                            Kullanıcı Sözleşmesi
                          </span> ve <span 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowLegalModal('kvkk');
                            }} 
                            className="text-primary hover:underline font-bold cursor-pointer"
                          >
                            KVKK Aydınlatma Metni
                          </span>'ni okudum, onaylıyorum.
                        </label>
                      </div>
                    </>
                  )}

                  {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                  {message && <p className="text-green-500 text-xs font-bold">{message}</p>}
                  
                  <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                    {isSignUp ? <UserPlusIcon size={20} /> : <LogIn size={20} />}
                    {isSignUp ? 'Kayıt Ol' : 'Giriş Yap'}
                  </button>
                </form>

                {!isSignUp && (
                  <button 
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError('');
                      setMessage('');
                    }}
                    className="w-full text-xs font-bold text-slate-400 hover:text-primary transition-colors"
                  >
                    Şifremi Unuttum
                  </button>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-700"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900 px-2 text-slate-500">Veya</span>
                  </div>
                </div>

                <button 
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 px-4 bg-white text-slate-900 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-100 transition-all"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                  Google ile Giriş Yap
                </button>

                <button 
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                    setMessage('');
                  }}
                  className="w-full text-sm font-bold text-primary hover:underline"
                >
                  {isSignUp ? 'Zaten hesabınız var mı? Giriş yapın' : 'Hesabınız yok mu? Kayıt olun'}
                </button>
              </>
            )}
          </motion.div>
        </div>
      ) : (
        <div className="min-h-screen flex flex-col bg-slate-900 overflow-x-hidden">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4 flex justify-between items-center bg-slate-800/80 border-b border-slate-700/20">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('students')}>
          <div className="p-2 bg-gradient-to-br from-primary to-indigo-600 rounded-xl text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
            <GraduationCap size={28} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-400 truncate">
              Aysun Öğretmen
            </h1>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 -mt-1 hidden sm:block">
              Yapay Zeka Eğitim Asistanı
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={handleLogout}
            className="p-2 md:p-3 rounded-2xl hover:bg-red-900/20 text-red-500 transition-colors"
            title="Çıkış Yap"
          >
            <LogOut size={20} md:size={24} />
          </button>

          <button 
            className="md:hidden p-2 md:p-3 rounded-2xl hover:bg-slate-800 text-slate-400"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* API Key Selection Banner */}
      {!hasApiKey && user && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 p-3 flex items-center justify-between mx-6 mt-4 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-500 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Görsel oluşturma özellikleri için bir API anahtarı seçmeniz gerekmektedir.</span>
          </div>
          <button
            onClick={handleOpenSelectKey}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Anahtar Seç
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row relative">
        {/* Sidebar / Navigation */}
        <nav className={`
          glass md:m-6 md:rounded-3xl p-4 space-y-2 bg-slate-800/80 border border-slate-700/20 transition-all duration-300
          ${isSidebarCollapsed ? 'md:w-24' : 'md:w-72'}
          ${isMenuOpen ? 'fixed inset-0 z-40 pt-24' : 'hidden md:block'}
        `}>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex w-full items-center justify-center p-2 mb-4 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>

          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as Tab);
                setIsMenuOpen(false);
              }}
              className={`
                w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all duration-200
                ${activeTab === tab.id 
                  ? 'bg-primary text-white shadow-lg scale-105' 
                  : 'hover:bg-slate-800 text-slate-400'}
                ${isSidebarCollapsed ? 'justify-center' : ''}
              `}
              title={isSidebarCollapsed ? tab.label : ''}
            >
              <tab.icon size={24} className={activeTab === tab.id ? 'text-white' : tab.color} />
              {!isSidebarCollapsed && <span className="truncate">{tab.label}</span>}
            </button>
          ))}
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-12 overflow-y-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {activeTab === 'students' && <StudentManagement />}
              {activeTab === 'generator' && <MaterialGenerator />}
              {activeTab === 'photo' && <PhotoToQuestion />}
              {activeTab === 'wheel' && <WheelOfFortune />}
              {activeTab === 'duel' && <DuelMode />}
              {activeTab === 'story' && <StoryFactory />}
              {activeTab === 'special' && <SpecialDays />}
              {activeTab === 'research' && <WeeklyResearch />}
              {activeTab === 'saved' && <SavedMaterials />}
              {activeTab === 'settings' && <Settings />}
              {activeTab === 'admin' && <AdminDashboard />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )}

  <AnimatePresence>
        {showLegalModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="glass p-8 rounded-[2rem] w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-slate-800 border-slate-700 space-y-6"
            >
              <div className="flex justify-between items-center sticky top-0 bg-slate-800 py-2 border-b border-slate-700 mb-4">
                <h3 className="text-2xl font-black text-primary">
                  {showLegalModal === 'kvkk' ? 'KVKK Aydınlatma Metni' : 'Kullanıcı Sözleşmesi'}
                </h3>
                <button onClick={() => setShowLegalModal(null)} className="p-2 hover:bg-slate-700 rounded-full text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed">
                {showLegalModal === 'kvkk' ? (
                  <>
                    <h4>1. Veri Sorumlusu</h4>
                    <p>Aysun Öğretmen platformu olarak, kişisel verilerinizin güvenliği hususuna azami hassasiyet göstermekteyiz. Bu kapsamda, 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca veri sorumlusu sıfatıyla hareket etmekteyiz.</p>
                    
                    <h4>2. İşlenen Kişisel Verileriniz</h4>
                    <p>Platformumuza kayıt olmanız durumunda; adınız, soyadınız, e-posta adresiniz, okuttuğunuz sınıf seviyesi ve kullanım tercihleriniz işlenmektedir. Google ile giriş yapmanız durumunda Google profilinizden sağlanan bilgiler (ad, soyad, e-posta, profil fotoğrafı) işlenmektedir.</p>
                    
                    <h4>3. Kişisel Verilerin İşlenme Amacı</h4>
                    <p>Kişisel verileriniz; platform hizmetlerinin sunulması, kullanıcı deneyiminin iyileştirilmesi, eğitim materyallerinin kişiselleştirilmesi ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenmektedir.</p>
                    
                    <h4>4. Verilerin Aktarılması</h4>
                    <p>Kişisel verileriniz, yasal zorunluluklar haricinde üçüncü şahıslarla paylaşılmamaktadır. Verileriniz güvenli bulut sunucularında (Firebase/Google Cloud) muhafaza edilmektedir.</p>
                    
                    <h4>5. Haklarınız</h4>
                    <p>KVKK’nın 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, düzeltilmesini veya silinmesini isteme haklarına sahipsiniz.</p>
                  </>
                ) : (
                  <>
                    <h4>1. Taraflar</h4>
                    <p>İşbu sözleşme, Aysun Öğretmen platformu ile platforma kayıt olan kullanıcı arasında akdedilmiştir.</p>
                    
                    <h4>2. Hizmetin Kapsamı</h4>
                    <p>Aysun Öğretmen, öğretmenlere yönelik yapay zeka destekli eğitim materyali üretim asistanıdır. Sunulan içerikler yapay zeka tarafından üretilmekte olup, doğruluk kontrolü kullanıcının sorumluluğundadır.</p>
                    
                    <h4>3. Kullanım Şartları</h4>
                    <p>Kullanıcı, platformu yasalara ve ahlaka uygun şekilde kullanmayı taahhüt eder. Üretilen içeriklerin ticari amaçla toplu satışı yasaktır.</p>
                    
                    <h4>4. Sorumluluk Sınırı</h4>
                    <p>Yapay zeka tarafından üretilen içeriklerdeki hatalardan veya bu içeriklerin kullanımından doğabilecek doğrudan/dolaylı zararlardan Aysun Öğretmen sorumlu tutulamaz.</p>
                    
                    <h4>5. Fikri Mülkiyet</h4>
                    <p>Platform tasarımı ve yazılımı Aysun Öğretmen'e aittir. Kullanıcıya sunulan içeriklerin kullanım hakkı kullanıcıya aittir.</p>
                  </>
                )}
              </div>

              <button 
                onClick={() => setShowLegalModal(null)}
                className="btn-primary w-full py-4 mt-6"
              >
                Anladım
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="p-6 text-center text-sm opacity-50 font-medium">
        &copy; 2026 Aysun Öğretmen - Sevgiyle Hazırlandı ❤️
      </footer>
    </div>
  );
}
