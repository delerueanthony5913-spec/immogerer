import React, { useState, useMemo, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, addDoc } from 'firebase/firestore';
import { 
  Euro, Plus, Trash2, Calendar as CalendarIcon,
  Menu, X, CalendarCheck, CheckCircle, Clock,
  ChevronLeft, ChevronRight, List, Settings, Calculator,
  Filter, Loader2, CalendarRange, Mail, Link, ArrowRight, LocateFixed, TrendingUp, TrendingDown, Key, UploadCloud, Copy, BarChart2
} from 'lucide-react';

// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDJYT5L0A9f1YdRGEcvdk4iyoKgcfrBGWw",
  authDomain: "immogerer-7f706.firebaseapp.com",
  projectId: "immogerer-7f706",
  storageBucket: "immogerer-7f706.firebasestorage.app",
  messagingSenderId: "703084929054",
  appId: "1:703084929054:web:313fae5f706e4dba4fce0f",
  measurementId: "G-QQE1Q309TB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'immogerer-prod-final';

const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1', '#F43F5E', '#06B6D4'];

const TIME_SLOTS = [];
for (let h = 0; h <= 23; h++) {
  const hour = h.toString().padStart(2, '0');
  TIME_SLOTS.push(`${hour}:00`, `${hour}:30`);
}

// --- UTILITAIRES ---
const formatDateFr = (dateString) => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateString;
};

const isSundayOrHoliday = (dateStr) => {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-');
  const date = new Date(y, m - 1, d);
  if (date.getDay() === 0) return true;
  const year = parseInt(y, 10);
  const holidays = [`${year}-01-01`, `${year}-05-01`, `${year}-05-08`, `${year}-07-14`, `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25` ];
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d1 = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d1 - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m1 = Math.floor((a + 11 * h + 22 * l) / 451), n0 = h + l - 7 * m1 + 114, month = Math.floor(n0 / 31), day = (n0 % 31) + 1;
  const paques = new Date(year, month - 1, day);
  const formatLocal = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const lp = new Date(paques); lp.setDate(paques.getDate() + 1);
  const as = new Date(paques); as.setDate(paques.getDate() + 39);
  const lpe = new Date(paques); lpe.setDate(paques.getDate() + 50);
  holidays.push(formatLocal(lp), formatLocal(as), formatLocal(lpe));
  return holidays.includes(dateStr);
};

// --- COMPOSANT GRAPHIQUE ---
const DonutChart = ({ data, title }) => {
  const visibleData = (data || []).filter(d => d && d.value > 0);
  const displayTotal = visibleData.reduce((acc, curr) => acc + curr.value, 0);
  let cumulativePercent = 0;
  if (!displayTotal) return null;
  return (
    <div className="bg-white p-4 md:p-10 rounded-[24px] md:rounded-[48px] border border-gray-50 flex flex-col md:flex-row items-center gap-4 md:gap-10 shadow-xl shadow-slate-200/50 mx-2 md:mx-0">
      <div className="relative w-24 h-24 md:w-48 md:h-48 flex-shrink-0">
        <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90">
          {visibleData.map((slice, i) => {
            const percent = (slice.value / displayTotal) * 100;
            const strokeDasharray = `${percent} ${100 - percent}`;
            const strokeDashoffset = -cumulativePercent;
            cumulativePercent += percent;
            return <circle key={i} r="15.9155" cx="16" cy="16" fill="transparent" stroke={slice.color} strokeWidth="5" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000" />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[7px] md:text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-0.5 md:mb-1">Total Net</span>
          <span className="text-sm md:text-xl font-black text-slate-900">{Math.round(displayTotal).toLocaleString('fr-FR')}€</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-1.5">
        <h3 className="text-[9px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-2 text-center md:text-left">{title}</h3>
        {visibleData.map((slice, i) => (
          <div key={i} className="flex items-center justify-between text-[9px] md:text-[11px] group">
            <div className="flex items-center gap-1.5 md:gap-3">
              <div className="w-1.5 h-1.5 rounded-full shadow-sm" style={{ backgroundColor: slice.color }}></div>
              <span className="font-bold text-slate-600 truncate max-w-[120px]">{slice.label}</span>
            </div>
            <span className="font-black text-slate-900">{Math.round(slice.value).toLocaleString('fr-FR')} €</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- COMPOSANT PRINCIPAL ---
const App = () => {
  const [isUnlocked, setIsUnlocked] = useState(() => localStorage.getItem('cadel_unlocked') === 'true');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reservations');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [availablePlatforms, setAvailablePlatforms] = useState(['Airbnb', 'Booking', 'Abritel', 'En direct']);
  const [availableProviders, setAvailableProviders] = useState(['Justine', 'Marc']);
  const [providerEmails, setProviderEmails] = useState({});
  const [availableServiceTypes, setAvailableServiceTypes] = useState(['Ménage', 'Entrée/Sortie']);
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterProp, setFilterProp] = useState('all');
  const [filterPlat, setFilterPlat] = useState('all');
  const [filterProv, setFilterProv] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResId, setEditingResId] = useState(null);
  const [formData, setFormData] = useState({ propertyId: '', name: '', phone: '', startDate: '', endDate: '', paymentDate: '', platform: 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [], comment: '', acompte1Amount: '', acompte1Date: '', acompte2Amount: '', acompte2Date: '', soldeAmount: '', soldeDate: '' });
  const [quickPayConfig, setQuickPayConfig] = useState(null); 
  const [hasScrolledToNext, setHasScrolledToNext] = useState(false);
  const scrollContainerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const TABS_ORDER = ['reservations', 'agenda', 'statistiques', 'finances', 'settings'];
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => { if (u) { setUser(u); setLoading(false); } else signInAnonymously(auth); });
    const unsubProps = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), (snap) => { setProperties(snap.docs.map(d => ({ ...d.data(), id: d.id }))); });
    const unsubTenants = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), (snap) => { setTenants(snap.docs.map(d => ({ ...d.data(), id: d.id }))); });
    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), (snap) => { if (snap.exists()) { const d = snap.data(); if (d.platforms) setAvailablePlatforms(d.platforms); if (d.providers) setAvailableProviders(d.providers); if (d.services) setAvailableServiceTypes(d.services); if (d.providerEmails) setProviderEmails(d.providerEmails); } });
    return () => { unsubAuth(); unsubProps(); unsubTenants(); unsubSettings(); };
  }, []);

  const yearsAvailable = useMemo(() => {
    const years = new Set([new Date().getFullYear().toString()]);
    tenants.forEach(t => { if (t.startDate) years.add(t.startDate.split('-')[0]); });
    return Array.from(years).sort((a, b) => b - a);
  }, [tenants]);

  const checkDateFilter = (dateStr) => {
    if (!dateStr) return false;
    const [y, mo] = dateStr.split('-');
    if (filterYear !== 'all' && y !== filterYear) return false;
    if (filterMonth !== 'all' && parseInt(mo)-1 !== parseInt(filterMonth)) return false;
    return true;
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current || isScrollingRef.current) return;
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const width = scrollContainerRef.current.clientWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (TABS_ORDER[newIndex] && TABS_ORDER[newIndex] !== activeTab) setActiveTab(TABS_ORDER[newIndex]);
  };

  const changeTab = (tabId) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
    const index = TABS_ORDER.indexOf(tabId);
    if (scrollContainerRef.current) {
      isScrollingRef.current = true;
      scrollContainerRef.current.scrollTo({ left: index * scrollContainerRef.current.clientWidth, behavior: 'smooth' });
      setTimeout(() => { isScrollingRef.current = false; }, 600);
    }
  };

  const agendaDays = useMemo(() => {
    const y = filterYear === 'all' ? new Date().getFullYear() : parseInt(filterYear);
    const m = filterMonth === 'all' ? new Date().getMonth() : parseInt(filterMonth);
    const firstDay = new Date(y, m, 1), lastDay = new Date(y, m + 1, 0), days = [];
    let offset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < offset; i++) days.push({ empty: true });
    for (let i = 1; i <= lastDay.getDate(); i++) days.push({ day: i, dateStr: `${y}-${(m+1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}` });
    return days;
  }, [filterYear, filterMonth]);

  const baseTenants = useMemo(() => tenants.filter(t => (filterProp === 'all' || t.propertyId === filterProp) && (filterPlat === 'all' || t.platform === filterPlat)), [tenants, filterProp, filterPlat]);
  const reservationsList = useMemo(() => baseTenants.filter(t => {
      const dateRef = t.startDate ? new Date(t.startDate) : new Date();
      return (filterYear === 'all' || dateRef.getFullYear() === parseInt(filterYear)) && (filterMonth === 'all' || dateRef.getMonth() === parseInt(filterMonth)) && (filterProv === 'all' || (t.resExpenses && t.resExpenses.some(e => e.person === filterProv)));
  }).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || "")), [baseTenants, filterYear, filterMonth, filterProv]);

  const groupedReservationsList = useMemo(() => {
      const groups = []; let curM = '';
      reservationsList.forEach(t => {
          if (t.startDate) {
              const label = new Date(t.startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
              if (label !== curM) { groups.push({ isSeparator: true, label, id: label }); curM = label; }
          }
          groups.push(t);
      });
      return groups;
  }, [reservationsList]);

  const monthlyRecapData = useMemo(() => {
    const stats = {}; const init = (m) => { if(!stats[m]) stats[m] = { totalBank: 0, urssafGross: 0, charges: 0, taxes: 0 }; };
    baseTenants.forEach(t => {
      if (t.paymentDate && checkDateFilter(t.paymentDate)) { const m = t.paymentDate.substring(0,7); init(m); stats[m].totalBank += (parseFloat(t.netAmount)||0); if (t.isUrssaf !== false) { stats[m].urssafGross += (parseFloat(t.grossAmount)||0); stats[m].taxes += (parseFloat(t.grossAmount)||0)*0.077; } }
      (t.resExpenses || []).forEach(exp => { if (exp.paymentDate && checkDateFilter(exp.paymentDate)) { const m = exp.paymentDate.substring(0,7); init(m); stats[m].charges += (parseFloat(exp.amount)||0); } });
    });
    return Object.entries(stats).sort((a, b) => b[0].localeCompare(a[0]));
  }, [baseTenants, filterYear, filterMonth]);

  const getTenantProfitForStats = (t) => {
    let p = 0;
    if (t.paymentDate && checkDateFilter(t.paymentDate)) { p += (parseFloat(t.netAmount)||0); if(t.isUrssaf!==false) p -= (parseFloat(t.grossAmount)||0)*0.077; }
    (t.resExpenses || []).forEach(e => { if (e.paymentDate && checkDateFilter(e.paymentDate)) p -= (parseFloat(e.amount)||0); });
    return p;
  };

  const scrollToCurrentRes = (withFlash = false) => {
    if (reservationsList.length === 0) return; let targetRes = reservationsList.find(t => t.startDate >= todayStr || (t.endDate && t.endDate >= todayStr)) || reservationsList[reservationsList.length - 1];
    if (targetRes) { document.querySelectorAll(`[data-res-id="${targetRes.id}"]`).forEach(el => { const container = el.closest('.overflow-y-auto'); if (container) { container.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' }); if (withFlash) { const bg = el.style.backgroundColor; el.style.backgroundColor = '#FEF9C3'; setTimeout(() => el.style.backgroundColor = bg, 2500); } } }); }
  };
  useEffect(() => { if (activeTab === 'reservations' && !hasScrolledToNext && reservationsList.length > 0) { setTimeout(() => { scrollToCurrentRes(false); setHasScrolledToNext(true); }, 500); } }, [activeTab, reservationsList]);

  const handlePinSubmit = (e) => { e.preventDefault(); if (pinInput === 'Cadel2026') { localStorage.setItem('cadel_unlocked', 'true'); setIsUnlocked(true); } else { setPinError(true); setPinInput(''); } };
  const getRowColors = (id) => { const name = properties.find(p=>p.id===id)?.name?.toLowerCase() || ''; return name.includes('cocon') ? { bg: 'bg-emerald-50' } : name.includes('signes') ? { bg: 'bg-blue-50' } : name.includes('villa') ? { bg: 'bg-red-50' } : { bg: 'bg-white' }; };
  const getStatusProps = (t) => t.paymentDate ? { label: 'Payé', color: 'bg-emerald-100 text-emerald-700' } : { label: 'Attente', color: 'bg-orange-100 text-orange-700' };

  const handleQuickPayToggle = async (e, tenant, type, expId = null) => {
    e.stopPropagation(); if (type === 'global' && tenant.platform === 'En direct') { setEditingResId(tenant.id); setFormData(tenant); setIsModalOpen(true); return; }
    let isPaid = type === 'global' ? !!tenant.paymentDate : !!(tenant.resExpenses || []).find(x => x.id === expId)?.paymentDate;
    if (isPaid) { if (window.confirm("Annuler paiement ?")) { if (type === 'global') { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', tenant.id), { paymentDate: '' }, { merge: true }); } else { const nE = tenant.resExpenses.map(exp => exp.id === expId ? { ...exp, paymentDate: '' } : exp); await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', tenant.id), { resExpenses: nE }, { merge: true }); } } }
    else { setQuickPayConfig({ tenant, type, expId, date: new Date().toISOString().split('T')[0] }); }
  };

  const submitQuickPay = async () => {
    if (!quickPayConfig) return;
    if (quickPayConfig.type === 'global') { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', quickPayConfig.tenant.id), { paymentDate: quickPayConfig.date }, { merge: true }); } 
    else { const nE = quickPayConfig.tenant.resExpenses.map(exp => exp.id === quickPayConfig.expId ? { ...exp, paymentDate: quickPayConfig.date } : exp); await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', quickPayConfig.tenant.id), { resExpenses: nE }, { merge: true }); }
    setQuickPayConfig(null);
  };

  const generateICalLInk = (id) => `${window.location.origin}${window.location.pathname}?ical=${id}`;

  if (!isUnlocked) return <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans text-center overflow-hidden relative"><div className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col items-center animate-in zoom-in-95 relative z-10"><div className="bg-slate-50 p-4 rounded-3xl mb-6 shadow-inner border border-slate-100"><Key size={48} className="text-blue-600" /></div><h1 className="font-black text-2xl uppercase tracking-tighter text-slate-900 mb-1">Cadel Manager</h1><p className="text-[10px] uppercase tracking-widest text-slate-400 mb-8 font-bold">Espace Sécurisé</p><form onSubmit={handlePinSubmit} className="w-full flex flex-col gap-4"><div><input type="password" value={pinInput} onChange={(e) => { setPinInput(e.target.value); setPinError(false); }} placeholder="Mot de passe" className={`w-full p-4 bg-slate-50 border rounded-2xl font-black text-center text-lg outline-none transition-all ${pinError ? 'border-rose-500 text-rose-500' : 'border-slate-200'}`} autoFocus /></div><button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase text-sm shadow-xl shadow-blue-200">Déverrouiller</button></form></div></div>;
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-black uppercase text-xs"><Loader2 className="animate-spin text-blue-600 mr-2" /> CADEL MANAGER...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900 overflow-x-hidden">
      <style>{`.hide-scroll::-webkit-scrollbar { display: none; } .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; } .snap-always { scroll-snap-stop: always; }`}</style>
      <aside className={`fixed md:sticky top-0 left-0 z-50 w-72 h-[100dvh] bg-white border-r transform md:translate-x-0 transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 border-b flex flex-col items-center relative"><img src="/icon.svg" className="w-24 h-24 rounded-3xl shadow-xl mb-2 object-contain" /><button onClick={() => { localStorage.removeItem('cadel_unlocked'); setIsUnlocked(false); }} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-slate-900 transition-colors"><Lock size={16} /></button></div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {[{ id: 'reservations', label: 'Réservations', icon: <List size={18}/> }, { id: 'agenda', label: 'Agenda', icon: <CalendarRange size={18}/> }, { id: 'statistiques', label: 'Statistiques', icon: <BarChart2 size={18}/> }, { id: 'finances', label: 'Finances', icon: <Calculator size={18}/> }, { id: 'settings', label: 'Paramètres', icon: <Settings size={18}/> }].map(item => (
            <button key={item.id} onClick={() => changeTab(item.id)} className={`w-full text-left px-5 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-2xl' : 'text-slate-400 hover:bg-slate-50'}`}>{item.icon} {item.label}</button>
          ))}
        </nav>
      </aside>
      <div className="md:hidden flex justify-between p-5 bg-white border-b sticky top-0 z-40 shadow-sm"><div className="flex items-center gap-3"><img src="/icon.svg" className="w-10 h-10 rounded-[12px] object-contain" /><h1 className="font-black text-sm uppercase">CADEL MANAGER</h1></div><button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">{isMobileMenuOpen ? <X /> : <Menu />}</button></div>
      <main className="flex-1 w-full min-w-0 min-h-screen relative flex flex-col overflow-x-hidden">
        {quickPayConfig && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"><div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col gap-6 animate-in zoom-in-95 text-center"><h3 className="font-black text-xl uppercase">Valider le paiement</h3><input type="date" value={quickPayConfig.date} onChange={e => setQuickPayConfig({...quickPayConfig, date: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-center text-lg outline-none" /><div className="flex gap-3"><button onClick={() => setQuickPayConfig(null)} className="flex-1 p-4 rounded-2xl font-black uppercase text-[10px] text-slate-400 bg-slate-50">Annuler</button><button onClick={submitQuickPay} className="flex-1 p-4 rounded-2xl font-black uppercase text-[10px] text-white bg-emerald-500 shadow-xl shadow-emerald-200">Encaisser</button></div></div></div>
        )}
        <div className="sticky top-0 z-30 bg-[#F8FAFC]/95 backdrop-blur-md pt-2 pb-4 px-2 md:px-0"><div className="flex flex-wrap items-center gap-2 bg-white/80 p-3 rounded-[28px] border border-white shadow-lg mx-auto max-w-7xl"><div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100"><Filter size={12} className="text-slate-400" /><select value={filterYear} onChange={e => {setFilterYear(e.target.value); setHasScrolledToNext(false);}} className="text-[10px] font-black uppercase bg-transparent outline-none cursor-pointer"><option value="all">Toutes Années</option>{yearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}</select></div><div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100"><select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none cursor-pointer"><option value="all">Mois (Tous)</option>{['Janv','Févr','Mars','Avril','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'].map((m,i)=><option key={i} value={i}>{m}</option>)}</select></div><div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100"><select value={filterProp} onChange={e => setFilterProp(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none max-w-[100px] md:max-w-[130px] cursor-pointer"><option value="all">Logements</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div></div>
        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory hide-scroll">
          
          {/* 1. RÉSERVATIONS */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border" style={{ scrollSnapStop: 'always' }}><div className="max-w-7xl mx-auto pb-32"><div className="flex justify-between items-center mx-2 md:mx-0 mb-6"><h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Réservations</h2><div className="flex items-center gap-2 md:gap-4"><button onClick={() => scrollToCurrentRes(true)} className="p-3 md:px-4 md:py-3 bg-white text-blue-600 rounded-full md:rounded-[20px] shadow-lg border border-slate-100 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"><LocateFixed size={18} /><span className="hidden md:inline font-black text-[10px] uppercase">Aujourd'hui</span></button><button onClick={() => { setEditingResId(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-6 py-3 md:px-8 md:py-4 rounded-[20px] md:rounded-[24px] font-black text-[11px] shadow-xl hover:bg-blue-700 transition-all">+ Nouvelle</button></div></div><div className="md:hidden max-h-[70vh] overflow-y-auto custom-scrollbar p-1 rounded-[20px] border border-slate-100 bg-slate-50/50 shadow-inner mx-2 relative"><div className="grid grid-cols-1 gap-2.5">{(groupedReservationsList || []).map(item => { if (item.isSeparator) return <div key={item.id} className="flex items-center justify-center mt-2 mb-0.5"><span className="bg-slate-800 text-white px-4 py-1.5 rounded-[10px] text-[8px] font-black uppercase tracking-[0.2em] shadow-sm">{item.label}</span></div>; const t = item; const c = getRowColors(t.propertyId); return <div key={t.id} data-res-id={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className={`${c.bg} p-3 rounded-[16px] shadow-sm border border-slate-50 cursor-pointer transition-colors`}><div className="flex justify-between items-start mb-1.5"><div><h3 className="text-sm font-black uppercase leading-tight">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}</h3><div className="flex items-center gap-1.5 mt-1 leading-tight"><span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{t.platform}</span><span className="text-[11px] font-black text-slate-700">{t.name}</span></div></div><div className="flex flex-col items-end"><span onClick={(e) => handleQuickPayToggle(e, t, 'global')} className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase cursor-pointer inline-block ${getStatusProps(t).color}`}>{getStatusProps(t).label}</span>{t.paymentDate && <span className="text-[7px] text-slate-400 mt-1 font-bold">{formatDateFr(t.paymentDate)}</span>}</div></div><div className="bg-white/60 p-2 rounded-[12px] flex justify-between font-black text-[9px] mb-1.5 items-center"><span>{formatDateFr(t.startDate)}</span><ArrowRight size={10} className="text-slate-300"/><span>{formatDateFr(t.endDate)}</span></div>{t.comment && <div className="text-[9px] italic text-slate-600 mb-1.5 px-1 leading-tight whitespace-pre-wrap">📝 {t.comment}</div>}<div className="text-right font-black text-sm">{(parseFloat(t.netAmount) || 0).toFixed(2)}€</div></div>; })}</div></div><div className="hidden md:block bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100"><div className="max-h-[70vh] overflow-y-auto custom-scrollbar relative"><table className="w-full text-left text-xs"><thead className="bg-slate-50 font-black uppercase border-b text-slate-400 sticky top-0 z-20 shadow-sm"><tr><th className="p-4 w-[15%]">Logement</th><th className="p-4 w-[15%]">Client</th><th className="p-4 w-[12%] text-center">Dates</th><th className="p-4 w-[25%]">Notes</th><th className="p-4 w-[18%]">Prestations</th><th className="p-4 text-right">Net</th><th className="p-4 text-center">État</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold">{(groupedReservationsList || []).map(item => { if (item.isSeparator) return <tr key={item.id} className="bg-slate-100/50"><td colSpan="7" className="p-3 text-center"><span className="bg-slate-800 text-white px-5 py-2 rounded-[14px] text-[10px] font-black uppercase tracking-[0.2em] shadow-md inline-block">{item.label}</span></td></tr>; const t = item; const c = getRowColors(t.propertyId); return <tr key={t.id} data-res-id={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className={`${c.bg} cursor-pointer hover:bg-slate-50`}><td className="p-4 uppercase"><div className="font-black">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}</div><div className="text-blue-600 text-xs font-black mt-0.5">{t.platform}</div></td><td className="p-4"><div className="text-sm font-black">{t.name}</div></td><td className="p-4 text-center text-slate-500 whitespace-nowrap">{formatDateFr(t.startDate)} <ArrowRight size={10} className="inline" /> {formatDateFr(t.endDate)}</td><td className="p-4 text-[11px] text-slate-600 font-medium">{t.comment ? <div className="bg-slate-50/50 p-2 rounded-xl italic">📝 {t.comment}</div> : ''}</td><td className="p-4"><div className="space-y-1.5">{(t.resExpenses || []).map((exp, idx) => (<div key={idx} className="flex items-center justify-between text-[10px] bg-white/50 p-1.5 rounded-lg border border-slate-100/50"><span className="uppercase font-black text-slate-500 leading-none">{exp.type} ({exp.person})</span><div className="text-right"><div className="flex items-center justify-end gap-1.5"><span className={`font-black ${exp.paymentDate ? 'text-emerald-600' : 'text-orange-500'}`}>{exp.amount}€</span>{exp.paymentDate ? <CheckCircle size={10} /> : <Clock size={10} />}</div></div></div>))}</div></td><td className="p-4 text-right font-black">{(parseFloat(t.netAmount) || 0).toFixed(2)}€</td><td className="p-4 text-center"><span onClick={(e) => handleQuickPayToggle(e, t, 'global')} className={`px-4 py-2 rounded-full text-[9px] uppercase cursor-pointer inline-block ${getStatusProps(t).color}`}>{getStatusProps(t).label}</span></td></tr>; })}</tbody></table></div></div></div></div>

          {/* 2. AGENDA */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border" style={{ scrollSnapStop: 'always' }}><div className="max-w-7xl mx-auto pb-32"><h2 className="text-2xl md:text-3xl font-black uppercase mb-6 mx-2">Agenda</h2><div className="bg-white p-4 md:p-6 rounded-[32px] md:rounded-[40px] shadow-2xl overflow-x-auto mx-2 md:mx-0"><div className="min-w-[320px] md:min-w-[700px]"><div className="grid grid-cols-7 text-center font-black text-slate-300 text-[8px] md:text-[10px] uppercase mb-4">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=><div key={d}>{d}</div>)}</div><div className="grid grid-cols-7 gap-1 md:gap-2">{(agendaDays || []).map((item,idx)=>{ if(item.empty) return <div key={idx} className="h-16 md:h-32 bg-slate-50/30 rounded-xl md:rounded-2xl"></div>; const dayRes = (reservationsList || []).filter(r=>item.dateStr>=r.startDate && item.dateStr<=r.endDate); return (<div key={item.dateStr} className={`h-16 md:h-32 border rounded-xl md:rounded-2xl p-1 md:p-2 flex flex-col ${item.dateStr===todayStr?'border-blue-500 bg-blue-50/10':'border-slate-100'}`}><span className="text-[8px] md:text-[10px] font-black text-slate-300">{item.day}</span><div className="flex-1 space-y-0.5 overflow-y-auto no-scrollbar">{dayRes.map(r=>(<div key={r.id} onClick={()=> {setEditingResId(r.id); setFormData(r); setIsModalOpen(true);}} className="text-[6px] md:text-[8px] font-black text-white p-0.5 rounded truncate" style={{backgroundColor: CHART_COLORS[(properties || []).findIndex(p=>p.id===r.propertyId)%CHART_COLORS.length]}}>{r.name?.split(' ')[0]}</div>))}</div></div>);})}</div></div></div></div></div>

          {/* 3. STATISTIQUES */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border" style={{ scrollSnapStop: 'always' }}><div className="max-w-7xl mx-auto pb-32 space-y-10 px-2"><h2 className="text-3xl md:text-4xl font-black uppercase text-slate-900 tracking-tighter">Statistiques</h2><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div className="bg-white p-3 md:p-6 rounded-[20px] md:rounded-[32px] shadow-xl border border-slate-50 text-center"><p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CA Brut ({statsCalculations.year})</p><p className="text-xl md:text-3xl font-black text-indigo-600">{Math.round(statsCalculations.currentYearGross).toLocaleString('fr-FR')}€</p></div><div className="bg-white p-3 md:p-6 rounded-[20px] md:rounded-[32px] shadow-xl border border-slate-50 text-center"><p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CA à venir</p><p className="text-xl md:text-3xl font-black text-blue-600">{Math.round(statsCalculations.upcomingGross).toLocaleString('fr-FR')}€</p></div><div className="bg-white p-3 md:p-6 rounded-[20px] md:rounded-[32px] shadow-xl border border-slate-50 text-center"><p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Coût Prestations</p><p className="text-xl md:text-3xl font-black text-rose-500">-{Math.round(statsCalculations.currentYearExp).toLocaleString('fr-FR')}€</p></div><div className="bg-white p-3 md:p-6 rounded-[20px] md:rounded-[32px] shadow-xl border border-slate-50 text-center"><p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CA / Nuit</p><p className="text-xl md:text-3xl font-black text-emerald-600">{statsCalculations.revPerNight}€</p></div></div><ComparisonChart data={baseTenants} yearsAvailable={yearsAvailable} /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><DonutChart title={`Net Reçu (${filterYear})`} data={(properties || []).map((p,idx)=>({label:p.name,value:(baseTenants || []).reduce((acc,t) => t.propertyId===p.id ? acc + getTenantProfitForStats(t) : acc, 0),color:CHART_COLORS[idx%CHART_COLORS.length]}))} /></div></div></div>

          {/* 4. FINANCES */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border" style={{ scrollSnapStop: 'always' }}><div className="max-w-7xl mx-auto pb-32 space-y-10 px-2"><h2 className="text-3xl font-black uppercase">Comptabilité</h2><div className="bg-white rounded-[24px] shadow-2xl overflow-hidden border border-slate-100"><div className="p-3 md:p-8 bg-slate-900 text-white font-black text-[10px] uppercase">Bilan Global</div><div className="max-h-[60vh] overflow-y-auto overflow-x-auto custom-scrollbar relative"><table className="w-full text-left min-w-[500px]"><thead className="bg-slate-50 uppercase text-slate-400 border-b text-[10px]"><tr><th className="p-4">Période</th><th className="p-4 text-right">Brut URSSAF</th><th className="p-4 text-right text-indigo-600">Virement</th><th className="p-4 text-right font-black">Profit</th></tr></thead><tbody className="divide-y font-bold">{(monthlyRecapData || []).map(([m, d]) => (<tr key={m} className="text-xs group hover:bg-slate-50/50"><td className="p-4 capitalize">{m}</td><td className="p-4 text-right text-slate-500">{d.urssafGross.toLocaleString('fr-FR')}€</td><td className="p-4 text-right text-indigo-600 font-black">{d.totalBank.toLocaleString('fr-FR')}€</td><td className={`p-4 text-right font-black ${d.totalBank - d.taxes - d.charges >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{(d.totalBank - d.taxes - d.charges).toLocaleString('fr-FR')}€</td></tr>))}</tbody></table></div></div></div></div>

          {/* 5. PARAMÈTRES */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border" style={{ scrollSnapStop: 'always' }}><div className="max-w-7xl mx-auto pb-32 space-y-10 px-2"><h2 className="text-3xl font-black uppercase">Paramètres</h2><div className="bg-white p-8 rounded-[40px] border-2 border-dashed shadow-xl flex flex-col items-center justify-center text-center mx-2 md:mx-0"><UploadCloud size={40} className="text-blue-600 mb-4"/><h3 className="text-xl font-black uppercase">Fichiers Calendriers (iCal)</h3><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full text-left">{(properties || []).map(p=>(<div key={p.id} className="p-3 bg-blue-50 rounded-xl flex flex-col gap-2"><div className="flex justify-between items-center text-[10px] font-black uppercase"><span>{p.name}</span><button onClick={async()=>{if(window.confirm('Supprimer ?'))await deleteDoc(doc(db,'artifacts',appId,'public', 'data', 'properties', p.id))}} className="text-slate-300 hover:text-rose-500"><Trash2 size={14}/></button></div><button onClick={()=>{navigator.clipboard.writeText(generateICalLInk(p.id)); alert('Lien copié !');}} className="w-full bg-white text-blue-600 text-[9px] font-black py-2 rounded-lg flex items-center justify-center gap-2 border border-blue-200"><Link size={12}/> Copier iCal</button></div>))}</div></div></div></div>
        </div>
      </main>
      {isModalOpen && formData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"><div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div><div className="bg-white rounded-[40px] md:rounded-[60px] shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col border border-slate-100 overflow-hidden relative z-10"><div className="p-6 md:p-10 border-b flex justify-between items-center bg-white sticky top-0 z-10"><div className="flex items-center gap-4 text-blue-600 font-black uppercase leading-none"><CalendarCheck size={28} /> Détails</div><div className="flex items-center gap-2"><a href={getGoogleCalendarUrl(formData, (properties || []).find(p => p.id === formData.propertyId))} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition-all shadow-sm"><CalendarIcon size={20} /></a><button type="button" onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all duration-300"><X size={20} /></button></div></div><form onSubmit={saveRes} className="p-6 md:p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar text-xs"><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="space-y-1 uppercase font-black text-slate-400 text-[10px]">Logement<select value={formData.propertyId || ''} onChange={e => setFormData({ ...formData, propertyId: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900">{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="space-y-1 uppercase font-black text-slate-400 text-[10px]">Voyageur<input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="space-y-1 uppercase font-black text-slate-400 text-[10px]">Contact<input value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="space-y-1 uppercase font-black text-slate-400 text-[10px]">Début<input type="date" value={formData.startDate || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="space-y-1 uppercase font-black text-slate-400 text-[10px]">Fin<input type="date" value={formData.endDate || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="md:col-span-3 space-y-1 uppercase font-black text-slate-400 text-[10px]">Notes<textarea value={formData.comment || ''} onChange={e => setFormData({ ...formData, comment: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-bold text-slate-700 min-h-[100px]" /></div></div><div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-8 rounded-[48px] border border-blue-50 space-y-6"><div className="flex flex-col md:flex-row md:items-center justify-between font-black uppercase text-blue-900 border-b border-blue-100 pb-4 gap-4 text-[11px]">Plateforme<select value={formData.platform || ''} onChange={e => setFormData({ ...formData, platform: e.target.value })} className="bg-white border rounded-xl px-4 py-2 text-blue-600 outline-none">{availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}</select><label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border shadow-sm"><input type="checkbox" checked={formData.isUrssaf !== false} onChange={e => setFormData({ ...formData, isUrssaf: e.target.checked })} className="w-4 h-4" /><span>URSSAF</span></label></div>{formData.platform === 'En direct' ? (<div className="space-y-4"><div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4"><div className="w-full md:w-1/2"><label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Montant Global</label><input type="number" step="0.01" value={formData.grossAmount || ''} onChange={e => setFormData({ ...formData, grossAmount: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-lg" /></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm"><label className="text-[10px] font-black text-slate-400 mb-2 block">Acompte 1</label><input type="number" step="0.01" value={formData.acompte1Amount || ''} onChange={e => setFormData({ ...formData, acompte1Amount: e.target.value })} className="w-full p-3 border border-slate-100 rounded-xl mb-2 font-black" /><input type="date" value={formData.acompte1Date || ''} onChange={e => setFormData({ ...formData, acompte1Date: e.target.value })} className="w-full p-3 border border-slate-100 rounded-xl" /></div><div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm"><label className="text-[10px] font-black text-slate-400 mb-2 block">Acompte 2</label><input type="number" step="0.01" value={formData.acompte2Amount || ''} onChange={e => setFormData({ ...formData, acompte2Amount: e.target.value })} className="w-full p-3 border border-slate-100 rounded-xl mb-2 font-black" /><input type="date" value={formData.acompte2Date || ''} onChange={e => setFormData({ ...formData, acompte2Date: e.target.value })} className="w-full p-3 border border-slate-100 rounded-xl" /></div><div className="bg-emerald-50/50 p-4 rounded-3xl border border-emerald-100 shadow-sm"><label className="text-[10px] font-black text-emerald-600 mb-2 block">Solde</label><input type="number" step="0.01" value={formData.soldeAmount || ''} onChange={e => setFormData({ ...formData, soldeAmount: e.target.value })} className="w-full p-3 border border-emerald-200 rounded-xl mb-2 font-black" /><input type="date" value={formData.soldeDate || ''} onChange={e => setFormData({ ...formData, soldeDate: e.target.value })} className="w-full p-3 border border-emerald-200 rounded-xl" /></div></div></div>) : (<div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div><label className="text-[10px] font-black text-slate-400 uppercase">Total Appli</label><input type="number" step="0.01" value={formData.displayedAmount || ''} onChange={e => setFormData({ ...formData, displayedAmount: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div><div><label className="text-[10px] font-black text-rose-400 uppercase">Taxe Séjour</label><input type="number" step="0.01" value={formData.cityTax || ''} onChange={e => setFormData({ ...formData, cityTax: e.target.value })} className="w-full p-4 border border-rose-100 rounded-2xl font-black text-rose-500" /></div><div><label className="text-[10px] font-black text-slate-400 uppercase">Commission</label><input type="number" step="0.01" value={formData.platformFees || ''} onChange={e => setFormData({ ...formData, platformFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div><div><label className="text-[10px] font-black text-slate-400 uppercase">Banque</label><input type="number" step="0.01" value={formData.bankFees || ''} onChange={e => setFormData({ ...formData, bankFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div></div>)}</div><div className="space-y-4"><div className="flex justify-between font-black text-slate-400 text-[10px] uppercase">Prestations<button type="button" onClick={() => setFormData({ ...formData, resExpenses: [...(formData.resExpenses || []), { id: Date.now().toString(), person: availableProviders[0], type: availableServiceTypes[0], amount: 0, paymentDate: '', hoursEntry: '', rateEntry: '', hoursExit: '', rateExit: '', dateEntry: formData.startDate, dateExit: formData.endDate, timeEntry: '10:00', timeExit: '10:00', providerNote: '', sendEmail: true }] })} className="bg-slate-900 text-white px-4 py-2 rounded-xl">+ Ajouter</button></div>{(formData.resExpenses || []).map(exp => { const isDias = exp.person?.toLowerCase().includes('dias'); return isDias ? (<div key={exp.id} className="flex flex-col gap-3 bg-blue-50/50 p-4 rounded-[28px] border border-blue-100 relative"><div className="flex gap-1.5 items-center relative z-10"><select value={exp.person} onChange={e => { const val = e.target.value; setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => { if (x.id === exp.id) { if (val.toLowerCase().includes('dias')) { const rE = isSundayOrHoliday(x.dateEntry) ? 25 : 15; const rX = isSundayOrHoliday(x.dateExit) ? 25 : 15; return { ...x, person: val, rateEntry: rE, rateExit: rX, amount: (parseFloat(x.hoursEntry||0)*rE) + (parseFloat(x.hoursExit||0)*rX) }; } return { ...x, person: val }; } return x; }) }); }} className="flex-1 min-w-0 p-2 border border-blue-200 rounded-xl font-black text-[9px] uppercase outline-none">{availableProviders.map(p => <option key={p} value={p}>{p}</option>)}</select><select value={exp.type} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 min-w-0 p-2 border border-blue-200 rounded-xl font-black text-[9px] uppercase outline-none">{availableServiceTypes.map(p => <option key={p} value={p}>{p}</option>)}</select><button type="button" onClick={() => setFormData({ ...formData, resExpenses: formData.resExpenses.filter(x => x.id !== exp.id) })} className="flex-shrink-0 text-rose-500 font-black px-1"><Trash2 size={18}/></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10"><div className="bg-white p-3 rounded-[20px] border border-blue-100 space-y-2"><div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-blue-600">Entrée</span>{isSundayOrHoliday(exp.dateEntry) && <span className="text-[8px] font-black text-white bg-rose-500 px-2 rounded-full">Férié</span>}</div><input type="date" value={exp.dateEntry} onChange={e => updateDiasField(exp.id, 'dateEntry', e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-[10px]" /><div className="flex gap-2"><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">Heure</label><select value={exp.timeEntry} onChange={e => updateDiasField(exp.id, 'timeEntry', e.target.value)} className="w-full p-1.5 border rounded-lg text-[10px] font-black">{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">H.</label><input type="number" step="0.5" value={exp.hoursEntry} onChange={e => updateDiasField(exp.id, 'hoursEntry', e.target.value)} className="w-full p-1.5 border rounded-lg text-[10px] font-black text-center" /></div><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">Tarif</label><input type="number" step="0.5" value={exp.rateEntry} onChange={e => updateDiasField(exp.id, 'rateEntry', e.target.value)} className={`w-full p-1.5 border rounded-lg text-[10px] font-black text-center ${isSundayOrHoliday(exp.dateEntry) ? 'bg-rose-50 text-rose-700' : ''}`} /></div></div></div><div className="bg-white p-3 rounded-[20px] border border-blue-100 space-y-2"><div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-blue-600">Sortie</span>{isSundayOrHoliday(exp.dateExit) && <span className="text-[8px] font-black text-white bg-rose-500 px-2 rounded-full">Férié</span>}</div><input type="date" value={exp.dateExit} onChange={e => updateDiasField(exp.id, 'dateExit', e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-[10px]" /><div className="flex gap-2"><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">Heure</label><select value={exp.timeExit} onChange={e => updateDiasField(exp.id, 'timeExit', e.target.value)} className="w-full p-1.5 border rounded-lg text-[10px] font-black">{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">H.</label><input type="number" step="0.5" value={exp.hoursExit} onChange={e => updateDiasField(exp.id, 'hoursExit', e.target.value)} className="w-full p-1.5 border rounded-lg text-[10px] font-black text-center" /></div><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">Tarif</label><input type="number" step="0.5" value={exp.rateExit} onChange={e => updateDiasField(exp.id, 'rateExit', e.target.value)} className={`w-full p-1.5 border rounded-lg text-[10px] font-black text-center ${isSundayOrHoliday(exp.dateExit) ? 'bg-rose-50 text-rose-700' : ''}`} /></div></div></div></div><textarea value={exp.providerNote} onChange={e => updateDiasField(exp.id, 'providerNote', e.target.value)} className="w-full p-3 border border-blue-200 rounded-[16px] text-xs font-medium outline-none" placeholder="Note pour le prestataire..." /><div className="flex gap-2 relative z-10"><a href={getProviderCalendarUrl(exp, properties.find(p=>p.id===formData.propertyId), 'ENTREE')} target="_blank" className="flex-1 bg-white border border-blue-200 text-blue-600 p-2.5 rounded-xl font-black text-[9px] uppercase text-center shadow-sm flex items-center justify-center gap-1"><CalendarIcon size={12}/> RDV Entrée</a><a href={getProviderCalendarUrl(exp, properties.find(p=>p.id===formData.propertyId), 'SORTIE')} target="_blank" className="flex-1 bg-white border border-blue-200 text-blue-600 p-2.5 rounded-xl font-black text-[9px] uppercase text-center shadow-sm flex items-center justify-center gap-1"><CalendarIcon size={12}/> RDV Sortie</a></div><div className="flex justify-between items-center bg-blue-600 text-white p-4 rounded-[18px]"><span className="text-[10px] font-black uppercase">Total Bloqué</span><span className="font-black text-xl">{(parseFloat(exp.amount)||0).toFixed(2)}€</span></div></div>) : (<div key={exp.id} className="flex flex-col gap-2 bg-slate-50 p-4 rounded-[28px] border border-slate-100"><div className="flex gap-1.5 md:gap-2 items-center"><select value={exp.person} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, person: e.target.value } : x) })} className="flex-1 min-w-0 p-2 border rounded-xl font-black text-[9px] uppercase">{availableProviders.map(p => <option key={p} value={p}>{p}</option>)}</select><select value={exp.type} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 min-w-0 p-2 border rounded-xl font-black text-[9px] uppercase">{availableServiceTypes.map(p => <option key={p} value={p}>{p}</option>)}</select><input type="number" value={exp.amount} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, amount: e.target.value } : x) })} className="w-14 min-w-0 p-2 border rounded-xl font-black text-right text-[9px]" /><button type="button" onClick={() => setFormData({ ...formData, resExpenses: formData.resExpenses.filter(x => x.id !== exp.id) })} className="flex-shrink-0 text-rose-500 font-black px-1"><Trash2 size={18}/></button></div>{providerEmails[exp.person] && <label className="flex items-center gap-2 cursor-pointer pl-1 mt-1"><input type="checkbox" checked={exp.sendEmail !== false} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, sendEmail: e.target.checked } : x) })} className="w-3.5 h-3.5" /><span className="text-[8px] font-black text-slate-500 uppercase flex items-center gap-1"><Mail size={12}/> Inviter ({providerEmails[exp.person]})</span></label>}</div>); })}</div>{formData.platform !== 'En direct' && <div className={`p-6 rounded-[32px] border-2 flex flex-col md:flex-row items-center justify-between shadow-xl gap-4 ${formData.paymentDate ? 'bg-emerald-50/50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}><div><h4 className="text-[10px] font-black uppercase">Paiement Reçu</h4><p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Définit le mois URSSAF</p></div><input type="date" value={formData.paymentDate} onChange={e => setFormData({ ...formData, paymentDate: e.target.value })} className="w-full md:w-auto p-3 border border-slate-200 rounded-[15px] font-black bg-white" /></div>}<div className="bg-slate-900 p-8 rounded-[48px] text-white flex flex-col md:flex-row justify-between items-center gap-6"><div><p className="text-[10px] font-black uppercase text-slate-400 mb-2">Net Estimé</p><p className="text-4xl font-black text-blue-400">{(formData.platform === 'En direct' ? parseFloat(formData.grossAmount||0) : ((parseFloat(formData.displayedAmount||0)-parseFloat(formData.cityTax||0))-(parseFloat(formData.platformFees||0)+parseFloat(formData.bankFees||0))) - (formData.resExpenses||[]).reduce((s,e)=>s+parseFloat(e.amount||0),0)).toFixed(2)}€</p></div><div className="flex items-center gap-4 w-full md:w-auto">{editingResId && <button type="button" onClick={() => deleteRes(editingResId)} className="p-4 text-rose-500 bg-rose-50 rounded-[24px]"><Trash2 size={24}/></button>}<button type="submit" className="w-full md:w-auto bg-blue-600 px-12 py-5 rounded-[24px] font-black uppercase shadow-xl hover:-translate-y-1 transition-all">Enregistrer</button></div></div></form></div></div>
      )}
    </div>
  );
};

export default App;
