import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Pizza, Phone, Instagram, Facebook, Smartphone, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, collection, query, where, getDocs, limit } from 'firebase/firestore';

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
  pizze: 'Pizze',
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

export default function PublicMenu() {
  const { slug } = useParams();
  // Estrae la parte finale dello slug come potenziale ID Firestore
  const rawSlugId = slug?.split('-').pop() ?? '';

  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<keyof AppData['menu']>('pizze');

  useEffect(() => {
    if (!rawSlugId) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    // Funzione helper: una volta che conosciamo l'ID reale (corretto in case),
    // ci agganciamo a quel documento con onSnapshot per gli aggiornamenti live.
    const subscribeTo = (realId: string) => {
      const docRef = doc(db, 'pizzerias', realId);
      unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (cancelled) return;
        if (snapshot.exists()) {
          setData(snapshot.data() as AppData);
        }
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `pizzerias/${realId}`);
        if (!cancelled) setLoading(false);
      });
    };

    // Primo tentativo: prova a leggere il documento con l'ID esatto dall'URL.
    // Se Facebook ha rovinato l'URL convertendo in minuscolo, fallirà
    // (snapshot.exists() === false) e useremo il fallback via query.
    const firstAttempt = onSnapshot(doc(db, 'pizzerias', rawSlugId), (snapshot) => {
      if (cancelled) return;
      if (snapshot.exists()) {
        // L'ID era già corretto, restiamo agganciati a questo snapshot.
        setData(snapshot.data() as AppData);
        setLoading(false);
        return;
      }

      // Fallback: cerchiamo per campo `slugLower` (versione minuscola dell'ID
      // salvata dalla Dashboard). In questo modo recuperiamo il documento
      // anche quando l'URL è arrivato tutto in minuscolo da Facebook.
      firstAttempt();
      (async () => {
        try {
          const q = query(
            collection(db, 'pizzerias'),
            where('slugLower', '==', rawSlugId.toLowerCase()),
            limit(1)
          );
          const snap = await getDocs(q);
          if (cancelled) return;
          if (!snap.empty) {
            const realId = snap.docs[0].id;
            subscribeTo(realId);
          } else {
            setLoading(false);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `pizzerias?slugLower=${rawSlugId.toLowerCase()}`);
          if (!cancelled) setLoading(false);
        }
      })();
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `pizzerias/${rawSlugId}`);
      if (!cancelled) setLoading(false);
    });

    // Inizialmente unsubscribe punta al primo tentativo; verrà sostituito
    // se siamo costretti ad agganciarci a un altro documento via fallback.
    unsubscribe = firstAttempt;

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [rawSlugId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pizza-dark">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="text-pizza-red">
          <Pizza size={48} />
        </motion.div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-pizza-cream p-6 text-center">
        <Pizza size={64} className="text-neutral-300 mb-4" />
        <h1 className="text-2xl font-bold text-pizza-dark mb-2">Menù non trovato</h1>
        <p className="text-neutral-500">Il link potrebbe essere scaduto o non corretto.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pizza-dark flex items-center justify-center">
      {/* Background decoration for Desktop */}
      {data.heroImg && (
        <div 
          className="fixed inset-0 opacity-20 blur-2xl scale-110 pointer-events-none hidden lg:block"
          style={{ backgroundImage: `url(${data.heroImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}

      {/* Main Mobile Frame */}
      <div className="w-full max-w-[480px] bg-white min-h-screen lg:h-[90vh] lg:min-h-0 lg:rounded-[40px] lg:shadow-[0_0_100px_rgba(0,0,0,0.5)] lg:border-[8px] lg:border-pizza-dark overflow-hidden relative flex flex-col">
        
        {/* Scrollable Content */}
        <div className="h-full overflow-y-auto bg-pizza-cream flex flex-col no-scrollbar">
          
          {/* Hero Header */}
          <div className="h-72 shrink-0 relative bg-pizza-dark flex items-center justify-center">
            {data.heroImg ? (
              <img src={data.heroImg} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Hero" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-pizza-dark to-pizza-red/30 opacity-60" />
            )}
            
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative z-10 text-center px-6"
            >
              {data.logoImg ? (
                <img src={data.logoImg} className="w-24 h-24 object-contain mx-auto mb-4 bg-white/10 rounded-full backdrop-blur-sm border border-white/20 p-2" alt="Logo" />
              ) : (
                <div className="w-20 h-20 bg-pizza-red rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-pizza-gold shadow-lg">
                  <Pizza className="text-white" size={40} />
                </div>
              )}
              <h1 className="playfair text-4xl text-white font-black italic drop-shadow-md">
                {data.title}
              </h1>
              <p className="text-xs uppercase tracking-[0.2em] text-pizza-gold mt-2 font-bold">
                {data.subtitle || 'Tradizione e Passione'}
              </p>
            </motion.div>
          </div>

          {/* Menu Sections */}
          <div className="p-6 flex-1">
            {/* Category Chips */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {Object.entries(CATEGORIES).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={`whitespace-nowrap px-6 py-3 rounded-full text-sm font-black border uppercase tracking-wider shadow-sm transition-all ${activeTab === key ? 'bg-pizza-red text-white border-pizza-red shadow-pizza-red/40 scale-105' : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Menu Items List */}
            <div className="space-y-6 min-h-[300px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  {data.menu[activeTab].length > 0 ? (
                    data.menu[activeTab].map((item) => (
                       <div key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline group gap-2 sm:gap-4">
                        <div className="flex-1">
                          <h4 className="text-xl font-black text-pizza-dark leading-tight">{item.name}</h4>
                          <p className="text-sm text-neutral-500 italic mt-1 font-medium">
                            {activeTab === 'bibite' ? (item.ml ? `${item.ml}ml` : '') : item.ingredients}
                          </p>
                        </div>
                        <div className="hidden sm:block flex-1 h-[1px] border-b-2 border-dotted border-neutral-300 mx-2 mb-1 opacity-50" />
                        <span className="playfair text-xl font-black text-pizza-red italic bg-pizza-red/5 px-3 py-1 rounded-lg self-start sm:self-auto">€{item.price.toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-neutral-500 italic text-sm">
                      Nessun elemento disponibile in questa categoria
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile Footer */}
          <div className="bg-pizza-dark p-8 md:p-10 text-center text-white shrink-0 mt-8 rounded-t-[2.5rem]">
            <h3 className="playfair text-3xl mb-6 italic font-bold">Contatti & Social</h3>
            
            {data.phone && (
              <a href={`tel:${data.phone}`} className="inline-flex items-center gap-3 bg-pizza-red text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest shadow-lg shadow-pizza-red/40 mb-8 active:scale-95 transition-transform hover:bg-pizza-red/90">
                <Phone size={20} /> Chiama Ora
              </a>
            )}

            <div className="flex justify-center gap-4 flex-wrap">
              {(['instagram', 'facebook', 'tiktok', 'whatsapp'] as const).map(platform => {
                const social = data.socials[platform];
                if (!social || !social.enabled) return null;
                
                const Icon = SOCIAL_ICONS[platform];
                let href = social.url;
                if (!href) return null;
                
                if (platform === 'whatsapp') {
                  href = `https://wa.me/${href.replace(/[^0-9]/g, '')}`;
                } else if (!href.startsWith('http')) {
                  href = `https://${href}`;
                }

                return (
                  <a 
                    key={platform}
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-pizza-red hover:border-white transition-all shadow-lg"
                  >
                    <Icon size={20} />
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
  );
}
