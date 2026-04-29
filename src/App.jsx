import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, addDoc, query } from 'firebase/firestore';
import { 
  Home, Euro, LayoutDashboard, Plus, Trash2, MapPin, Calendar as CalendarIcon,
  Menu, X, CalendarCheck, CheckCircle, Clock, PieChart as PieChartIcon,
  ChevronLeft, ChevronRight, BarChart3, List, Wallet, Settings, Calculator,
  UserCheck, PlusCircle, TrendingUp, Info, ChevronUp, ChevronDown, Filter, Loader2
} from 'lucide-react';

// --- CONFIGURATION FIREBASE SÉCURISÉE (ANTI PAGE-BLANCHE VERCEL) ---
let firebaseConfig;
if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
} else {
  // 👇 REMPLACE CES CLÉS PAR CELLES DE TON PROJET FIREBASE PLUS TARD 👇
  firebaseConfig = {
    apiKey: "AIzaSyAs-v0Xexample-key-replace-this",
    authDomain: "immogerer-prod.firebaseapp.com",
    projectId: "immogerer-prod",
    storageBucket: "immogerer-prod.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
  };
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// CORRECTION MAJEURE: On remplace les caractères spéciaux et les slashs dans l'appId
// pour éviter que Firebase ne les confonde avec des sous-dossiers (Erreur : Invalid collection reference)
const appId = typeof __app_id !== 'undefined' ? String(__app_id).replace(/[^a-zA-Z0-9_-]/g, '_') : 'immogerer-prod-final';

// --- COMPOSANT GRAPHIQUE ---
const DonutChart = ({ data, title }) => {
  let cumulativePercent = 0;
  const visibleData = data.filter(d => d.value > 0);
  const displayTotal = visibleData.reduce((acc, curr) => acc + curr.value, 0);

  if (!displayTotal) return (
    <div className="bg-white p-6 rounded-[32px] border border-gray-100 flex flex-col items-center justify-center min-h-[250px]">
      <PieChartIcon size={24} className="text-gray-200 mb-2" />
      <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest text-center">{title}</p>
    </div>
  );

  return (
    <div className="bg-white p-8 rounded-[40px] border border-gray-100 flex flex-col md:flex-row items-center gap-8 animate-in fade-in">
      <div className="relative w-40 h-40 flex-shrink-0">
        <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90">
          {visibleData.map((slice, i) => {
            const percent = (slice.value / displayTotal) * 100;
            const strokeDasharray = `${percent} ${100 - percent}`;
            const strokeDashoffset = -cumulativePercent;
            cumulativePercent += percent;
            return (
              <circle key={i} r="15.9155" cx="16" cy="16" fill="transparent" stroke={slice.color} strokeWidth="6" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000" />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter leading-none mb-1">Profit Net</span>
          <span className="text-lg font-black text-slate-800">{Math.round(displayTotal).toLocaleString('fr-FR')}€</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-2">
        <h3 className="text-sm font-black text-slate-800 mb-4">{title}</h3>
        {visibleData.map((slice, i) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }}></div>
              <span className="font-bold text-slate-600 truncate max-w-[120px]">{slice.label}</span>
            </div>
            <span className="font-black text-slate-800">{Math.round(slice.value).toLocaleString('fr-FR')} €</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  // --- HELPERS ---
  const parseLocalDate = (d) => d ? new Date(parseInt(d.split('-')[0]), parseInt(d.split('-')[1]) - 1, parseInt(d.split('-')[2])) : new Date();
  
  const formatMonthYear = (m) => {
    if (!m) return "";
    const [year, month] = m.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    let result = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  const getGoogleCalendarUrl = (res, prop) => {
    if (!res.startDate || !res.endDate) return '#';
    const text = encodeURIComponent(`Réservation: ${res.name} - ${prop?.name || ''}`);
    const details = encodeURIComponent(`Client: ${res.name}\nLogement: ${prop?.name || ''}\nPlateforme: ${res.platform}`);
    const dates = `${res.startDate.replace(/-/g, '')}/${res.endDate.replace(/-/g, '')}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
  };

  // --- ÉTATS ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('planning');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [planningViewMode, setPlanningViewMode] = useState('list');
  const [viewDate, setViewDate] = useState(new Date(2026, 4, 1));
  
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [availablePlatforms, setAvailablePlatforms] = useState(['Airbnb', 'Booking', 'Abritel', 'En direct', 'Autre']);
  const [availableProviders, setAvailableProviders] = useState(['Justine', 'Marc', 'Stéphanie']);
  const [availableServiceTypes, setAvailableServiceTypes] = useState(['Ménage', 'Entrée/Sortie', 'Piscine', 'Divers']);

  const [sortConfig, setSortConfig] = useState({ key: 'startDate', direction: 'desc' });
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [editingResId, setEditingResId] = useState(null);
  const [formData, setFormData] = useState({ 
    propertyId: '', name: '', startDate: '', endDate: '', paymentDate: '', 
    platform: 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', 
    bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [] 
  });

  const [inputPlat, setInputPlat] = useState('');
  const [inputProv, setInputProv] = useState('');
  const [inputSvc, setInputSvc] = useState('');

  // --- AUTHENTIFICATION SÉCURISÉE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch(e) {
        console.error("Auth error", e);
        // Si l'erreur arrive (ex: mauvaises clés), on permet quand même l'accès pour ne pas bloquer l'écran
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

  // --- LECTURE CLOUD FIREBASE ---
  useEffect(() => {
    if (!user) return;
    const userId = user.uid;

    const unsubProps = onSnapshot(collection(db, 'artifacts', appId, 'users', userId, 'properties'), (snap) => {
      setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.warn(error));

    const unsubTenants = onSnapshot(collection(db, 'artifacts', appId, 'users', userId, 'tenants'), (snap) => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.warn(error));

    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.platforms && d.platforms.length > 0) setAvailablePlatforms(d.platforms);
        if (d.providers && d.providers.length > 0) setAvailableProviders(d.providers);
        if (d.services && d.services.length > 0) setAvailableServiceTypes(d.services);
      }
    }, (error) => console.warn(error));

    return () => { unsubProps(); unsubTenants(); unsubSettings(); };
  }, [user]);

  // --- SAUVEGARDE CLOUD FIREBASE ---
  const updateSettings = async (n) => {
    if(!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), n, { merge: true });
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const saveRes = async (e) => {
    e.preventDefault();
    if (!formData.propertyId || !user) return;
    const isC = formData.platform === 'Booking' || formData.platform === 'Abritel';
    const g = isC ? (parseFloat(formData.displayedAmount) || 0) - (parseFloat(formData.cityTax) || 0) : parseFloat(formData.grossAmount) || 0;
    const n = isC ? g - (parseFloat(formData.platformFees) || 0) - (parseFloat(formData.bankFees) || 0) : g - (parseFloat(formData.platformFees) || 0);
    const d = { ...formData, grossAmount: g, netAmount: n, resExpenses: formData.resExpenses.map(r => ({ ...r, amount: parseFloat(r.amount) || 0 })) };
    
    if (editingResId) {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tenants', editingResId), d);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tenants'), d);
    }
    setIsModalOpen(false);
  };

  const deleteRes = async (id) => {
    if (!user) return;
    if(window.confirm("Supprimer cette réservation ?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tenants', id));
      setIsModalOpen(false);
    }
  };

  // --- CALCULS LOGIQUES ---
  const financials = useMemo(() => {
    const paid = tenants.filter(t => !!t.paymentDate);
    const netB = paid.reduce((a, t) => a + (t.netAmount || 0), 0);
    const taxes = paid.filter(t => t.isUrssaf).reduce((a, t) => a + (t.grossAmount || 0), 0) * 0.077;
    const exp = paid.reduce((a, t) => a + (t.resExpenses?.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) || 0), 0);
    return { count: properties.length, netB, taxes, exp, profit: netB - exp - taxes };
  }, [tenants, properties]);

  const monthlyRecapData = useMemo(() => {
    const stats = {};
    const initMonth = (m) => { if (!stats[m]) stats[m] = { totalBank: 0, urssafGross: 0, directNet: 0, charges: 0, taxes: 0 }; };
    tenants.filter(t => !!t.paymentDate).forEach(t => {
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
  }, [tenants]);

  const providerRecap = useMemo(() => {
    const recap = {};
    tenants.forEach(t => {
      const month = t.startDate.substring(0, 7);
      t.resExpenses?.forEach(exp => {
        const key = `${month}_${exp.person}`;
        if (!recap[key]) recap[key] = { month, person: exp.person, total: 0 };
        recap[key].total += (parseFloat(exp.amount) || 0);
      });
    });
    return Object.values(recap).sort((a,b) => b.month.localeCompare(a.month));
  }, [tenants]);

  const sortedList = useMemo(() => {
    let f = tenants.filter(t => {
      const d = new Date(t.startDate);
      const matchProp = propertyFilter === 'all' || t.propertyId === propertyFilter;
      const matchMonth = monthFilter === 'all' || d.getMonth() === parseInt(monthFilter);
      const matchYear = yearFilter === 'all' || d.getFullYear() === parseInt(yearFilter);
      return matchProp && matchMonth && matchYear;
    });
    if (sortConfig.key) {
      f.sort((a, b) => {
        let av, bv;
        if (sortConfig.key === 'property') {
          av = properties.find(p => p.id === a.propertyId)?.name || '';
          bv = properties.find(p => p.id === b.propertyId)?.name || '';
        } else if (sortConfig.key === 'status') {
          av = !!a.paymentDate; bv = !!b.paymentDate;
        } else {
          av = a[sortConfig.key] || '';
          bv = b[sortConfig.key] || '';
        }
        return sortConfig.direction === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }
    return f;
  }, [tenants, sortConfig, propertyFilter, monthFilter, yearFilter, properties]);

  const yearsAvailable = useMemo(() => {
    const years = tenants.map(t => new Date(t.startDate).getFullYear());
    return [...new Set(years)].sort((a, b) => b - a);
  }, [tenants]);

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50 flex-col gap-4">
      <Loader2 className="animate-spin text-blue-600" size={48} />
      <p className="text-blue-600 font-bold uppercase tracking-widest text-xs">Connexion au Cloud...</p>
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`fixed md:sticky top-0 left-0 z-40 w-64 h-full md:h-screen bg-white border-r border-gray-100 flex flex-col transform md:translate-x-0 transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 border-b flex flex-col items-center">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg"><Home size={20} /></div>
          <h1 className="font-black uppercase tracking-tighter text-lg">ImmoGérer</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { id: 'planning', label: 'Planning' },
            { id: 'dashboard', label: 'Tableau de bord' },
            { id: 'finances', label: 'Finances' },
            { id: 'properties', label: 'Mes Biens' },
            { id: 'settings', label: 'Paramètres' }
          ].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>{item.label}</button>
          ))}
        </nav>
        <div className="p-4 border-t">
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl flex items-center justify-between text-[9px] font-black uppercase">
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Cloud Connecté</div>
          </div>
        </div>
      </aside>

      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b sticky top-0 z-30">
        <h1 className="font-black text-blue-600">ImmoGérer</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2"><Menu /></button>
      </div>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto h-screen custom-scrollbar">
        <div className="max-w-6xl mx-auto pb-24">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Tableau de bord</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Banque</p><p className="text-2xl font-black text-indigo-600">{financials.netB.toLocaleString('fr-FR')}€</p></div>
                <div className="bg-white p-6 rounded-3xl border shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bénéfice Réel</p><p className="text-2xl font-black text-emerald-600">{Math.round(financials.profit).toLocaleString('fr-FR')}€</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <DonutChart title="Net par Logement" data={properties.map(p => ({ label: p.name, value: tenants.filter(t => t.propertyId === p.id && !!t.paymentDate).reduce((acc, t) => acc + (t.netAmount - (t.resExpenses?.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) || 0) - (t.isUrssaf ? t.grossAmount * 0.077 : 0)), 0), color: '#3B82F6' }))} />
                <DonutChart title="Net par Plateforme" data={availablePlatforms.map(p => ({ label: p, value: tenants.filter(t => t.platform === p && !!t.paymentDate).reduce((acc, t) => acc + (t.netAmount - (t.isUrssaf ? t.grossAmount * 0.077 : 0)), 0), color: '#8B5CF6' }))} />
              </div>
            </div>
          )}

          {/* TAB: PLANNING */}
          {activeTab === 'planning' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black uppercase">Planning</h2>
                  <div className="flex flex-wrap gap-2">
                    <select value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)} className="text-[10px] font-black border rounded-lg p-2 uppercase bg-white cursor-pointer">{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="all">Tous</option></select>
                    <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="text-[10px] font-black border rounded-lg p-2 uppercase bg-white cursor-pointer"><option value="all">Mois</option>{['Janv','Févr','Mars','Avril','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'].map((m,i)=><option key={i} value={i}>{m}</option>)}</select>
                    <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="text-[10px] font-black border rounded-lg p-2 uppercase bg-white cursor-pointer"><option value="all">Années</option>{yearsAvailable.map(y=><option key={y} value={y}>{y}</option>)}</select>
                  </div>
                </div>
                <button onClick={() => { 
                  if (properties.length === 0) { alert("Créez d'abord un bien dans l'onglet 'Mes Biens'"); return; }
                  setEditingResId(null); 
                  setFormData({ propertyId: properties[0]?.id || '', name: '', startDate: '', endDate: '', paymentDate: '', platform: availablePlatforms[0] || 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [] }); 
                  setIsModalOpen(true); 
                }} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase shadow-lg hover:bg-blue-700 transition-all">+ Nouvelle</button>
              </div>
              <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 font-black uppercase tracking-widest border-b text-[9px]">
                    <tr>
                      <th className="p-5 cursor-pointer hover:text-blue-600" onClick={() => setSortConfig({ key: 'property', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>Bien</th>
                      <th className="p-5 cursor-pointer hover:text-blue-600" onClick={() => setSortConfig({ key: 'name', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>Client</th>
                      <th className="p-5 text-center">Dates</th>
                      <th className="p-5 text-right">Net Reçu</th>
                      <th className="p-5 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold">
                    {sortedList.length === 0 ? (
                      <tr><td colSpan="5" className="p-10 text-center text-slate-400 font-medium">Aucune réservation trouvée.</td></tr>
                    ) : (
                      sortedList.map(t => (
                        <tr key={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="hover:bg-slate-50 cursor-pointer transition-colors">
                          <td className="p-5 text-slate-400 uppercase font-black">{properties.find(p => p.id === t.propertyId)?.name || '--'}</td>
                          <td className="p-5 font-black text-slate-800">{t.name}</td>
                          <td className="p-5 text-center text-slate-500 whitespace-nowrap">{t.startDate} ➔ {t.endDate}</td>
                          <td className="p-5 text-right font-black text-slate-900">{t.netAmount.toFixed(2)}€</td>
                          <td className="p-5 text-center"><span className={`px-2.5 py-1 rounded-full text-[9px] uppercase tracking-tighter ${t.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{t.paymentDate ? 'Payé' : 'Attente'}</span></td>
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
            <div className="space-y-6 animate-in fade-in">
              <h2 className="text-xl font-black uppercase tracking-widest">Comptabilité Mensuelle</h2>
              <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden text-xs">
                <div className="p-5 bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest flex justify-between items-center"><span>Bilan Direct & URSSAF</span><span className="opacity-40">Provision Taxes AE (7.7%)</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 font-black uppercase tracking-widest border-b text-[10px]">
                      <tr><th className="p-5">Mois</th><th className="p-5 text-right text-indigo-600 font-black">Total Banque</th><th className="p-5 text-right">URSSAF (Brut)</th><th className="p-5 text-right">Direct (Net)</th><th className="p-5 text-right text-red-400">Taxes</th><th className="p-5 text-right">Frais</th><th className="p-5 text-right font-black">Profit Réel</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold">
                      {monthlyRecapData.length === 0 ? (
                        <tr><td colSpan="7" className="p-10 text-center text-slate-400 font-medium">Pas assez de données. Ajoutez des locations "Payées".</td></tr>
                      ) : (
                        monthlyRecapData.map(([m, d]) => (
                          <tr key={m} className="hover:bg-slate-50 transition-colors">
                            <td className="p-5 capitalize font-black text-slate-800">{formatMonthYear(m)}</td>
                            <td className="p-5 text-right font-black text-indigo-600">{d.totalBank.toLocaleString('fr-FR')}€</td>
                            <td className="p-5 text-right text-slate-400">{d.urssafGross.toLocaleString('fr-FR')}€</td>
                            <td className="p-5 text-right text-slate-400">{d.directNet.toLocaleString('fr-FR')}€</td>
                            <td className="p-5 text-right text-red-400">-{d.taxes.toFixed(2)}€</td>
                            <td className="p-5 text-right text-slate-400">-{d.charges.toLocaleString('fr-FR')}€</td>
                            <td className={`p-5 text-right font-black text-lg ${d.totalBank - d.taxes - d.charges >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{(d.totalBank - d.taxes - d.charges).toLocaleString('fr-FR')}€</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 bg-indigo-900 text-white font-black flex justify-between items-center uppercase tracking-tighter">
                   <div className="flex items-center gap-2"><UserCheck className="text-indigo-300" size={20}/> Frais à payer par Prestataire</div>
                </div>
                <div className="overflow-x-auto text-xs">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                         <tr><th className="p-5">Mois</th><th className="p-5">Prestataire</th><th className="p-5 text-right font-black">Total dû</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-bold text-slate-600">
                         {providerRecap.length === 0 ? (
                           <tr><td colSpan="3" className="p-10 text-center text-slate-400 font-medium">Aucun prestataire enregistré.</td></tr>
                         ) : (
                           providerRecap.map((item, idx) => (
                             <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-5 capitalize font-bold text-slate-800">{formatMonthYear(item.month)}</td>
                                <td className="p-5 text-indigo-700 font-black uppercase text-[10px] tracking-widest">{item.person}</td>
                                <td className="p-5 text-right font-black text-slate-900">{item.total.toLocaleString('fr-FR')} €</td>
                             </tr>
                           ))
                         )}
                      </tbody>
                   </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PROPERTIES */}
          {activeTab === 'properties' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black uppercase tracking-widest text-slate-800">Mes Logements</h2>
                <button onClick={() => setIsPropertyFormOpen(!isPropertyFormOpen)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all">+ Ajouter</button>
              </div>
              {isPropertyFormOpen && (
                <form onSubmit={async (e) => { 
                  e.preventDefault(); 
                  const fd = new FormData(e.target); 
                  if(user) {
                    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'properties'), { name: fd.get('n'), address: fd.get('a'), rent: parseFloat(fd.get('r')) }); 
                  }
                  setIsPropertyFormOpen(false); 
                }} className="bg-white p-8 rounded-[32px] border-2 border-blue-50 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 shadow-xl">
                  <input name="n" required placeholder="Nom (ex: Studio Paris)" className="p-4 bg-slate-50 border rounded-2xl font-bold outline-none" />
                  <input name="a" required placeholder="Adresse" className="p-4 bg-slate-50 border rounded-2xl font-bold outline-none" />
                  <input name="r" type="number" required placeholder="Prix/nuit (€)" className="p-4 bg-slate-50 border rounded-2xl font-bold outline-none" />
                  <button type="submit" className="md:col-span-3 bg-blue-600 text-white p-4 rounded-2xl font-black shadow-lg uppercase text-xs">Enregistrer</button>
                </form>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {properties.map(p => (
                  <div key={p.id} className="bg-white p-6 rounded-3xl border relative group transition-all hover:border-blue-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div><h4 className="font-black text-slate-800">{p.name}</h4><p className="text-[9px] text-slate-400 font-black uppercase flex items-center gap-1 mt-1"><MapPin size={10} /> {p.address}</p></div>
                      <button onClick={async () => { if(user && window.confirm("Supprimer ce bien ?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'properties', p.id)) }} className="text-slate-200 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
                    </div>
                    <div className="bg-blue-50 inline-block px-3 py-1 rounded-xl text-blue-600 font-black text-xs">{p.rent}€ / nuit</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in">
              <div className="bg-white p-8 rounded-[32px] border shadow-sm">
                <h3 className="text-[11px] font-black uppercase tracking-widest mb-6 text-slate-400">Plateformes</h3>
                <div className="space-y-1.5 mb-6">{availablePlatforms.map(p => (<div key={p} className="flex justify-between items-center text-xs font-bold bg-slate-50 p-3 rounded-xl hover:bg-slate-100">{p}<button onClick={() => { const n = availablePlatforms.filter(x => x !== p); setAvailablePlatforms(n); updateSettings({ platforms: n }); }} className="text-slate-300 hover:text-red-500"><X size={14} /></button></div>))}</div>
                <div className="flex gap-2"><input value={inputPlat} onChange={e => setInputPlat(e.target.value)} className="flex-1 p-3 bg-slate-50 border rounded-xl font-bold text-xs outline-none" placeholder="Ajouter..." /><button onClick={() => { if (inputPlat.trim()) { const n = [...availablePlatforms, inputPlat.trim()]; setAvailablePlatforms(n); updateSettings({ platforms: n }); setInputPlat(''); } }} className="bg-slate-900 text-white p-3 rounded-xl transition-all hover:scale-110 active:scale-95 shadow-md"><Plus size={18} /></button></div>
              </div>
              <div className="bg-white p-8 rounded-[32px] border shadow-sm">
                <h3 className="text-[11px] font-black uppercase tracking-widest mb-6 text-slate-400">Prestataires</h3>
                <div className="space-y-1.5 mb-6">{availableProviders.map(p => (<div key={p} className="flex justify-between items-center text-xs font-bold bg-slate-50 p-3 rounded-xl hover:bg-slate-100">{p}<button onClick={() => { const n = availableProviders.filter(x => x !== p); setAvailableProviders(n); updateSettings({ providers: n }); }} className="text-slate-300 hover:text-red-500"><X size={14} /></button></div>))}</div>
                <div className="flex gap-2"><input value={inputProv} onChange={e => setInputProv(e.target.value)} className="flex-1 p-3 bg-slate-50 border rounded-xl font-bold text-xs outline-none" placeholder="Prénom..." /><button onClick={() => { if (inputProv.trim()) { const n = [...availableProviders, inputProv.trim()]; setAvailableProviders(n); updateSettings({ providers: n }); setInputProv(''); } }} className="bg-slate-900 text-white p-3 rounded-xl transition-all hover:scale-110 active:scale-95 shadow-md"><Plus size={18} /></button></div>
              </div>
              <div className="bg-white p-8 rounded-[32px] border shadow-sm">
                <h3 className="text-[11px] font-black uppercase tracking-widest mb-6 text-slate-400">Services</h3>
                <div className="space-y-1.5 mb-6">{availableServiceTypes.map(p => (<div key={p} className="flex justify-between items-center text-xs font-bold bg-slate-50 p-3 rounded-xl hover:bg-slate-100">{p}<button onClick={() => { const n = availableServiceTypes.filter(x => x !== p); setAvailableServiceTypes(n); updateSettings({ services: n }); }} className="text-slate-300 hover:text-red-500"><X size={14} /></button></div>))}</div>
                <div className="flex gap-2"><input value={inputSvc} onChange={e => setInputSvc(e.target.value)} className="flex-1 p-3 bg-slate-50 border rounded-xl font-bold text-xs outline-none" placeholder="Service..." /><button onClick={() => { if (inputSvc.trim()) { const n = [...availableServiceTypes, inputSvc.trim()]; setAvailableServiceTypes(n); updateSettings({ services: n }); setInputSvc(''); } }} className="bg-slate-900 text-white p-3 rounded-xl transition-all hover:scale-110 active:scale-95 shadow-md"><Plus size={18} /></button></div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODALE RÉSERVATION */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col scale-in-center overflow-hidden">
            <div className="p-10 border-b flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3 text-blue-600"><CalendarCheck size={24} /><h3 className="font-black text-xl tracking-tight">Réservation</h3></div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={saveRes} className="p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1"><label className="text-[9px] font-black uppercase ml-2 text-slate-400">Logement</label>
                  <select required value={formData.propertyId} onChange={e => setFormData({ ...formData, propertyId: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold shadow-inner">
                    <option value="" disabled>Choisir un bien...</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase ml-2 text-slate-400">Voyageur</label><input required placeholder="Nom Client" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold shadow-inner" /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase ml-2 text-slate-400">Arrivée</label><input type="date" required value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold shadow-inner" /></div>
                <div className="space-y-1"><label className="text-[9px] font-black uppercase ml-2 text-slate-400">Départ</label><input type="date" required value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold shadow-inner" /></div>
              </div>
              <div className="bg-blue-50/50 p-8 rounded-[40px] border border-blue-100 space-y-6">
                <div className="flex justify-between items-center font-black text-[9px] uppercase text-blue-900"><span>Finances</span><select value={formData.platform} onChange={e => setFormData({ ...formData, platform: e.target.value })} className="bg-white border rounded-xl px-2 py-1 text-blue-600">{availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                {formData.platform === 'Booking' || formData.platform === 'Abritel' ? (
                  <div className="grid grid-cols-2 gap-4 text-[10px]">
                    <div><label className="font-black uppercase block mb-1">Prix Client</label><input type="number" step="0.01" value={formData.displayedAmount} onChange={e => setFormData({ ...formData, displayedAmount: e.target.value })} className="w-full p-3 border rounded-xl font-bold" /></div>
                    <div><label className="font-black uppercase block mb-1 text-red-500">Taxe Séjour</label><input type="number" step="0.01" value={formData.cityTax} onChange={e => setFormData({ ...formData, cityTax: e.target.value })} className="w-full p-3 border rounded-xl font-bold text-red-500" /></div>
                    <div className="col-span-2 flex justify-between bg-slate-800 p-3 rounded-xl text-white font-black uppercase"><span>Base URSSAF (Brut)</span><span>{(parseFloat(formData.displayedAmount) - (parseFloat(formData.cityTax) || 0)).toFixed(2)}€</span></div>
                    <div><label className="font-black uppercase block mb-1">Commission</label><input type="number" step="0.01" value={formData.platformFees} onChange={e => setFormData({ ...formData, platformFees: e.target.value })} className="w-full p-3 border rounded-xl font-bold" /></div>
                    <div><label className="font-black uppercase block mb-1">Frais Banq.</label><input type="number" step="0.01" value={formData.bankFees} onChange={e => setFormData({ ...formData, bankFees: e.target.value })} className="w-full p-3 border rounded-xl font-bold" /></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-[10px]">
                    <div><label className="font-black uppercase block mb-1">Brut URSSAF</label><input type="number" step="0.01" value={formData.grossAmount} onChange={e => setFormData({ ...formData, grossAmount: e.target.value })} className="w-full p-3 border rounded-xl font-bold" /></div>
                    <div><label className="font-black uppercase block mb-1">Commission</label><input type="number" step="0.01" value={formData.platformFees} onChange={e => setFormData({ ...formData, platformFees: e.target.value })} className="w-full p-3 border rounded-xl font-bold" /></div>
                  </div>
                )}
                <div className="flex items-center gap-2 bg-white/50 p-3 rounded-2xl"><input type="checkbox" className="w-4 h-4" checked={formData.isUrssaf} onChange={e => setFormData({ ...formData, isUrssaf: e.target.checked })} /><span className="text-[10px] font-black uppercase text-slate-600">Provisionner taxes AE (7.7%)</span></div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prestations de services</span><button type="button" onClick={() => setFormData({ ...formData, resExpenses: [...formData.resExpenses, { id: Date.now().toString(), person: availableProviders[0] || '', type: availableServiceTypes[0] || '', amount: 0 }] })} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">+ Ajouter</button></div>
                <div className="space-y-2">
                   {formData.resExpenses.map(exp => (
                    <div key={exp.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-2xl">
                      <select value={exp.person} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, person: e.target.value } : x) })} className="flex-1 p-2 border rounded-xl text-[10px] font-bold">{availableProviders.map(p => <option key={p} value={p}>{p}</option>)}</select>
                      <select value={exp.type} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 p-2 border rounded-xl text-[10px] font-bold">{availableServiceTypes.map(p => <option key={p} value={p}>{p}</option>)}</select>
                      <input type="number" value={exp.amount} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, amount: e.target.value } : x) })} className="w-20 p-2 border rounded-xl font-black text-right text-xs" />
                      <button type="button" onClick={() => setFormData({ ...formData, resExpenses: formData.resExpenses.filter(x => x.id !== exp.id) })} className="text-red-300"><Trash2 size={18} /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`p-8 rounded-[40px] border-2 flex items-center justify-between transition-all ${formData.paymentDate ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100 shadow-inner'}`}>
                <h4 className="text-xs font-black uppercase">Paiement reçu (Banque)</h4>
                <input type="date" value={formData.paymentDate} onChange={e => setFormData({ ...formData, paymentDate: e.target.value })} className="p-3 border rounded-2xl font-black bg-white shadow-lg outline-none" />
              </div>
              {editingResId && (
                <div className="flex pt-4">
                   <a href={getGoogleCalendarUrl(formData, properties.find(p => p.id === formData.propertyId))} target="_blank" rel="noreferrer" className="flex-1 bg-blue-50 text-blue-700 p-5 rounded-[24px] font-black text-[10px] uppercase tracking-[2px] flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all shadow-xl shadow-blue-100 border-2 border-white"><CalendarIcon size={18}/> Synchroniser Google Agenda</a>
                </div>
              )}
              <div className="flex justify-between items-center pt-8 border-t">
                <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Estimation Profit Net</p><p className="text-3xl font-black text-blue-600 tracking-tighter leading-none">{(nModale - curChargesModale - (formData.isUrssaf ? ((formData.platform === 'Booking' || formData.platform === 'Abritel' ? (parseFloat(formData.displayedAmount) - (parseFloat(formData.cityTax) || 0)) : parseFloat(formData.grossAmount) || 0) * 0.077) : 0)).toFixed(2)}€</p></div>
                <div className="flex gap-4">
                  {editingResId && <button type="button" onClick={() => deleteRes(editingResId)} className="px-6 py-4 text-red-500 font-bold text-[10px] uppercase hover:bg-red-50 rounded-2xl">Supprimer</button>}
                  <button type="submit" className="bg-blue-600 text-white px-10 py-4 rounded-[24px] font-black shadow-xl hover:bg-blue-700 uppercase tracking-widest text-[10px] active:scale-95 transition-all">Enregistrer</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
