import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Pizza, Settings as SettingsIcon, Eye, Plus, Trash2, Phone, Instagram, Facebook, Smartphone, Globe,
  Image as ImageIcon, Check, Info, X, ZoomIn, Move, Copy, Share2, QrCode, Download, LogOut, UploadCloud, LogIn, Mail, Lock, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType, loginWithEmail, registerWithEmail, resetPassword } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, onSnapshot, serverTimestamp, getDocFromServer } from 'firebase/firestore';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  ingredients?: string;
  ml?: number;
}

interface AppData {
  title: string;
  subtitle: string;
  phone: string;
  heroImg: string;
  logoImg: string;
  menu: {
    pizze: MenuItem[];
    bianche: MenuItem[];
    speciali: MenuItem[];
    pucce: MenuItem[];
    bibite: MenuItem[];
  };
  socials: {
    whatsapp: { enabled: boolean; url: string };
    facebook: { enabled: boolean; url: string };
    instagram: { enabled: boolean; url: string };
    tiktok: { enabled: boolean; url: string };
  };
}

const CATEGORIES = {
  pizze: 'Pizza',
  bianche: 'Pizze Bianche',
  speciali: 'Speciali',
  pucce: 'Pucce',
  bibite: 'Bibite'
};

const WhatsAppIcon = ({ size = 24, className = '' }: { size?: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const SOCIAL_ICONS: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Smartphone,
  whatsapp: WhatsAppIcon,
  google: Globe
};

function QrCodeModal({ url, onClose }: { url: string, onClose: () => void }) {
  const downloadQrCode = () => {
    const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = 'menu-qrcode.png';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="font-bold text-pizza-dark italic flex items-center gap-2"><QrCode size={18} /> QR Code Menù</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="p-8 flex flex-col items-center justify-center bg-neutral-50">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-100 mb-6">
            <QRCodeCanvas value={url} size={200} id="qr-code-canvas" level="H" />
          </div>
          <p className="text-center text-sm text-neutral-500 mb-6 w-full break-all">{url}</p>
          <button onClick={downloadQrCode} className="w-full py-3 px-4 rounded-xl bg-pizza-dark text-white text-sm font-bold shadow-lg hover:bg-black transition-colors flex items-center justify-center gap-2">
            <Download size={18} /> Scarica QR Code
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Dashboard() {
  const [view, setView] = useState<'dash' | 'preview'>('dash');
  const [activeTab, setActiveTab] = useState<keyof AppData['menu']>('pizze');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({});
  const [previewTab, setPreviewTab] = useState<keyof AppData['menu']>('pizze');
  const [saveStatus, setSaveStatus] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const lastSavedJson = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        await loginWithEmail(email, password);
      } else if (authMode === 'register') {
        await registerWithEmail(email, password);
      } else if (authMode === 'reset') {
        await resetPassword(email);
        setAuthMessage('Email di recupero inviata! Controlla la tua casella di posta.');
        setAuthMode('login');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      let errorMsg = 'Errore di autenticazione. Verifica le tue credenziali.';
      if (error.code === 'auth/email-already-in-use') errorMsg = 'Questa email è già in uso.';
      if (error.code === 'auth/invalid-credential') errorMsg = 'Email o password errati.';
      if (error.code === 'auth/weak-password') errorMsg = 'La password deve avere almeno 6 caratteri.';
      if (error.code === 'auth/operation-not-allowed') errorMsg = 'La registrazione con Email/Password non è abilitata nella Console Firebase. Abilitala sotto Authentication > Sign-in method.';
      setAuthError(errorMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    async function testConnection() {
      try { await getDocFromServer(doc(db, 'test', 'connection')); } catch (e) { console.error("Firebase connection error:", e); }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsubscribe();
  }, []);

  const [data, setData] = useState<AppData>({
    title: 'Da Mario', subtitle: 'Pizzeria Artigianale dal 1985', phone: '+39 080 123 4567', heroImg: '', logoImg: '',
    menu: { pizze: [{ id: '1', name: 'Margherita', price: 6, ingredients: 'pomodoro, mozzarella, basilico' }], bianche: [], speciali: [], pucce: [], bibite: [] },
    socials: { whatsapp: { enabled: false, url: '' }, facebook: { enabled: false, url: '' }, instagram: { enabled: false, url: '' }, tiktok: { enabled: false, url: '' } }
  });

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'pizzerias', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const fetched = snapshot.data() as any;
        const { updatedAt, ownerId, ...cleanFetched } = fetched;

        setData((currentData) => {
          const { updatedAt: _, ownerId: __, ...currentClean } = currentData as any;
          if (JSON.stringify(cleanFetched) !== JSON.stringify(currentClean)) {
            lastSavedJson.current = JSON.stringify(cleanFetched);
            return fetched as AppData;
          }
          return currentData;
        });
      }
    }, (error) => {
      if (error.message.includes('quota') || error.message.includes('exhausted')) setQuotaExceeded(true);
      handleFirestoreError(error, OperationType.GET, `pizzerias/${user.uid}`);
    });
    return () => unsubscribe();
  }, [user]);

  const saveDataToFirestore = useCallback(async (newData: AppData) => {
    if (!user || quotaExceeded) return;

    const { updatedAt: _, ownerId: __, ...cleanNewData } = newData as any;

    if (lastSavedJson.current) {
        try {
            const parsedLastSaved = JSON.parse(lastSavedJson.current);
            if (JSON.stringify(cleanNewData) === JSON.stringify(parsedLastSaved)) return;
        } catch(e) {}
    }

    try {
      setSaveStatus(true);
      lastSavedJson.current = JSON.stringify(cleanNewData);
      await setDoc(doc(db, 'pizzerias', user.uid), {
        ...newData,
        ownerId: user.uid,
        // Versione lowercase dell'UID, usata dalla pagina pubblica come fallback
        // quando Facebook (o altre app) converte il link in minuscolo.
        slugLower: user.uid.toLowerCase(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      setTimeout(() => setSaveStatus(false), 2000);
    } catch (error: any) {
      if (error.message.includes('quota') || error.message.includes('exhausted')) {
        setQuotaExceeded(true);
      }
      handleFirestoreError(error, OperationType.WRITE, `pizzerias/${user.uid}`);
    }
  }, [user, quotaExceeded]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveDataToFirestore(data), 1500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [data, saveDataToFirestore]);

  const updateField = (field: keyof AppData, value: string) => setData(prev => ({ ...prev, [field]: value }));

  const addMenuItem = (cat: keyof AppData['menu']) => {
    const nameInput = document.getElementById(`add-${cat}-name`) as HTMLInputElement;
    const priceInput = document.getElementById(`add-${cat}-price`) as HTMLInputElement;
    const detailInput = document.getElementById(`add-${cat}-detail`) as HTMLInputElement;
    if (!nameInput.value || !priceInput.value) return;
    const newItem: MenuItem = { id: Math.random().toString(36).substr(2, 9), name: nameInput.value, price: parseFloat(priceInput.value), [cat === 'bibite' ? 'ml' : 'ingredients']: cat === 'bibite' ? parseInt(detailInput.value) : detailInput.value };
    setData(prev => ({ ...prev, menu: { ...prev.menu, [cat]: [...prev.menu[cat], newItem] } }));
    nameInput.value = ''; priceInput.value = ''; detailInput.value = '';
  };

  const removeMenuItem = (cat: keyof AppData['menu'], id: string) => {
    setData(prev => ({ ...prev, menu: { ...prev.menu, [cat]: prev.menu[cat].filter(item => item.id !== id) } }));
  };

  const startEditing = (item: MenuItem) => {
    setEditingItemId(item.id);
    setEditForm(item);
  };

  const saveEditMenuItem = (cat: keyof AppData['menu'], id: string) => {
    if (!editForm.name || editForm.price === undefined) return;

    setData(prev => ({
      ...prev,
      menu: {
        ...prev.menu,
        [cat]: prev.menu[cat].map(item => item.id === id ? { ...item, ...editForm } as MenuItem : item)
      }
    }));
    setEditingItemId(null);
    setEditForm({});
  };

  const updateSocial = (platform: keyof AppData['socials'], field: 'enabled' | 'url', value: any) => {
    setData(prev => ({
      ...prev,
      socials: {
        ...prev.socials,
        [platform]: {
          ...prev.socials[platform],
          [field]: value
        }
      }
    }));
  };

  const baseUrl = process.env.APP_URL || window.location.origin;
  // L'UID Firebase contiene lettere maiuscole/minuscole miste, ma alcune
  // piattaforme (es. Facebook) convertono i link in minuscolo rompendoli.
  // Generiamo il link sempre in minuscolo: il fallback `slugLower` lato
  // PublicMenu si occupa di trovare il documento corretto.
  const currentUrl = `${baseUrl}/menu/${data.title ? data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'pizzeria'}-${(user?.uid || 'demo').toLowerCase()}`;

  return (
    <div className="min-h-screen flex flex-col bg-[#f0ebe4]">
      <header className="bg-pizza-dark border-b-4 border-pizza-red px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-white text-2xl font-bold tracking-tight italic flex items-center gap-2"><Pizza className="text-pizza-red" size={28} /> Pizzeria Dashboard</h1>
            <p className="text-neutral-400 text-sm mt-1">Gestione menu e anteprima live</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AnimatePresence>
            {quotaExceeded && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase"><Info size={12} /> Quota Esaurita</motion.div>}
            {saveStatus && !quotaExceeded && <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 border border-green-500/20"><Check size={12} /> Salvato</motion.div>}
          </AnimatePresence>
          {user ? (
            <button onClick={logout} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-neutral-300 px-4 py-2 rounded-full text-sm font-bold transition-all border border-white/10">
              <img src={user.photoURL || ''} className="w-5 h-5 rounded-full border border-white/20" alt="Avatar" />
              <span>Logout</span><LogOut size={16} />
            </button>
          ) : (
            <button onClick={loginWithGoogle} className="flex items-center gap-2 bg-pizza-red text-white px-5 py-2 rounded-full text-sm font-bold"><LogIn size={16} /> Accedi</button>
          )}
        </div>
      </header>
      <nav className="bg-[#0f0600] border-b-2 border-pizza-red sticky top-[80px] z-40 flex">
        <button onClick={() => setView('dash')} className={`px-8 py-4 text-sm font-medium transition-all ${view === 'dash' ? 'text-white border-b-4 border-pizza-gold' : 'text-neutral-400'}`}>Dashboard</button>
        <button onClick={() => setView('preview')} className={`px-8 py-4 text-sm font-medium transition-all ${view === 'preview' ? 'text-white border-b-4 border-pizza-gold' : 'text-neutral-400'}`}>Anteprima Live</button>
      </nav>
      <main className="flex-1 overflow-x-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="text-pizza-red">
              <Pizza size={48} />
            </motion.div>
          </div>
        ) : !user && view === 'dash' ? (
          <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl shadow-xl border border-neutral-100">
            <div className="w-20 h-20 bg-pizza-red/10 rounded-full flex items-center justify-center mx-auto text-pizza-red mb-6">
              <Pizza size={40} />
            </div>
            <h2 className="text-2xl font-bold text-center text-pizza-dark mb-2">Benvenuto</h2>
            <p className="text-center text-neutral-500 text-sm mb-8">
              {authMode === 'login' ? 'Accedi per gestire il tuo menu digitale.' :
               authMode === 'register' ? 'Crea un nuovo account gratuito.' :
               'Reimposta la tua password.'}
            </p>

            {authError && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs rounded-r-lg">{authError}</div>}
            {authMessage && <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-700 text-xs rounded-r-lg">{authMessage}</div>}

            <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-bold text-neutral-500 mb-1 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-neutral-400" size={16} />
                  <input
                    type="email" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-pizza-red focus:border-pizza-red outline-none transition-all"
                    placeholder="tua@email.com"
                  />
                </div>
              </div>

              {authMode !== 'reset' && (
                <div>
                  <label className="text-xs font-bold text-neutral-500 mb-1 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 text-neutral-400" size={16} />
                    <input
                      type="password" required
                      value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-pizza-red focus:border-pizza-red outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              <button type="submit" disabled={authLoading} className="w-full bg-pizza-dark flex justify-center items-center gap-2 hover:bg-black text-white font-bold py-3 rounded-xl transition-colors shadow-lg disabled:opacity-50">
                {authLoading && <div className="w-4 h-4 rounded-full border-2 border-white/50 border-t-white animate-spin" />}
                {authMode === 'login' ? 'Accedi' : authMode === 'register' ? 'Registrati' : 'Invia Email di Recupero'}
              </button>
            </form>

            <div className="relative flex items-center py-2 mb-6">
              <div className="flex-grow border-t border-neutral-200"></div>
              <span className="flex-shrink-0 mx-4 text-neutral-400 text-xs">OPPURE</span>
              <div className="flex-grow border-t border-neutral-200"></div>
            </div>

            <button onClick={loginWithGoogle} type="button" className="w-full flex items-center justify-center gap-3 bg-white border-2 border-neutral-200 text-neutral-700 hover:bg-neutral-50 font-bold py-3 rounded-xl transition-colors mb-6">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continua con Google
            </button>

            <div className="text-center space-y-2 text-xs text-neutral-500">
              {authMode === 'login' ? (
                <>
                  <p>Non hai un account? <button onClick={() => setAuthMode('register')} className="text-pizza-red font-bold hover:underline">Registrati</button></p>
                  <p><button onClick={() => setAuthMode('reset')} className="hover:underline">Hai dimenticato la password?</button></p>
                </>
              ) : (
                <p>Hai già un account? <button onClick={() => setAuthMode('login')} className="text-pizza-red font-bold hover:underline">Accedi</button></p>
              )}
            </div>
          </div>
        ) : view === 'dash' ? (
          <div className="max-w-4xl mx-auto p-6 space-y-8">
            {quotaExceeded && <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">Limite Free Firebase raggiunto per oggi. Salvataggio disabilitato.</div>}

            {/* IMMAGINI CON URL */}
            <section className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-pizza-dark mb-4 flex items-center gap-2"><ImageIcon className="text-pizza-red" size={24} /> Immagini (con URL)</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-bold text-neutral-500 uppercase block mb-2">URL Immagine Hero</label>
                  <input type="text" value={data.heroImg} onChange={(e) => updateField('heroImg', e.target.value)} placeholder="https://..." className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-bold text-neutral-500 uppercase block mb-2">URL Logo Pizzeria</label>
                  <input type="text" value={data.logoImg} onChange={(e) => updateField('logoImg', e.target.value)} placeholder="https://..." className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-sm" />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm"><h2 className="text-xl font-semibold mb-4">Informazioni</h2><div className="space-y-4"><div><label className="text-sm font-bold text-neutral-500 mb-1 block">Nome</label><input type="text" value={data.title} onChange={(e) => updateField('title', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-sm" /></div><div><label className="text-sm font-bold text-neutral-500 mb-1 block">Sottotitolo</label><input type="text" value={data.subtitle} onChange={(e) => updateField('subtitle', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-sm" /></div></div></section>

            <section className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm"><h2 className="text-lg font-semibold mb-4"><Phone className="text-pizza-red" size={20} /> Contatti</h2><div><label className="text-sm font-bold text-neutral-500 mb-1 block">Numero Telefono</label><input type="text" value={data.phone} onChange={(e) => updateField('phone', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-sm" /></div></section>

            <section className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm"><h2 className="text-lg font-semibold mb-4">Social Media</h2><div className="space-y-4">{(['instagram', 'facebook', 'whatsapp', 'tiktok'] as const).map(platform => (<div key={platform} className="border border-neutral-200 rounded-lg p-4"><div className="flex items-center gap-2 mb-2">{SOCIAL_ICONS[platform] && <div className="text-pizza-red">{(() => { const Icon = SOCIAL_ICONS[platform]; return Icon ? <Icon size={20} /> : null; })()}</div>}<label className="text-sm font-bold text-neutral-700 capitalize">{platform}</label><input type="checkbox" checked={data.socials[platform].enabled} onChange={(e) => updateSocial(platform, 'enabled', e.target.checked)} className="ml-auto w-4 h-4 cursor-pointer" /></div>{data.socials[platform].enabled && (<input type="text" value={data.socials[platform].url} onChange={(e) => updateSocial(platform, 'url', e.target.value)} placeholder={platform === 'whatsapp' ? '+39 123 456 7890' : `https://${platform}.com/tuoprofilo`} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2 text-sm" />)}</div>))}</div></section>

            <section className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm"><h2 className="text-lg font-semibold mb-6 flex items-center gap-2"><Pizza size={20} /> Gestione Menu</h2><div className="flex flex-wrap gap-2 mb-6">{Object.entries(CATEGORIES).map(([key, label]) => (<button key={key} onClick={() => setActiveTab(key as any)} className={`px-4 py-2 rounded-full text-sm font-bold active:scale-95 transition-all ${activeTab === key ? 'bg-pizza-red text-white' : 'bg-neutral-100 text-neutral-500'}`}>{label}</button>))}</div><div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"><input id={`add-${activeTab}-name`} placeholder="Nome" className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-sm" /><input id={`add-${activeTab}-price`} type="number" placeholder="Prezzo" className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-sm" /><input id={`add-${activeTab}-detail`} placeholder={activeTab === 'bibite' ? 'ml' : 'Ingredienti'} className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-sm" /><button onClick={() => addMenuItem(activeTab)} className="bg-pizza-dark text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-black transition-colors">+ Aggiungi</button></div><div className="space-y-3">
  {data.menu[activeTab].map(item => (
    <div key={item.id} className={`bg-neutral-50 border border-neutral-200 rounded-lg p-4 flex ${editingItemId === item.id ? 'flex-col gap-3' : 'items-center justify-between group'}`}>
      {editingItemId === item.id ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
          <input
            value={editForm.name || ''}
            onChange={(e) => setEditForm(prev => ({...prev, name: e.target.value}))}
            placeholder="Nome" className="bg-white border border-neutral-300 rounded-lg px-4 py-2 text-sm w-full"
          />
          <input
            type="number"
            value={editForm.price || ''}
            onChange={(e) => setEditForm(prev => ({...prev, price: parseFloat(e.target.value)}))}
            placeholder="Prezzo" className="bg-white border border-neutral-300 rounded-lg px-4 py-2 text-sm w-full"
          />
          <input
            value={activeTab === 'bibite' ? (editForm.ml || '') : (editForm.ingredients || '')}
            onChange={(e) => setEditForm(prev => activeTab === 'bibite' ? {...prev, ml: parseInt(e.target.value) || undefined} : {...prev, ingredients: e.target.value})}
            placeholder={activeTab === 'bibite' ? 'ml' : 'Ingredienti'} className="bg-white border border-neutral-300 rounded-lg px-4 py-2 text-sm w-full"
          />
          <div className="flex gap-2 w-full">
            <button onClick={() => saveEditMenuItem(activeTab, item.id)} className="flex-1 bg-green-500 text-white p-2 rounded-lg text-sm font-bold flex justify-center items-center hover:bg-green-600"><Check size={18}/></button>
            <button onClick={() => setEditingItemId(null)} className="flex-1 bg-neutral-300 text-neutral-700 p-2 rounded-lg text-sm font-bold flex justify-center items-center hover:bg-neutral-400"><X size={18}/></button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="text-lg font-bold text-pizza-dark">{item.name}</p>
            <p className="text-sm text-neutral-800 italic">{activeTab === 'bibite' ? `${item.ml || ''}${item.ml ? 'ml' : ''}` : item.ingredients}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-pizza-red">€{item.price.toFixed(2)}</span>
            <button onClick={() => startEditing(item)} className="text-neutral-400 hover:text-pizza-dark p-2 hover:bg-neutral-200 rounded transition-colors"><Edit3 size={18} /></button>
            <button onClick={() => removeMenuItem(activeTab, item.id)} className="text-neutral-400 hover:text-red-500 p-2 hover:bg-neutral-200 rounded transition-colors"><Trash2 size={18} /></button>
          </div>
        </>
      )}
    </div>
  ))}
</div></div></section>

            <section className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm"><h2 className="text-lg font-semibold mb-4"><Share2 className="text-pizza-red" size={20} /> Condividi Menù</h2><div className="flex items-center gap-2"><input type="text" readOnly value={currentUrl} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 text-xs" /><button onClick={() => { navigator.clipboard.writeText(currentUrl); setSaveStatus(true); setTimeout(() => setSaveStatus(false), 2000); }} className="bg-pizza-dark text-white p-3 rounded-lg"><Copy size={18} /></button></div><button onClick={() => setShowQrModal(true)} className="w-full mt-4 bg-white border border-pizza-dark p-3 rounded-lg flex items-center justify-center gap-2 font-bold text-sm"><QrCode size={18} /> Mostra QR Code</button></section>
          </div>
        ) : (
          /* Anteprima Mobile */
          <div className="h-[calc(100vh-140px)] bg-neutral-200 p-4 sm:p-8 overflow-y-auto w-full">
            <div className="max-w-[480px] mx-auto bg-white rounded-[40px] shadow-2xl border-[4px] sm:border-[8px] border-pizza-dark overflow-hidden relative flex flex-col min-h-[800px]">
              <div className="h-full bg-pizza-cream flex flex-col no-scrollbar">
                <div className="h-72 shrink-0 relative bg-pizza-dark flex items-center justify-center">
                  {data.heroImg ? (
                    <img src={data.heroImg} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-pizza-dark to-pizza-red/30 opacity-60" />
                  )}
                  <div className="relative z-10 text-center px-6">
                    {data.logoImg ? (
                      <img src={data.logoImg} className="w-24 h-24 object-contain mx-auto mb-4 bg-white/10 rounded-full backdrop-blur-sm border border-white/20 p-2" />
                    ) : (
                      <div className="w-20 h-20 bg-pizza-red rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-pizza-gold shadow-lg">
                        <Pizza className="text-white" size={40} />
                      </div>
                    )}
                    <h1 className="playfair text-4xl text-white font-black italic drop-shadow-md">{data.title}</h1>
                    <p className="text-xs uppercase tracking-[0.2em] text-pizza-gold mt-2 font-bold">{data.subtitle || 'Tradizione e Passione'}</p>
                  </div>
                </div>

                <div className="p-6 flex-1">
                  <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {Object.entries(CATEGORIES).map(([key, label]) => (
                      <button key={key} onClick={() => setPreviewTab(key as any)} className={`whitespace-nowrap px-6 py-3 rounded-full text-sm font-black border uppercase tracking-wider shadow-sm transition-all ${previewTab === key ? 'bg-pizza-red text-white border-pizza-red shadow-pizza-red/40 scale-105' : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-6">
                    {data.menu[previewTab].map(item => (
                      <div key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline group gap-2 sm:gap-4">
                        <div className="flex-1">
                          <h4 className="text-xl font-black text-pizza-dark leading-tight">{item.name}</h4>
                          <p className="text-sm text-neutral-500 italic mt-1 font-medium">
                            {previewTab === 'bibite' ? (item.ml ? `${item.ml}ml` : '') : item.ingredients}
                          </p>
                        </div>
                        <div className="hidden sm:block flex-1 h-[1px] border-b-2 border-dotted border-neutral-300 mx-2 mb-1 opacity-50" />
                        <span className="playfair text-xl font-black text-pizza-red italic bg-pizza-red/5 px-3 py-1 rounded-lg self-start sm:self-auto">€{item.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-pizza-dark p-8 md:p-10 text-center text-white shrink-0 mt-8 rounded-t-[2.5rem]">
                  <h3 className="playfair text-3xl mb-6 italic font-bold">Contatti & Social</h3>

                  {data.phone && (
                    <div className="inline-flex items-center gap-3 bg-pizza-red hover:bg-pizza-red/90 transition-colors cursor-pointer text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest shadow-lg shadow-pizza-red/40 mb-8">
                      <Phone size={20} /> Chiama Ora
                    </div>
                  )}

                  <div className="flex justify-center gap-4 flex-wrap">
                    {(['instagram', 'facebook', 'tiktok', 'whatsapp'] as const).map(platform => {
                      const social = data.socials[platform];
                      if (!social || !social.enabled) return null;

                      return (
                        <a href={platform === 'whatsapp' ? `https://wa.me/${social.url.replace(/\D/g, '')}` : social.url} target="_blank" rel="noreferrer" key={platform} className="w-12 h-12 rounded-full bg-white/10 hover:bg-pizza-red border border-white/20 transition-colors flex items-center justify-center text-white shadow-lg">
                           {(() => {
                              const Icon = SOCIAL_ICONS[platform];
                              return Icon ? <Icon size={20} /> : null;
                            })()}
                        </a>
                      );
                    })}
                  </div>

                  <p className="mt-10 text-[10px] text-white/40 font-black tracking-[0.2em] uppercase">
                    &copy; {new Date().getFullYear()} {data.title}
                  </p>
                </div>

              </div>
            </div>
          </div>
        )}
      </main>
      <AnimatePresence>
        {showQrModal && <QrCodeModal url={currentUrl} onClose={() => setShowQrModal(false)} />}
      </AnimatePresence>
    </div>
  );
}
