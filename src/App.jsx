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

// --- COMPOSANT GRAPHIQUE ---
const DonutChart = ({ data, title }) => {
  let cumulativePercent = 0;
  const visibleData = data.filter(d => d.value > 0);
  const displayTotal = visibleData.reduce((acc, curr) => acc + curr.value, 0);

  if (!displayTotal) {
    return (
      <div className="bg-white p-6 rounded-[32px] border border-gray-100 flex flex-col items-center justify-center min-h-[250px]">
        <PieChartIcon size={24} className="text-gray-200 mb-2" />
        <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest text-center">{title}</p>
      </div>
    );
  }

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

// --- COMPOSANT PRINCIPAL ---
const App = () => {
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
  const [planningViewMode, setPlanningViewMode] = useState('list');
  const [viewDate, setViewDate] = useState(new Date());
  
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [availablePlatforms, setAvailablePlatforms] = useState(['Airbnb', 'Booking', 'Abritel', 'En direct', 'Autre']);
  const [availableProviders, setAvailableProviders] = useState(['Justine', 'Marc', 'Stéphanie']);
  const [availableServiceTypes, setAvailableServiceTypes] = useState(['Ménage', 'Entrée/Sortie', 'Piscine', 'Divers']);

  const [sortConfig, setSortConfig] = useState({ key: 'startDate', direction: 'desc' });
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  // Filtres spécifiques Finance
  const [finFilterMonth, setFinFilterMonth] = useState('all');
  const [finFilterYear, setFinFilterYear] = useState('all');
  const [finFilterProp, setFinFilterProp] = useState('all');
  const [finFilterPlat, setFinFilterPlat] = useState('all');

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

  // --- SAUVEGARDE CLOUD ---
  const updateSettings = async (n) => {
    if(!user || user.uid === 'local-test-user') return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), n, { merge: true });
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

  // --- CALCULS LOGIQUES ---
  const financials = useMemo(() => {
    const paid = tenants.filter(t => !!t.paymentDate);
    const netB = paid.reduce((a, t) => a + (t.netAmount || 0), 0);
    const taxes = paid.filter(t => t.isUrssaf).reduce((a, t) => a + (t.grossAmount || 0), 0) * 0.077;
    const exp = paid.reduce((a, t) => a + (t.resExpenses?.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) || 0), 0);
    return { count: properties.length, netB, taxes, exp, profit: netB - exp - taxes };
  }, [tenants, properties]);

  const filteredFinanceTenants = useMemo(() => {
    return tenants.filter(t => {
      if (!t.paymentDate) return false;
      const date = new Date(t.paymentDate);
      const matchMonth = finFilterMonth === 'all' || date.getMonth() === parseInt(finFilterMonth);
      const matchYear = finFilterYear === 'all' || date.getFullYear() === parseInt(finFilterYear);
      const matchProp = finFilterProp === 'all' || t.propertyId === finFilterProp;
      const matchPlat = finFilterPlat === 'all' || t.platform === finFilterPlat;
      return matchMonth && matchYear && matchProp && matchPlat;
    });
  }, [tenants, finFilterMonth, finFilterYear, finFilterProp, finFilterPlat]);

  const monthlyRecapData = useMemo(() => {
    const stats = {};
    const initMonth = (m) => { if (!stats[m]) stats[m] = { totalBank: 0, urssafGross: 0, directNet: 0, charges: 0, taxes: 0 }; };
    filteredFinanceTenants.forEach(t => {
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
  }, [filteredFinanceTenants]);

  const providerRecap = useMemo(() => {
    const recap = {};
    filteredFinanceTenants.forEach(t => {
      const month = t.paymentDate.substring(0, 7);
      t.resExpenses?.forEach(exp => {
        const key = `${month}_${exp.person}`;
        if (!recap[key]) recap[key] = { month, person: exp.person, total: 0 };
        recap[key].total += (parseFloat(exp.amount) || 0);
      });
    });
    return Object.values(recap).sort((a,b) => b.month.localeCompare(a.month));
  }, [filteredFinanceTenants]);

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
    const payYears = tenants.filter(t => t.paymentDate).map(t => new Date(t.paymentDate).getFullYear());
    return [...new Set([...years, ...payYears])].sort((a, b) => b - a);
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
            { id: 'planning', label: 'Planning', icon: <CalendarIcon size={16}/> },
            { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={16}/> },
            { id: 'finances', label: 'Finances', icon: <Calculator size={16}/> },
            { id: 'settings', label: 'Paramètres', icon: <Settings size={16}/> }
          ].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t">
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl flex items-center justify-between text-[9px] font-black uppercase">
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Cloud Connecté</div>
          </div>
        </div>
      </aside>

      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b sticky top-0 z-30">
        <h1 className="font-black text-blue-600 uppercase tracking-tighter">ImmoGérer</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2"><Menu /></button>
      </div>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto h-screen custom-scrollbar">
        <div className="max-w-6xl mx-auto pb-24">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Tableau de bord</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Encaissé (Banque)</p><p className="text-2xl font-black text-indigo-600">{financials.netB.toLocaleString('fr-FR')}€</p></div>
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
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                      <Filter size={14} className="text-slate-400" />
                      <select value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)} className="text-[10px] font-black uppercase outline-none bg-transparent cursor-pointer">
                        <option value="all">Logements</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="text-[10px] font-black border rounded-xl p-2 uppercase bg-white cursor-pointer"><option value="all">Mois</option>{['Janv','Févr','Mars','Avril','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'].map((m,i)=><option key={i} value={i}>{m}</option>)}</select>
                    <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="text-[10px] font-black border rounded-xl p-2 uppercase bg-white cursor-pointer"><option value="all">Années</option>{yearsAvailable.map(y=><option key={y} value={y}>{y}</option>)}</select>
                  </div>
                </div>
                <button onClick={() => { 
                  if (properties.length === 0) { alert("Créez d'abord un bien dans l'onglet Paramètres"); return; }
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
                      <tr><td colSpan="5" className="p-10 text-center text-slate-400 font-medium italic">Aucune réservation trouvée pour ces filtres.</td></tr>
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
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-black uppercase tracking-widest">Analyse Comptable</h2>
                <div className="flex flex-wrap gap-2">
                   <select value={finFilterMonth} onChange={e => setFinFilterMonth(e.target.value)} className="text-[10px] font-black border rounded-xl p-2 uppercase bg-white cursor-pointer"><option value="all">Tous les mois</option>{['Janv','Févr','Mars','Avril','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'].map((m,i)=><option key={i} value={i}>{m}</option>)}</select>
                   <select value={finFilterYear} onChange={e => setFinFilterYear(e.target.value)} className="text-[10px] font-black border rounded-xl p-2 uppercase bg-white cursor-pointer"><option value="all">Toutes les années</option>{yearsAvailable.map(y=><option key={y} value={y}>{y}</option>)}</select>
                   <select value={finFilterProp} onChange={e => setFinFilterProp(e.target.value)} className="text-[10px] font-black border rounded-xl p-2 uppercase bg-white cursor-pointer"><option value="all">Tous les biens</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                   <select value={finFilterPlat} onChange={e => setFinFilterPlat(e.target.value)} className="text-[10px] font-black border rounded-xl p-2 uppercase bg-white cursor-pointer"><option value="all">Toutes les plateformes</option>{availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}</select>
                </div>
              </div>

              <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden text-xs">
                <div className="p-5 bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest flex justify-between items-center"><span>Bilan Direct & URSSAF (Filtres actifs)</span><span className="opacity-40">Provision Taxes AE (7.7%)</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 font-black uppercase tracking-widest border-b text-[10px]">
                      <tr><th className="p-5">Période</th><th className="p-5 text-right text-indigo-600 font-black">Total Banque</th><th className="p-5 text-right">URSSAF (Brut)</th><th className="p-5 text-right text-red-400">Taxes</th><th className="p-5 text-right">Frais Services</th><th className="p-5 text-right font-black">Profit Réel</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold">
                      {monthlyRecapData.length === 0 ? (
                        <tr><td colSpan="6" className="p-10 text-center text-slate-400 font-medium italic">Pas de données pour ces critères.</td></tr>
                      ) : (
                        monthlyRecapData.map(([m, d]) => (
                          <tr key={m} className="hover:bg-slate-50 transition-colors">
                            <td className="p-5 capitalize font-black text-slate-800">{formatMonthYear(m)}</td>
                            <td className="p-5 text-right font-black text-indigo-600">{d.totalBank.toLocaleString('fr-FR')}€</td>
                            <td className="p-5 text-right text-slate-400">{d.urssafGross.toLocaleString('fr-FR')}€</td>
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
                   <div className="flex items-center gap-2"><UserCheck className="text-indigo-300" size={20}/> Frais Prestataires (Selon filtres)</div>
                </div>
                <div className="overflow-x-auto text-xs">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                         <tr><th className="p-5">Période</th><th className="p-5">Prestataire</th><th className="p-5 text-right font-black">Total dû</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-bold text-slate-600">
                         {providerRecap.length === 0 ? (
                           <tr><td colSpan="3" className="p-10 text-center text-slate-400 font-medium italic">Aucune charge prestataire.</td></tr>
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

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-8 animate-in fade-in">
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Paramètres & Biens</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Plateformes */}
                <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-col h-full">
                  <h3 className="text-[11px] font-black uppercase tracking-widest mb-4 text-slate-400">Plateformes</h3>
                  <div className="space-y-1.5 mb-6 flex-1 overflow-y-auto max-h-[250px]">{availablePlatforms.map(p => (<div key={p} className="flex justify-between items-center text-xs font-bold bg-slate-50 p-3 rounded-xl hover:bg-slate-100">{p}<button onClick={() => { const n = availablePlatforms.filter(x => x !== p); setAvailablePlatforms(n); updateSettings({ platforms: n }); }} className="text-slate-300 hover:text-red-500"><X size={14} /></button></div>))}</div>
                  <form onSubmit={(e) => { e.preventDefault(); if (inputPlat.trim()) { const n = [...availablePlatforms, inputPlat.trim()]; setAvailablePlatforms(n); updateSettings({ platforms: n }); setInputPlat(''); } }} className="flex gap-2"><input value={inputPlat} onChange={e => setInputPlat(e.target.value)} className="flex-1 p-3 bg-slate-50 border rounded-xl font-bold text-xs outline-none" placeholder="Ajouter..." /><button type="submit" className="bg-slate-900 text-white p-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-md"><Plus size={18} /></button></form>
                </div>
                
                {/* Prestataires */}
                <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-col h-full">
                  <h3 className="text-[11px] font-black uppercase tracking-widest mb-4 text-slate-400">Prestataires</h3>
                  <div className="space-y-1.5 mb-6 flex-1 overflow-y-auto max-h-[250px]">{availableProviders.map(p => (<div key={p} className="flex justify-between items-center text-xs font-bold bg-slate-50 p-3 rounded-xl hover:bg-slate-100">{p}<button onClick={() => { const n = availableProviders.filter(x => x !== p); setAvailableProviders(n); updateSettings({ providers: n }); }} className="text-slate-300 hover:text-red-500"><X size={14} /></button></div>))}</div>
                  <form onSubmit={(e) => { e.preventDefault(); if (inputProv.trim()) { const n = [...availableProviders, inputProv.trim()]; setAvailableProviders(n); updateSettings({ providers: n }); setInputProv(''); } }} className="flex gap-2"><input value={inputProv} onChange={e => setInputProv(e.target.value)} className="flex-1 p-3 bg-slate-50 border rounded-xl font-bold text-xs outline-none" placeholder="Prénom..." /><button type="submit" className="bg-slate-900 text-white p-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-md"><Plus size={18} /></button></form>
                </div>

                {/* Types Services */}
                <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-col h-full">
                  <h3 className="text-[11px] font-black uppercase tracking-widest mb-4 text-slate-400">Types Services</h3>
                  <div className="space-y-1.5 mb-6 flex-1 overflow-y-auto max-h-[250px]">{availableServiceTypes.map(p => (<div key={p} className="flex justify-between items-center text-xs font-bold bg-slate-50 p-3 rounded-xl hover:bg-slate-100">{p}<button onClick={() => { const n = availableServiceTypes.filter(x => x !== p); setAvailableServiceTypes(n); updateSettings({ services: n }); }} className="text-slate-300 hover:text-red-500"><X size={14} /></button></div>))}</div>
                  <form onSubmit={(e) => { e.preventDefault(); if (inputSvc.trim()) { const n = [...availableServiceTypes, inputSvc.trim()]; setAvailableServiceTypes(n); updateSettings({ services: n }); setInputSvc(''); } }} className="flex gap-2"><input value={inputSvc} onChange={e => setInputSvc(e.target.value)} className="flex-1 p-3 bg-slate-50 border rounded-xl font-bold text-xs outline-none" placeholder="Service..." /><button type="submit" className="bg-slate-900 text-white p-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-md"><Plus size={18} /></button></form>
                </div>

                {/* LOGEMENTS (Anciennement "Mes Biens") */}
                <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-col h-full border-blue-100 border-2">
                  <h3 className="text-[11px] font-black uppercase tracking-widest mb-4 text-blue-600 flex items-center gap-2"><Home size={14}/> Mes Logements</h3>
                  <div className="space-y-2 mb-6 flex-1 overflow-y-auto max-h-[250px]">
                    {properties.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">Aucun bien enregistré.</p>
                    ) : (
                      properties.map(p => (
                        <div key={p.id} className="flex justify-between items-start bg-blue-50 p-3 rounded-xl hover:bg-blue-100 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{p.name}</p>
                            <p className="text-[9px] text-slate-500 truncate">{p.address}</p>
