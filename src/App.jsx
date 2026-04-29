import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, addDoc, query } from 'firebase/firestore';
import { 
  Home, Euro, LayoutDashboard, Plus, Trash2, MapPin, Calendar as CalendarIcon,
  Menu, X, CalendarCheck, CheckCircle, Clock, PieChart as PieChartIcon,
  ChevronLeft, ChevronRight, BarChart3, List, Wallet, Settings, Calculator,
  UserCheck, PlusCircle, TrendingUp, Info, ChevronUp, ChevronDown, Filter, Loader2,
  Building2, Globe
} from 'lucide-react';

// --- CONFIGURATION FIREBASE EXACTE ---
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

// Palette de couleurs pour les graphiques
const CHART_COLORS = [
  '#3B82F6', // Blue 500
  '#8B5CF6', // Violet 500
  '#EC4899', // Pink 500
  '#F59E0B', // Amber 500
  '#10B981', // Emerald 500
  '#6366F1', // Indigo 500
  '#F43F5E', // Rose 500
  '#06B6D4', // Cyan 500
];

// --- COMPOSANT GRAPHIQUE ---
const DonutChart = ({ data, title }) => {
  let cumulativePercent = 0;
  const visibleData = data.filter(d => d.value > 0);
  const displayTotal = visibleData.reduce((acc, curr) => acc + curr.value, 0);

  if (!displayTotal) {
    return (
      <div className="bg-white p-6 rounded-[40px] border border-gray-100 flex flex-col items-center justify-center min-h-[300px] shadow-sm">
        <PieChartIcon size={24} className="text-gray-200 mb-2" />
        <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest text-center">{title}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-10 rounded-[48px] border border-gray-50 flex flex-col md:flex-row items-center gap-10 animate-in fade-in slide-in-from-bottom-2 shadow-xl shadow-slate-200/50">
      <div className="relative w-48 h-48 flex-shrink-0">
        <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90">
          {visibleData.map((slice, i) => {
            const percent = (slice.value / displayTotal) * 100;
            const strokeDasharray = `${percent} ${100 - percent}`;
            const strokeDashoffset = -cumulativePercent;
            cumulativePercent += percent;
            return (
              <circle 
                key={i} 
                r="15.9155" 
                cx="16" 
                cy="16" 
                fill="transparent" 
                stroke={slice.color} 
                strokeWidth="5" 
                strokeDasharray={strokeDasharray} 
                strokeDashoffset={strokeDashoffset} 
                className="transition-all duration-1000 ease-out" 
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Total Net</span>
          <span className="text-xl font-black text-slate-900">{Math.round(displayTotal).toLocaleString('fr-FR')}€</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{title}</h3>
        <div className="space-y-2">
          {visibleData.map((slice, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] group">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: slice.color }}></div>
                <span className="font-bold text-slate-600 group-hover:text-slate-900 transition-colors truncate max-w-[140px]">{slice.label}</span>
              </div>
              <span className="font-black text-slate-900 tabular-nums">{Math.round(slice.value).toLocaleString('fr-FR')} €</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- COMPOSANT PRINCIPAL ---
const App = () => {
  // --- HELPERS ---
  const formatMonthYear = (m) => {
    if (!m) return "";
    const [year, month] = m.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    let result = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  const getGoogleCalendarUrl = (res, prop) => {
    if (!res.startDate || !res.endDate) return '#';
    const text = encodeURIComponent(`Reservation: ${res.name} - ${prop?.name || ''}`);
    const details = encodeURIComponent(`Client: ${res.name}\nLogement: ${prop?.name || ''}\nPlateforme: ${res.platform}`);
    const dates = `${res.startDate.replace(/-/g, '')}/${res.endDate.replace(/-/g, '')}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
  };

  // --- ETATS ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('planning');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [availablePlatforms, setAvailablePlatforms] = useState(['Airbnb', 'Booking', 'Abritel', 'En direct', 'Autre']);
  const [availableProviders, setAvailableProviders] = useState(['Justine', 'Marc', 'Stéphanie']);
  const [availableServiceTypes, setAvailableServiceTypes] = useState(['Ménage', 'Entrée/Sortie', 'Piscine', 'Divers']);

  // --- FILTRES UNIFIÉS ---
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterProp, setFilterProp] = useState('all');
  const [filterPlat, setFilterPlat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResId, setEditingResId] = useState(null);
  const [formData, setFormData] = useState({ 
    propertyId: '', name: '', startDate: '', endDate: '', paymentDate: '', 
    platform: 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', 
    bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [] 
  });

  const [inputPlat, setInputPlat] = useState('');
  const [inputProv, setInputProv] = useState('');
  const [inputSvc, setInputSvc] = useState('');
  const [inputProp, setInputProp] = useState({ name: '', address: '' });

  // --- AUTHENTIFICATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch(e) {
        console.error("Erreur Auth", e);
        setUser({uid: 'local-test-user'});
        setLoading(false);
      }
    };
    initAuth();
    
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // --- LECTURE CLOUD ---
  useEffect(() => {
    if (!user) return;

    const unsubProps = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), (snap) => {
      setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.warn(error));

    const unsubTenants = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), (snap) => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.warn(error));

    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.platforms && d.platforms.length > 0) setAvailablePlatforms(d.platforms);
        if (d.providers && d.providers.length > 0) setAvailableProviders(d.providers);
        if (d.services && d.services.length > 0) setAvailableServiceTypes(d.services);
      }
    }, (error) => console.warn(error));

    return () => { unsubProps(); unsubTenants(); unsubSettings(); };
  }, [user]);

  // --- ACTIONS ---
  const updateSettings = async (n) => {
    if(!user || user.uid === 'local-test-user') return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), n, { merge: true });
  };

  const saveRes = async (e) => {
    e.preventDefault();
    if (!formData.propertyId || !user) return;
    const isC = formData.platform === 'Booking' || formData.platform === 'Abritel';
    const g = isC ? (parseFloat(formData.displayedAmount) || 0) - (parseFloat(formData.cityTax) || 0) : parseFloat(formData.grossAmount) || 0;
    const n = isC ? g - (parseFloat(formData.platformFees) || 0) - (parseFloat(formData.bankFees) || 0) : g - (parseFloat(formData.platformFees) || 0);
    const d = { ...formData, grossAmount: g, netAmount: n, resExpenses: formData.resExpenses.map(r => ({ ...r, amount: parseFloat(r.amount) || 0 })) };
    
    if (editingResId) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', editingResId), d);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), d);
    }
    setIsModalOpen(false);
  };

  const deleteRes = async (id) => {
    if (!user || user.uid === 'local-test-user') return;
    if(window.confirm("Supprimer cette réservation ?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', id));
      setIsModalOpen(false);
    }
  };

  // --- LOGIQUE DE FILTRAGE UNIFIÉE ---
  const filteredData = useMemo(() => {
    return tenants.filter(t => {
      const dateRef = t.paymentDate ? new Date(t.paymentDate) : new Date(t.startDate);
      const matchYear = filterYear === 'all' || dateRef.getFullYear() === parseInt(filterYear);
      const matchMonth = filterMonth === 'all' || dateRef.getMonth() === parseInt(filterMonth);
      const matchProp = filterProp === 'all' || t.propertyId === filterProp;
      const matchPlat = filterPlat === 'all' || t.platform === filterPlat;
      return matchYear && matchMonth && matchProp && matchPlat;
    });
  }, [tenants, filterYear, filterMonth, filterProp, filterPlat]);

  // --- CALCULS LOGIQUES ---
  const financials = useMemo(() => {
    const paid = filteredData.filter(t => !!t.paymentDate);
    const upcoming = filteredData.filter(t => !t.paymentDate);
    
    const netB = paid.reduce((a, t) => a + (t.netAmount || 0), 0);
    const taxes = paid.filter(t => t.isUrssaf).reduce((a, t) => a + (t.grossAmount || 0), 0) * 0.077;
    const exp = paid.reduce((a, t) => a + (t.resExpenses?.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) || 0), 0);
    
    const netUpcoming = upcoming.reduce((a, t) => a + (t.netAmount || 0), 0);

    return { netB, taxes, exp, profit: netB - exp - taxes, netUpcoming };
  }, [filteredData]);

  const monthlyRecapData = useMemo(() => {
    const stats = {};
    const initMonth = (m) => { if (!stats[m]) stats[m] = { totalBank: 0, urssafGross: 0, directNet: 0, charges: 0, taxes: 0 }; };
    filteredData.filter(t => !!t.paymentDate).forEach(t => {
      const m = t.paymentDate.substring(0, 7);
      initMonth(m);
      stats[m].totalBank += t.netAmount;
      if (t.isUrssaf) {
        stats[m].urssafGross += t.grossAmount;
        stats[m].taxes += t.grossAmount * 0.077;
      } else {
        stats[m].directNet += t.netAmount;
      }
      stats[m].charges += (t.resExpenses?.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0) || 0);
    });
    return Object.entries(stats).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredData]);

  const providerRecap = useMemo(() => {
    const recap = {};
    filteredData.filter(t => !!t.paymentDate).forEach(t => {
      const month = t.paymentDate.substring(0, 7);
      t.resExpenses?.forEach(exp => {
        const key = `${month}_${exp.person}`;
        if (!recap[key]) recap[key] = { month, person: exp.person, total: 0 };
        recap[key].total += (parseFloat(exp.amount) || 0);
      });
    });
    return Object.values(recap).sort((a,b) => b.month.localeCompare(a.month));
  }, [filteredData]);

  const planningList = useMemo(() => {
    return filteredData.filter(t => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'paid') return !!t.paymentDate;
      if (filterStatus === 'pending') return !t.paymentDate;
      return true;
    }).sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [filteredData, filterStatus]);

  const yearsAvailable = useMemo(() => {
    const years = tenants.map(t => new Date(t.startDate).getFullYear());
    const payYears = tenants.filter(t => t.paymentDate).map(t => new Date(t.paymentDate).getFullYear());
    return [...new Set([...years, ...payYears])].sort((a, b) => b - a);
  }, [tenants]);

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50 flex-col gap-4">
      <Loader2 className="animate-spin text-blue-600" size={48} />
      <p className="text-blue-600 font-bold uppercase tracking-widest text-[10px]">Chargement CADEL MANAGER...</p>
    </div>
  );

  const curChargesModale = formData.resExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const isCplxForm = formData.platform === 'Booking' || formData.platform === 'Abritel';
  let gModale = 0, nModale = 0;
  if (isCplxForm) {
    gModale = (parseFloat(formData.displayedAmount) || 0) - (parseFloat(formData.cityTax) || 0);
    nModale = gModale - (parseFloat(formData.platformFees) || 0) - (parseFloat(formData.bankFees) || 0);
  } else {
    gModale = parseFloat(formData.grossAmount) || 0;
    nModale = gModale - (parseFloat(formData.platformFees) || 0);
  }

  // --- FILTRES RÉUTILISABLES ---
  const RenderFilters = () => (
    <div className="flex flex-wrap items-center gap-3 bg-white/70 backdrop-blur-md p-3 rounded-[28px] border border-white shadow-xl shadow-slate-200/50 mb-8 animate-in slide-in-from-top-4">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <Filter size={12} className="text-slate-400" />
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="text-[10px] font-black uppercase bg-transparent cursor-pointer outline-none text-slate-600">
          <option value="all">Années</option>
          {yearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="text-[10px] font-black uppercase bg-transparent cursor-pointer outline-none text-slate-600">
          <option value="all">Mois</option>
          {['Janv','Févr','Mars','Avril','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'].map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterProp} onChange={e => setFilterProp(e.target.value)} className="text-[10px] font-black uppercase bg-transparent cursor-pointer outline-none text-slate-600 max-w-[130px]">
          <option value="all">Logements</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterPlat} onChange={e => setFilterPlat(e.target.value)} className="text-[10px] font-black uppercase bg-transparent cursor-pointer outline-none text-slate-600">
          <option value="all">Plateformes</option>
          {availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {activeTab === 'planning' && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50/50 rounded-2xl border border-blue-100 ml-auto">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-[10px] font-black uppercase bg-transparent text-blue-600 cursor-pointer outline-none">
            <option value="all">Tous les statuts</option>
            <option value="paid">Payé</option>
            <option value="pending">En attente</option>
          </select>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`fixed md:sticky top-0 left-0 z-40 w-72 h-full md:h-screen bg-white border-r border-slate-100 flex flex-col transform md:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 border-b border-slate-50 flex flex-col items-center">
          <div className="relative group mb-4">
             <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
             <div className="relative bg-gradient-to-tr from-blue-600 to-indigo-600 p-4 rounded-2xl text-white shadow-xl shadow-blue-200">
                <Building2 size={28} />
             </div>
          </div>
          <h1 className="font-black uppercase tracking-tighter text-2xl text-slate-900 leading-none">CADEL</h1>
          <h2 className="font-black uppercase tracking-[0.3em] text-[10px] text-blue-600 mt-1.5">MANAGER</h2>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {[
            { id: 'planning', label: 'Planning', icon: <CalendarIcon size={18}/> },
            { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={18}/> },
            { id: 'finances', label: 'Finances', icon: <Calculator size={18}/> },
            { id: 'settings', label: 'Paramètres', icon: <Settings size={18}/> }
          ].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full text-left px-5 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-2xl shadow-slate-300 translate-x-2' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
              <span className={`${activeTab === item.id ? 'text-blue-400' : 'text-slate-300'}`}>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-slate-50">
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl flex items-center justify-between text-[10px] font-black uppercase shadow-inner">
            <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500"></div> Cloud Actif</div>
            <Info size={14} className="opacity-40" />
          </div>
        </div>
      </aside>

      <div className="md:hidden flex items-center justify-between p-5 bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Building2 size={16}/></div>
            <h1 className="font-black text-slate-900 uppercase tracking-tighter text-sm">CADEL MANAGER</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-slate-50 rounded-xl text-slate-600"><Menu /></button>
      </div>

      <main className="flex-1 p-6 md:p-12 overflow-y-auto h-screen custom-scrollbar">
        <div className="max-w-6xl mx-auto pb-24">
          
          <RenderFilters />

          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in duration-700">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-1">Tableau de bord</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Analyse en temps réel de votre parc</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Wallet size={80}/></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Net Banque (Encaissé)</p>
                  <p className="text-3xl font-black text-indigo-600 tracking-tighter">{financials.netB.toLocaleString('fr-FR')}€</p>
                  <div className="mt-4 flex items-center gap-2 text-emerald-500 font-bold text-[10px] uppercase">
                    <TrendingUp size={14}/> + 12% vs mois dernier
                  </div>
                </div>
                <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl shadow-slate-900/20 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-white"><CheckCircle size={80}/></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bénéfice Réel (Net Net)</p>
                  <p className="text-3xl font-black text-white tracking-tighter">{Math.round(financials.profit).toLocaleString('fr-FR')}€</p>
                  <div className="mt-4 bg-white/10 px-3 py-1 rounded-full inline-block text-[9px] font-black text-slate-300 uppercase tracking-widest">Profit optimisé</div>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Clock size={80}/></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recettes à venir</p>
                  <p className="text-3xl font-black text-blue-500 tracking-tighter">{Math.round(financials.netUpcoming).toLocaleString('fr-FR')}€</p>
                  <div className="mt-4 text-slate-400 font-bold text-[10px] uppercase italic">Paiements attendus</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <DonutChart 
                  title="Net par Logement" 
                  data={properties.map((p, idx) => ({ 
                    label: p.name, 
                    value: tenants.filter(t => t.propertyId === p.id && !!t.paymentDate).reduce((acc, t) => acc + (t.netAmount - (t.resExpenses?.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) || 0) - (t.isUrssaf ? t.grossAmount * 0.077 : 0)), 0), 
                    color: CHART_COLORS[idx % CHART_COLORS.length] 
                  }))} 
                />
                <DonutChart 
                  title="Net par Plateforme" 
                  data={availablePlatforms.map((p, idx) => ({ 
                    label: p, 
                    value: tenants.filter(t => t.platform === p && !!t.paymentDate).reduce((acc, t) => acc + (t.netAmount - (t.isUrssaf ? t.grossAmount * 0.077 : 0)), 0), 
                    color: CHART_COLORS[(idx + 4) % CHART_COLORS.length] 
                  }))} 
                />
              </div>
            </div>
          )}

          {/* TAB: PLANNING */}
          {activeTab === 'planning' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Planning Réservations</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gestion des séjours et plateformes</p>
                </div>
                <button onClick={() => { 
                  if (properties.length === 0) { alert("Créez d'abord un bien dans l'onglet Paramètres"); return; }
                  setEditingResId(null); 
                  setFormData({ propertyId: properties[0]?.id || '', name: '', startDate: '', endDate: '', paymentDate: '', platform: availablePlatforms[0] || 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [] }); 
                  setIsModalOpen(true); 
                }} className="bg-blue-600 text-white px-8 py-4 rounded-[24px] font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center gap-2">
                  <PlusCircle size={18}/> Nouvelle Réservation
                </button>
              </div>
              <div className="bg-white rounded-[40px] border border-slate-50 shadow-2xl shadow-slate-200/50 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 font-black uppercase tracking-widest border-b border-slate-100 text-[10px] text-slate-400">
                    <tr>
                      <th className="p-6">Bien / Plateforme</th>
                      <th className="p-6">Client / Voyageur</th>
                      <th className="p-6 text-center">Dates séjour</th>
                      <th className="p-6 text-right">Net Perçu</th>
                      <th className="p-6 text-center">État Paiement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold">
                    {planningList.length === 0 ? (
                      <tr><td colSpan="5" className="p-20 text-center text-slate-300 font-medium italic text-sm">Aucune réservation ne correspond à vos critères.</td></tr>
                    ) : (
                      planningList.map(t => (
                        <tr key={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="hover:bg-slate-50/80 cursor-pointer transition-all group">
                          <td className="p-6">
                             <div className="flex flex-col">
                                <span className="text-slate-400 uppercase font-black tracking-tighter">{properties.find(p => p.id === t.propertyId)?.name || '--'}</span>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                   <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest">{t.platform}</span>
                                </div>
                             </div>
                          </td>
                          <td className="p-6 font-black text-slate-900 text-sm">{t.name}</td>
                          <td className="p-6 text-center text-slate-500 font-medium whitespace-nowrap bg-slate-50/30 group-hover:bg-blue-50/20 transition-colors">{t.startDate} <span className="mx-2 text-slate-300">➔</span> {t.endDate}</td>
                          <td className="p-6 text-right font-black text-slate-900 text-sm tabular-nums">{t.netAmount.toFixed(2)}€</td>
                          <td className="p-6 text-center">
                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${t.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                              {t.paymentDate ? 'Validé' : 'Attente'}
                            </span>
                            {t.paymentDate && <p className="text-[9px] text-slate-400 mt-2 font-bold">{t.paymentDate}</p>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: FINANCES */}
          {activeTab === 'finances' && (
            <div className="space-y-10 animate-in fade-in">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Comptabilité Détaillée</h2>
              
              <div className="bg-white rounded-[40px] border border-slate-50 shadow-2xl shadow-slate-200/50 overflow-hidden text-xs">
                <div className="p-8 bg-slate-900 text-white font-black uppercase text-[11px] tracking-widest flex justify-between items-center border-b border-white/5">
                   <div className="flex items-center gap-3"><Calculator size={20} className="text-blue-400"/> Bilan Direct & URSSAF</div>
                   <span className="opacity-40 font-bold">Base Taxes 7.7%</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 font-black uppercase tracking-widest border-b border-slate-100 text-[10px] text-slate-400">
                      <tr><th className="p-6">Période</th><th className="p-6 text-right text-indigo-600 font-black">Banque</th><th className="p-6 text-right">Base URSSAF</th><th className="p-6 text-right text-rose-500">Provision Taxes</th><th className="p-6 text-right">Charges Svc.</th><th className="p-6 text-right font-black">Profit Réel</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold">
                      {monthlyRecapData.length === 0 ? (
                        <tr><td colSpan="6" className="p-20 text-center text-slate-300 font-medium italic">Aucune donnée comptable.</td></tr>
                      ) : (
                        monthlyRecapData.map(([m, d]) => (
                          <tr key={m} className="hover:bg-slate-50 transition-all">
                            <td className="p-6 capitalize font-black text-slate-900">{formatMonthYear(m)}</td>
                            <td className="p-6 text-right font-black text-indigo-600 tabular-nums">{d.totalBank.toLocaleString('fr-FR')}€</td>
                            <td className="p-6 text-right text-slate-500 tabular-nums">{d.urssafGross.toLocaleString('fr-FR')}€</td>
                            <td className="p-6 text-right text-rose-500 tabular-nums">-{d.taxes.toFixed(2)}€</td>
                            <td className="p-6 text-right text-slate-500 tabular-nums">-{d.charges.toLocaleString('fr-FR')}€</td>
                            <td className={`p-6 text-right font-black text-sm tabular-nums ${d.totalBank - d.taxes - d.charges >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{(d.totalBank - d.taxes - d.charges).toLocaleString('fr-FR')}€</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-indigo-600 text-white font-black border-t-2 border-indigo-700">
                      <tr>
                        <td className="p-8 uppercase text-[11px] tracking-widest">TOTAUX FILTRÉS</td>
                        <td className="p-8 text-right tabular-nums text-lg">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-8 text-right tabular-nums opacity-80">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.urssafGross, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-8 text-right tabular-nums text-rose-200">-{monthlyRecapData.reduce((acc, [m, d]) => acc + d.taxes, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-8 text-right tabular-nums opacity-80">-{monthlyRecapData.reduce((acc, [m, d]) => acc + d.charges, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-8 text-right tabular-nums text-2xl font-black bg-indigo-700/50">{(monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0) - monthlyRecapData.reduce((acc, [m, d]) => acc + d.taxes + d.charges, 0)).toLocaleString('fr-FR')}€</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-[40px] border border-slate-50 shadow-2xl shadow-slate-200/50 overflow-hidden text-xs">
                <div className="p-8 bg-slate-900 text-white font-black flex justify-between items-center uppercase tracking-widest border-b border-white/5">
                   <div className="flex items-center gap-3"><UserCheck className="text-indigo-400" size={20}/> Frais Prestataires</div>
                   <span className="opacity-40 font-bold">Récapitulatif Dû</span>
                </div>
                <div className="overflow-x-auto text-xs">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 font-black uppercase tracking-widest border-b border-slate-100 text-[10px] text-slate-400">
                         <tr><th className="p-6">Période</th><th className="p-6">Prestataire Service</th><th className="p-6 text-right font-black">Total à verser</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-bold text-slate-600">
                         {providerRecap.length === 0 ? (
                           <tr><td colSpan="3" className="p-20 text-center text-slate-300 font-medium italic">Aucune dépense prestataire enregistrée.</td></tr>
                         ) : (
                           providerRecap.map((item, idx) => (
                             <tr key={idx} className="hover:bg-slate-50 transition-all">
                                <td className="p-6 capitalize font-bold text-slate-900">{formatMonthYear(item.month)}</td>
                                <td className="p-6 text-blue-600 font-black uppercase text-[10px] tracking-widest">{item.person}</td>
                                <td className="p-6 text-right font-black text-slate-900 text-sm tabular-nums">{item.total.toLocaleString('fr-FR')} €</td>
                             </tr>
                           ))
                         )}
                      </tbody>
                      <tfoot className="bg-slate-800 text-white font-black border-t-2">
                        <tr>
                          <td colSpan="2" className="p-8 uppercase text-[11px] tracking-widest">TOTAL PRESTATAIRES</td>
                          <td className="p-8 text-right text-2xl tracking-tighter tabular-nums">{providerRecap.reduce((acc, curr) => acc + curr.total, 0).toLocaleString('fr-FR')}€</td>
                        </tr>
                      </tfoot>
                   </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-10 animate-in fade-in">
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Configuration Système</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                
                {/* Plateformes */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-xl shadow-slate-200/40 flex flex-col h-full">
                  <h3 className="text-[11px] font-black uppercase tracking-widest mb-6 text-slate-400">Canaux de vente</h3>
                  <div className="space-y-2 mb-8 flex-1 overflow-y-auto max-h-[250px] custom-scrollbar">
                    {availablePlatforms.map(p => (
                      <div key={p} className="flex justify-between items-center text-[11px] font-black bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all uppercase tracking-tighter">
                        {p}
                        <button onClick={() => { const n = availablePlatforms.filter(x => x !== p); setAvailablePlatforms(n); updateSettings({ platforms: n }); }} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); if (inputPlat.trim()) { const n = [...availablePlatforms, inputPlat.trim()]; setAvailablePlatforms(n); updateSettings({ platforms: n }); setInputPlat(''); } }} className="flex gap-2 bg-slate-100 p-2 rounded-[24px]">
                    <input value={inputPlat} onChange={e => setInputPlat(e.target.value)} className="flex-1 bg-transparent px-4 py-2 font-bold text-xs outline-none" placeholder="Ajouter..." />
                    <button type="submit" className="bg-slate-900 text-white p-3 rounded-[18px] hover:scale-105 active:scale-95 transition-all shadow-lg"><Plus size={18} /></button>
                  </form>
                </div>
                
                {/* Prestataires */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-xl shadow-slate-200/40 flex flex-col h-full">
                  <h3 className="text-[11px] font-black uppercase tracking-widest mb-6 text-slate-400">Prestataires</h3>
                  <div className="space-y-2 mb-8 flex-1 overflow-y-auto max-h-[250px] custom-scrollbar">
                    {availableProviders.map(p => (
                      <div key={p} className="flex justify-between items-center text-[11px] font-black bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all uppercase tracking-tighter text-blue-600">
                        {p}
                        <button onClick={() => { const n = availableProviders.filter(x => x !== p); setAvailableProviders(n); updateSettings({ providers: n }); }} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); if (inputProv.trim()) { const n = [...availableProviders, inputProv.trim()]; setAvailableProviders(n); updateSettings({ providers: n }); setInputProv(''); } }} className="flex gap-2 bg-slate-100 p-2 rounded-[24px]">
                    <input value={inputProv} onChange={e => setInputProv(e.target.value)} className="flex-1 bg-transparent px-4 py-2 font-bold text-xs outline-none" placeholder="Prénom..." />
                    <button type="submit" className="bg-slate-900 text-white p-3 rounded-[18px] hover:scale-105 active:scale-95 transition-all shadow-lg"><Plus size={18} /></button>
                  </form>
                </div>

                {/* Types Services */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-xl shadow-slate-200/40 flex flex-col h-full">
                  <h3 className="text-[11px] font-black uppercase tracking-widest mb-6 text-slate-400">Prestations types</h3>
                  <div className="space-y-2 mb-8 flex-1 overflow-y-auto max-h-[250px] custom-scrollbar">
                    {availableServiceTypes.map(p => (
                      <div key={p} className="flex justify-between items-center text-[11px] font-black bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all uppercase tracking-tighter">
                        {p}
                        <button onClick={() => { const n = availableServiceTypes.filter(x => x !== p); setAvailableServiceTypes(n); updateSettings({ services: n }); }} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); if (inputSvc.trim()) { const n = [...availableServiceTypes, inputSvc.trim()]; setAvailableServiceTypes(n); updateSettings({ services: n }); setInputSvc(''); } }} className="flex gap-2 bg-slate-100 p-2 rounded-[24px]">
                    <input value={inputSvc} onChange={e => setInputSvc(e.target.value)} className="flex-1 bg-transparent px-4 py-2 font-bold text-xs outline-none" placeholder="Service..." />
                    <button type="submit" className="bg-slate-900 text-white p-3 rounded-[18px] hover:scale-105 active:scale-95 transition-all shadow-lg"><Plus size={18} /></button>
                  </form>
                </div>

                {/* LOGEMENTS */}
                <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-blue-100 flex flex-col h-full border-2 border-blue-100 relative">
                  <div className="absolute -top-3 -right-3 bg-blue-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">Actifs</div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest mb-6 text-blue-600 flex items-center gap-2"><Home size={14}/> Votre Parc</h3>
                  <div className="space-y-3 mb-8 flex-1 overflow-y-auto max-h-[250px] custom-scrollbar text-[11px]">
                    {properties.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic text-center p-4">Aucun bien enregistré.</p>
                    ) : (
                      properties.map(p => (
                        <div key={p.id} className="flex justify-between items-start bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl hover:shadow-lg hover:shadow-blue-100 transition-all border border-blue-100/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-900 truncate uppercase tracking-tighter leading-tight">{p.name}</p>
                            <p className="text-[10px] text-slate-500 truncate mt-1">{p.address}</p>
                          </div>
                          <button onClick={async () => { if(window.confirm("Supprimer ce bien ?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'properties', p.id)) }} className="text-slate-300 hover:text-rose-500 p-1 ml-2"><Trash2 size={16} /></button>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={async (e) => { 
                    e.preventDefault(); 
                    if(user && user.uid !== 'local-test-user' && inputProp.name.trim()) {
                      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), { 
                        name: inputProp.name.trim(), 
                        address: inputProp.address.trim() 
                      }); 
                      setInputProp({ name: '', address: '' });
                    }
                  }} className="space-y-2 pt-4 border-t border-blue-50">
                    <input required value={inputProp.name} onChange={e => setInputProp({...inputProp, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-300 transition-all shadow-inner" placeholder="Nom du bien (ex: Villa...)" />
                    <div className="flex gap-2">
                      <input value={inputProp.address} onChange={e => setInputProp({...inputProp, address: e.target.value})} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-300 transition-all shadow-inner" placeholder="Adresse" />
                      <button type="submit" className="bg-blue-600 text-white p-3 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-200"><Plus size={18} /></button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODALE RÉSERVATION */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-[60px] shadow-[0_35px_100px_-15px_rgba(0,0,0,0.3)] w-full max-w-3xl max-h-[95vh] flex flex-col scale-in-center overflow-hidden border border-slate-100">
            <div className="p-12 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4 text-blue-600">
                <div className="bg-blue-50 p-3 rounded-2xl"><CalendarCheck size={28} /></div>
                <div>
                  <h3 className="font-black text-2xl tracking-tight text-slate-900">Détails Réservation</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Édition en temps réel</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 hover:rotate-90 transition-all duration-300"><X size={28} /></button>
            </div>
            <form onSubmit={saveRes} className="p-12 space-y-10 overflow-y-auto flex-1 custom-scrollbar text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase ml-3 text-slate-400 tracking-widest">Choisir le logement</label>
                  <select required value={formData.propertyId} onChange={e => setFormData({ ...formData, propertyId: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black shadow-inner outline-none focus:border-blue-300">
                    <option value="" disabled>Liste des biens...</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase ml-3 text-slate-400 tracking-widest">Nom du Voyageur</label>
                  <input required placeholder="Nom complet..." value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black shadow-inner outline-none focus:border-blue-300 text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase ml-3 text-slate-400 tracking-widest">Date d'Arrivée</label>
                  <input type="date" required value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black shadow-inner outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase ml-3 text-slate-400 tracking-widest">Date de Départ</label>
                  <input type="date" required value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black shadow-inner outline-none" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-10 rounded-[48px] border border-blue-50 space-y-8 shadow-inner">
                <div className="flex justify-between items-center font-black text-[11px] uppercase tracking-widest text-blue-900 border-b border-blue-100 pb-4">
                  <div className="flex items-center gap-2"><Euro size={16}/> Données Financières</div>
                  <select value={formData.platform} onChange={e => setFormData({ ...formData, platform: e.target.value })} className="bg-white border border-blue-100 rounded-xl px-4 py-2 text-blue-600 shadow-sm outline-none">
                    {availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {formData.platform === 'Booking' || formData.platform === 'Abritel' ? (
                  <div className="grid grid-cols-2 gap-6 text-[11px]">
                    <div className="space-y-1.5"><label className="font-black uppercase text-slate-400">Total payé par Client</label><input type="number" step="0.01" value={formData.displayedAmount} onChange={e => setFormData({ ...formData, displayedAmount: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black text-sm" /></div>
                    <div className="space-y-1.5"><label className="font-black uppercase text-rose-400">Taxe Séjour à reverser</label><input type="number" step="0.01" value={formData.cityTax} onChange={e => setFormData({ ...formData, cityTax: e.target.value })} className="w-full p-4 border border-rose-100 rounded-2xl font-black text-sm text-rose-500 bg-rose-50/30" /></div>
                    <div className="col-span-2 flex justify-between bg-slate-900 p-5 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl"><span>Base Calcul URSSAF (Brut)</span><span className="text-blue-400">{(parseFloat(formData.displayedAmount) - (parseFloat(formData.cityTax) || 0)).toFixed(2)}€</span></div>
                    <div className="space-y-1.5"><label className="font-black uppercase text-slate-400">Commission Plateforme</label><input type="number" step="0.01" value={formData.platformFees} onChange={e => setFormData({ ...formData, platformFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black text-sm" /></div>
                    <div className="space-y-1.5"><label className="font-black uppercase text-slate-400">Frais Bancaires / Stripe</label><input type="number" step="0.01" value={formData.bankFees} onChange={e => setFormData({ ...formData, bankFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black text-sm" /></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-6 text-[11px]">
                    <div className="space-y-1.5"><label className="font-black uppercase text-slate-400">Brut URSSAF déclaré</label><input type="number" step="0.01" value={formData.grossAmount} onChange={e => setFormData({ ...formData, grossAmount: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black text-sm" /></div>
                    <div className="space-y-1.5"><label className="font-black uppercase text-slate-400">Frais / Com. plateforme</label><input type="number" step="0.01" value={formData.platformFees} onChange={e => setFormData({ ...formData, platformFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black text-sm" /></div>
                  </div>
                )}
                <div className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <input type="checkbox" className="w-5 h-5 accent-blue-600 rounded-lg" checked={formData.isUrssaf} onChange={e => setFormData({ ...formData, isUrssaf: e.target.checked })} />
                  <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Provisionner taxes Auto-Entrep. (7.7%)</span>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><UserCheck size={16}/> Prestations Externes</span>
                  <button type="button" onClick={() => setFormData({ ...formData, resExpenses: [...formData.resExpenses, { id: Date.now().toString(), person: availableProviders[0] || '', type: availableServiceTypes[0] || '', amount: 0 }] })} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition-all">+ Ajouter Frais</button>
                </div>
                <div className="space-y-3">
                   {formData.resExpenses.map(exp => (
                    <div key={exp.id} className="flex gap-3 items-center bg-slate-50 p-4 rounded-3xl border border-slate-100 group">
                      <select value={exp.person} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, person: e.target.value } : x) })} className="flex-1 p-3 border border-slate-200 rounded-xl text-[10px] font-black uppercase bg-white">
                        {availableProviders.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <select value={exp.type} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 p-3 border border-slate-200 rounded-xl text-[10px] font-black uppercase bg-white">
                        {availableServiceTypes.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-inner">
                        <input type="number" value={exp.amount} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, amount: e.target.value } : x) })} className="w-16 p-2 font-black text-right text-xs outline-none" />
                        <span className="text-slate-400 font-bold text-[10px]">€</span>
                      </div>
                      <button type="button" onClick={() => setFormData({ ...formData, resExpenses: formData.resExpenses.filter(x => x.id !== exp.id) })} className="text-slate-300 hover:text-rose-500 transition-colors group-hover:scale-110"><Trash2 size={20} /></button>
                    </div>
                  ))}
                  {formData.resExpenses.length === 0 && <p className="text-center text-slate-300 py-4 italic font-medium">Aucun service associé.</p>}
                </div>
              </div>

              <div className={`p-10 rounded-[48px] border-2 flex flex-col md:flex-row items-center justify-between transition-all gap-6 shadow-xl ${formData.paymentDate ? 'bg-emerald-50/50 border-emerald-100' : 'bg-orange-50 border-orange-100 shadow-inner'}`}>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Validation du Paiement</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Date de réception en banque</p>
                </div>
                <input type="date" value={formData.paymentDate} onChange={e => setFormData({ ...formData, paymentDate: e.target.value })} className="w-full md:w-auto p-4 border border-slate-200 rounded-[20px] font-black bg-white shadow-lg focus:ring-2 focus:ring-blue-200 outline-none" />
              </div>

              {editingResId && (
                <div className="pt-4">
                   <a href={getGoogleCalendarUrl(formData, properties.find(p => p.id === formData.propertyId))} target="_blank" rel="noreferrer" className="w-full bg-blue-50 text-blue-700 p-6 rounded-[32px] font-black text-[11px] uppercase tracking-[2px] flex items-center justify-center gap-3 hover:bg-blue-600 hover:text-white transition-all shadow-xl shadow-blue-100 border-2 border-white">
                    <CalendarIcon size={22}/> Synchroniser avec Google Agenda
                   </a>
                </div>
              )}

              <div className="flex flex-col md:flex-row justify-between items-center pt-12 border-t border-slate-100 gap-8">
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-2">Estimation Bénéfice Net</p>
                  <p className="text-4xl font-black text-blue-600 tracking-tighter leading-none shadow-blue-100 drop-shadow-sm">
                    {(nModale - curChargesModale - (formData.isUrssaf ? ((formData.platform === 'Booking' || formData.platform === 'Abritel' ? (parseFloat(formData.displayedAmount) - (parseFloat(formData.cityTax) || 0)) : parseFloat(formData.grossAmount) || 0) * 0.077) : 0)).toFixed(2)}€
                  </p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                  {editingResId && <button type="button" onClick={() => deleteRes(editingResId)} className="flex-1 md:flex-none px-8 py-5 text-rose-500 font-black text-[11px] uppercase tracking-widest hover:bg-rose-50 rounded-[24px] transition-colors border-2 border-transparent hover:border-rose-100">Supprimer</button>}
                  <button type="submit" className="flex-1 md:flex-none bg-slate-900 text-white px-12 py-5 rounded-[24px] font-black shadow-2xl shadow-slate-300 hover:bg-blue-600 hover:-translate-y-1 active:translate-y-0 uppercase tracking-widest text-[11px] transition-all">Enregistrer</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
