import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Pizza, Phone, Instagram, Facebook, Smartphone, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  ingredients?: string;
  ml?: number;
  hidden?: boolean;
}

interface CategoryDef {
  key: string;
  label: string;
  hidden?: boolean;
  isDrink?: boolean;
}

interface ThemeColors {
  primary: string;
  dark: string;
  cream: string;
  gold: string;
}

interface AppData {
  title: string;
  subtitle: string;
  phone: string;
  heroImg: string;
  logoImg: string;
  slug?: string;
  categories?: CategoryDef[];
  menu: Record<string, MenuItem[]>;
  theme?: ThemeColors;
  socials: {
    whatsapp: { enabled: boolean; url: string };
    facebook: { enabled: boolean; url: string };
    instagram: { enabled: boolean; url: string };
    tiktok: { enabled: boolean; url: string };
  };
}

// Categorie di fallback per dati legacy (senza array `categories`)
const LEGACY_CATEGORIES: CategoryDef[] = [
  { key: 'pizze', label: 'Pizze' },
  { key: 'bianche', label: 'Pizze Bianche' },
  { key: 'speciali', label: 'Speciali' },
  { key: 'pucce', label: 'Pucce' },
  { key: 'bibite', label: 'Bibite', isDrink: true },
];

const DEFAULT_THEME: ThemeColors = {
  primary: '#C1121F',
  dark: '#1A0A00',
  cream: '#FFF8F0',
  gold: '#E8A020',
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

  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState(false);

  // Risolve l'ID della pizzeria dallo slug:
  // 1. Se lo slug ha forma "...-<uid>" (vecchio formato), prendiamo l'ultimo segmento
  // 2. Altrimenti consultiamo /slugs/{slug} per ottenere l'ownerId
  useEffect(() => {
    let cancelled = false;
    setResolveError(false);

    async function resolve() {
      if (!slug) {
        setResolveError(true);
        setLoading(false);
        return;
      }

      // 1) Prova come slug custom in /slugs/{slug}
      try {
        const slugDoc = await getDoc(doc(db, 'slugs', slug));
        if (!cancelled && slugDoc.exists()) {
          const ownerId = slugDoc.data()?.ownerId;
          if (ownerId) {
            setResolvedId(ownerId);
            return;
          }
        }
      } catch (e) {
        // ignoriamo: provo il fallback legacy
      }

      // 2) Fallback legacy: l'ID è l'ultimo segmento dopo l'ultimo "-"
      const legacyId = slug.split('-').pop();
      if (legacyId) {
        if (!cancelled) setResolvedId(legacyId);
        return;
      }

      if (!cancelled) {
        setResolveError(true);
        setLoading(false);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!resolvedId) return;

    const docRef = doc(db, 'pizzerias', resolvedId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setData(snapshot.data() as AppData);
      } else {
        setData(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `pizzerias/${resolvedId}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [resolvedId]);

  // Categorie effettive (con fallback legacy)
  const categories: CategoryDef[] = data?.categories && Array.isArray(data.categories) && data.categories.length
    ? data.categories
    : LEGACY_CATEGORIES;
  const visibleCategories = categories.filter(c => !c.hidden);

  // Imposta tab iniziale appena arrivano i dati
  useEffect(() => {
    if (visibleCategories.length && !visibleCategories.find(c => c.key === activeTab)) {
      setActiveTab(visibleCategories[0].key);
    }
  }, [visibleCategories.map(c => c.key).join('|')]);

  const theme: ThemeColors = data?.theme ? { ...DEFAULT_THEME, ...data.theme } : DEFAULT_THEME;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.dark }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ color: theme.primary }}>
          <Pizza size={48} />
        </motion.div>
      </div>
    );
  }

  if (!data || resolveError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-pizza-cream p-6 text-center">
        <Pizza size={64} className="text-neutral-300 mb-4" />
        <h1 className="text-2xl font-bold text-pizza-dark mb-2">Menù non trovato</h1>
        <p className="text-neutral-500">Il link potrebbe essere scaduto o non corretto.</p>
      </div>
    );
  }

  const activeCategory = categories.find(c => c.key === activeTab);
  const isDrink = activeCategory?.isDrink === true;
  const items = (data.menu?.[activeTab] || []).filter(it => !it.hidden);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: theme.dark }}>
      {/* Background decoration for Desktop */}
      {data.heroImg && (
        <div
          className="fixed inset-0 opacity-20 blur-2xl scale-110 pointer-events-none hidden lg:block"
          style={{ backgroundImage: `url(${data.heroImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}

      {/* Main Mobile Frame */}
      <div
        className="w-full max-w-[480px] min-h-screen lg:h-[90vh] lg:min-h-0 lg:rounded-[40px] lg:shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative flex flex-col"
        style={{ background: '#fff', borderColor: theme.dark, borderStyle: 'solid' }}
      >

        {/* Scrollable Content */}
        <div className="h-full overflow-y-auto flex flex-col no-scrollbar" style={{ background: theme.cream }}>

          {/* Hero Header */}
          <div className="h-72 shrink-0 relative flex items-center justify-center" style={{ background: theme.dark }}>
            {data.heroImg ? (
              <img src={data.heroImg} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Hero" />
            ) : (
              <div className="absolute inset-0 opacity-60" style={{ background: `linear-gradient(135deg, ${theme.dark}, ${theme.primary}55)` }} />
            )}

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative z-10 text-center px-6"
            >
              {data.logoImg ? (
                <img src={data.logoImg} className="w-24 h-24 object-contain mx-auto mb-4 bg-white/10 rounded-full backdrop-blur-sm border border-white/20 p-2" alt="Logo" />
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 shadow-lg" style={{ background: theme.primary, borderColor: theme.gold }}>
                  <Pizza className="text-white" size={40} />
                </div>
              )}
              <h1 className="playfair text-4xl text-white font-black italic drop-shadow-md">
                {data.title}
              </h1>
              <p className="text-xs uppercase tracking-[0.2em] mt-2 font-bold" style={{ color: theme.gold }}>
                {data.subtitle || 'Tradizione e Passione'}
              </p>
            </motion.div>
          </div>

          {/* Menu Sections */}
          <div className="p-6 flex-1">
            {/* Category Chips */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {visibleCategories.map(cat => {
                const isActive = activeTab === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveTab(cat.key)}
                    className="whitespace-nowrap px-6 py-3 rounded-full text-sm font-black border uppercase tracking-wider shadow-sm transition-all"
                    style={isActive
                      ? { background: theme.primary, color: '#fff', borderColor: theme.primary, transform: 'scale(1.05)' }
                      : { background: '#fff', color: '#737373', borderColor: '#e5e5e5' }
                    }
                  >
                    {cat.label}
                  </button>
                );
              })}
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
                  {items.length > 0 ? (
                    items.map((item) => (
                      <div key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline group gap-2 sm:gap-4">
                        <div className="flex-1">
                          <h4 className="text-xl font-black leading-tight" style={{ color: theme.dark }}>{item.name}</h4>
                          <p className="text-sm text-neutral-500 italic mt-1 font-medium">
                            {isDrink ? (item.ml ? `${item.ml}ml` : '') : item.ingredients}
                          </p>
                        </div>
                        <div className="hidden sm:block flex-1 h-[1px] border-b-2 border-dotted border-neutral-300 mx-2 mb-1 opacity-50" />
                        <span className="playfair text-xl font-black italic px-3 py-1 rounded-lg self-start sm:self-auto" style={{ color: theme.primary, background: `${theme.primary}0d` }}>€{item.price.toFixed(2)}</span>
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
          <div className="p-8 md:p-10 text-center text-white shrink-0 mt-8 rounded-t-[2.5rem]" style={{ background: theme.dark }}>
            <h3 className="playfair text-3xl mb-6 italic font-bold">Contatti & Social</h3>

            {data.phone && (
              <a href={`tel:${data.phone}`} className="inline-flex items-center gap-3 text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest shadow-lg mb-8 active:scale-95 transition-transform" style={{ background: theme.primary, boxShadow: `0 10px 30px ${theme.primary}66` }}>
                <Phone size={20} /> Chiama Ora
              </a>
            )}

            <div className="flex justify-center gap-4 flex-wrap">
              {(['instagram', 'facebook', 'tiktok', 'whatsapp'] as const).map(platform => {
                const social = data.socials?.[platform];
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
                    className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all shadow-lg"
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
