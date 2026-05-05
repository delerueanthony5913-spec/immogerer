import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReservationList from './ReservationList';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, doc, onSnapshot, deleteDoc, addDoc, setDoc } from 'firebase/firestore';
import { 
  Euro, Plus, Trash2, Calendar as CalendarIcon, Menu, X, CalendarCheck, CheckCircle, Clock,
  ChevronLeft, ChevronRight, List, Settings, Calculator, Filter, Loader2, CalendarRange, Mail, Link, ArrowRight, LocateFixed, TrendingUp, TrendingDown, Key, UploadCloud, Copy, BarChart2, Search
} from 'lucide-react';

// --- IMPORTS DES FICHIERS CLOISONNÉS ---
import { auth, db, appId } from './firebaseConfig';
import { TIME_SLOTS, formatDateFr, isSundayOrHoliday, CHART_COLORS } from './dateUtils';
import DonutChart from './DonutChart';
import ComparisonChart from './ComparisonChart';

const App = () => {
  // 1. ÉTATS DE SÉCURITÉ ET CHARGEMENT
  const [isUnlocked, setIsUnlocked] = useState(() => localStorage.getItem('cadel_unlocked') === 'true');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 2. ÉTATS DES DONNÉES
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [availablePlatforms, setAvailablePlatforms] = useState(['Airbnb', 'Booking', 'Abritel', 'En direct']);
  const [availableProviders, setAvailableProviders] = useState(['Justine', 'Marc']);
  const [providerEmails, setProviderEmails] = useState({});
  const [availableServiceTypes, setAvailableServiceTypes] = useState(['Ménage', 'Entrée/Sortie']);

  // 3. ÉTATS DE NAVIGATION ET FILTRES
  const [activeTab, setActiveTab] = useState('reservations');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterProp, setFilterProp] = useState('all');
  const [filterPlat, setFilterPlat] = useState('all');
  const [filterProv, setFilterProv] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // 4. ÉTATS DES MODALES ET FORMULAIRES
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResId, setEditingResId] = useState(null);
  const [formData, setFormData] = useState({ propertyId: '', name: '', phone: '', startDate: '', endDate: '', paymentDate: '', platform: 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [], comment: '', acompte1Amount: '', acompte1Date: '', acompte2Amount: '', acompte2Date: '', soldeAmount: '', soldeDate: '' });
  const [quickPayConfig, setQuickPayConfig] = useState(null); 
  const [statsDetailConfig, setStatsDetailConfig] = useState(null);

  // 5. REFS POUR LE CARROUSEL
  const scrollContainerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const TABS_ORDER = ['reservations', 'agenda', 'statistiques', 'finances', 'settings'];
  const todayStr = new Date().toISOString().split('T')[0];

  // --- SYNCHRONISATION FIREBASE ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => { if (u) { setUser(u); setLoading(false); } else signInAnonymously(auth); });
    const unsubProps = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), (snap) => setProperties(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
    const unsubTenants = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), (snap) => setTenants(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.platforms) setAvailablePlatforms(d.platforms);
        if (d.providers) setAvailableProviders(d.providers);
        if (d.services) setAvailableServiceTypes(d.services);
        if (d.providerEmails) setProviderEmails(d.providerEmails);
      }
    });
    // Fonctions pour l'affichage de la liste
  const getRowColors = (propertyId) => {
    const prop = (properties || []).find(p => p.id === propertyId);
    if (!prop || !prop.name) return { bg: 'bg-white' };
    const name = prop.name.toLowerCase();
    if (name.includes('cocon')) return { bg: 'bg-emerald-50' };
    if (name.includes('signes')) return { bg: 'bg-blue-50' };
    if (name.includes('villa')) return { bg: 'bg-red-50' };
    return { bg: 'bg-white' };
  };

  const getStatusProps = (t) => {
    return t.paymentDate ? { label: 'Payé', color: 'bg-emerald-100 text-emerald-700' } : { label: 'Attente', color: 'bg-orange-100 text-orange-700' };
  };

  const handleEdit = (t) => {
    setEditingResId(t.id);
    setFormData(t);
    setIsModalOpen(true);
  };

  const groupedReservations = useMemo(() => {
    const groups = [];
    let curM = '';
    reservationsList.forEach(t => {
      const label = new Date(t.startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (label !== curM) {
        groups.push({ isSeparator: true, label: label.toUpperCase(), id: label });
        curM = label;
      }
      groups.push(t);
    });
    return groups;
  }, [reservationsList]);
    return () => { unsubAuth(); unsubProps(); unsubTenants(); unsubSettings(); };
  }, []);

  // --- CALCULS MÉMOÏSÉS ---
  const yearsAvailable = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    tenants.forEach(t => { if (t.startDate) years.add(parseInt(t.startDate.split('-')[0], 10)); });
    return Array.from(years).sort((a, b) => b - a).map(String);
  }, [tenants]);

  const checkDateFilter = (dateStr) => {
    if (!dateStr) return false;
    const [y, mo] = dateStr.split('-');
    if (filterYear !== 'all' && y !== filterYear) return false;
    if (filterMonth !== 'all' && parseInt(mo)-1 !== parseInt(filterMonth)) return false;
    return true;
  };

  const baseTenants = useMemo(() => tenants.filter(t => (filterProp === 'all' || t.propertyId === filterProp) && (filterPlat === 'all' || t.platform === filterPlat)), [tenants, filterProp, filterPlat]);
  
  const reservationsList = useMemo(() => {
    return baseTenants.filter(t => {
      const dateRef = t.startDate ? new Date(t.startDate) : new Date();
      return (filterYear === 'all' || dateRef.getFullYear() === parseInt(filterYear)) &&
             (filterMonth === 'all' || dateRef.getMonth() === parseInt(filterMonth)) &&
             (filterProv === 'all' || (t.resExpenses && t.resExpenses.some(e => e.person === filterProv)));
    }).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  }, [baseTenants, filterYear, filterMonth, filterProv]);

  // --- LOGIQUE DE NAVIGATION ---
  const handleScroll = () => {
    if (!scrollContainerRef.current || isScrollingRef.current) return;
    const idx = Math.round(scrollContainerRef.current.scrollLeft / scrollContainerRef.current.clientWidth);
    if (TABS_ORDER[idx] && TABS_ORDER[idx] !== activeTab) setActiveTab(TABS_ORDER[idx]);
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

  // --- LOGIQUE DE SÉCURITÉ ---
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === 'Cadel2026') { localStorage.setItem('cadel_unlocked', 'true'); setIsUnlocked(true); }
    else { setPinError(true); setPinInput(''); }
  };

  if (!isUnlocked) return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col items-center animate-in zoom-in-95">
        <Key size={48} className="text-blue-600 mb-6" />
        <h1 className="font-black text-2xl uppercase mb-8">Cadel Manager</h1>
        <form onSubmit={handlePinSubmit} className="w-full flex flex-col gap-4">
          <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="Mot de passe" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-center text-lg outline-none" autoFocus />
          <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase shadow-xl">Déverrouiller</button>
        </form>
      </div>
    </div>
  );

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-black uppercase text-xs"><Loader2 className="animate-spin text-blue-600 mr-2" /> CHARGEMENT...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900 overflow-x-hidden">
      <style>{`.hide-scroll::-webkit-scrollbar { display: none; } .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; } .snap-always { scroll-snap-stop: always; }`}</style>
      
      {/* BARRE LATÉRALE */}
      <aside className={`fixed md:sticky top-0 left-0 z-50 w-72 h-[100dvh] bg-white border-r transform md:translate-x-0 transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 border-b flex flex-col items-center">
          <img src="/icon.svg" className="w-24 h-24 rounded-3xl shadow-xl mb-2 object-contain" />
        </div>
        <nav className="p-6 space-y-2">
          {[{ id: 'reservations', label: 'Réservations', icon: <List size={18}/> }, { id: 'agenda', label: 'Agenda', icon: <CalendarRange size={18}/> }, { id: 'statistiques', label: 'Statistiques', icon: <BarChart2 size={18}/> }, { id: 'finances', label: 'Finances', icon: <Calculator size={18}/> }, { id: 'settings', label: 'Paramètres', icon: <Settings size={18}/> }].map(item => (
            <button key={item.id} onClick={() => changeTab(item.id)} className={`w-full text-left px-5 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-2xl' : 'text-slate-400 hover:bg-slate-50'}`}>{item.icon} {item.label}</button>
          ))}
        </nav>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden flex justify-between p-5 bg-white border-b sticky top-0 z-40">
        <h1 className="font-black text-sm uppercase">CADEL MANAGER</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">{isMobileMenuOpen ? <X /> : <Menu />}</button>
      </div>

      <main className="flex-1 w-full min-w-0 min-h-screen relative flex flex-col">
        {/* FILTRES GLOBAUX */}
        <div className="sticky top-0 z-30 bg-[#F8FAFC]/95 backdrop-blur-md pt-2 pb-4 px-2 md:px-0">
          <div className="flex flex-wrap items-center gap-2 bg-white/80 p-3 rounded-[28px] border border-white shadow-lg mx-auto max-w-7xl">
            <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
              <Filter size={12} className="text-slate-400" />
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none">
                <option value="all">Toutes Années</option>{yearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
              <select value={filterProp} onChange={e => setFilterProp(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none max-w-[130px]">
                <option value="all">Logements</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* CARROUSEL DES ONGLETS */}
<div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory hide-scroll">
          
          {/* 1. RÉSERVATIONS */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-4 md:px-12 py-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black uppercase">Réservations</h2>
                <button onClick={() => { setEditingResId(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase">+ Nouvelle</button>
              </div>
              <ReservationList 
                groupedList={groupedReservations} 
                properties={properties} 
                getRowColors={getRowColors} 
                getStatusProps={getStatusProps} 
                onEdit={handleEdit}
                onQuickPay={() => {}} // On l'activera plus tard
              />
            </div>
          </div>

          {/* 2. AGENDA (En attente de son fichier) */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-4 md:px-12 py-6">
            <div className="max-w-7xl mx-auto text-center py-20 bg-white rounded-[40px]">
               <CalendarRange size={48} className="mx-auto text-slate-200 mb-4" />
               <h2 className="text-xl font-black uppercase text-slate-400">Espace Agenda</h2>
            </div>
          </div>

          {/* 3. STATISTIQUES */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-4 md:px-12 py-6">
             <div className="max-w-7xl mx-auto space-y-8">
                <h2 className="text-2xl font-black uppercase">Statistiques</h2>
                <ComparisonChart data={baseTenants} properties={properties} platforms={availablePlatforms} yearsAvailable={yearsAvailable} />
                <DonutChart title="Net / Logement" data={properties.map((p,idx)=>({label:p.name, value: 100, color:CHART_COLORS[idx%CHART_COLORS.length]}))} />
             </div>
          </div>

          {/* 4. FINANCES (En attente) */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-4 md:px-12 py-6">
            <div className="max-w-7xl mx-auto text-center py-20 bg-white rounded-[40px]">
               <Calculator size={48} className="mx-auto text-slate-200 mb-4" />
               <h2 className="text-xl font-black uppercase text-slate-400">Espace Finances</h2>
            </div>
          </div>

          {/* 5. PARAMÈTRES (En attente) */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-4 md:px-12 py-6">
            <div className="max-w-7xl mx-auto text-center py-20 bg-white rounded-[40px]">
               <Settings size={48} className="mx-auto text-slate-200 mb-4" />
               <h2 className="text-xl font-black uppercase text-slate-400">Espace Paramètres</h2>
          </div> {/* Ferme le carrousel (scrollContainerRef) */}
      </main> {/* Ferme le tag main */}
    </div> {/* Ferme le div global (min-h-screen) */}
  );
};

export default App;
