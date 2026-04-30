import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, addDoc, query } from 'firebase/firestore';
import { 
  Home, Euro, LayoutDashboard, Plus, Trash2, MapPin, Calendar as CalendarIcon,
  Menu, X, CalendarCheck, CheckCircle, Clock, PieChart as PieChartIcon,
  ChevronLeft, ChevronRight, BarChart3, List, Wallet, Settings, Calculator,
  UserCheck, PlusCircle, TrendingUp, Info, Filter, Loader2,
  Building2, CalendarRange, MessageSquare, CreditCard, Activity, ArrowRight,
  User, Sparkles, Key, FileInput, UploadCloud, AlertTriangle, Check
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
              <circle key={i} r="15.9155" cx="16" cy="16" fill="transparent" stroke={slice.color} strokeWidth="5" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" />
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
    const details = encodeURIComponent(`Client: ${res.name}\nLogement: ${prop?.name || ''}\nPlateforme: ${res.platform}\nNotes: ${res.comment || ''}`);
    const dates = `${res.startDate.replace(/-/g, '')}/${res.endDate.replace(/-/g, '')}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
  };

  // --- ETATS ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reservations');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [availablePlatforms, setAvailablePlatforms] = useState(['Airbnb', 'Booking', 'Abritel', 'En direct', 'Autre']);
  const [availableProviders, setAvailableProviders] = useState(['Justine', 'Marc', 'Stéphanie']);
  const [availableServiceTypes, setAvailableServiceTypes] = useState(['Ménage', 'Entrée/Sortie', 'Piscine', 'Divers']);

  // --- FILTRES ---
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterProp, setFilterProp] = useState('all');
  const [filterPlat, setFilterPlat] = useState('all');
  const [filterProv, setFilterProv] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResId, setEditingResId] = useState(null);
  const [formData, setFormData] = useState({ 
    propertyId: '', name: '', startDate: '', endDate: '', paymentDate: '', 
    platform: 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', 
    bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [],
    comment: ''
  });

  const [inputPlat, setInputPlat] = useState('');
  const [inputProv, setInputProv] = useState('');
  const [inputSvc, setInputSvc] = useState('');
  const [inputProp, setInputProp] = useState({ name: '', address: '' });
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [reviewList, setReviewList] = useState([]);

  // --- AUTH ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else await signInAnonymously(auth);
      } catch(e) { setUser({uid: 'local-test-user'}); setLoading(false); }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => { if (u) { setUser(u); setLoading(false); } });
    return () => unsub();
  }, []);

  // --- LECTURE CLOUD ---
  useEffect(() => {
    if (!user) return;
    const unsubProps = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), (snap) => {
      setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTenants = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), (snap) => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.platforms) setAvailablePlatforms(d.platforms);
        if (d.providers) setAvailableProviders(d.providers);
        if (d.services) setAvailableServiceTypes(d.services);
      }
    });
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
    const g = isC ? (parseFloat(formData.displayedAmount || 0) - (parseFloat(formData.cityTax || 0))) : parseFloat(formData.grossAmount || 0);
    const n = isC ? g - (parseFloat(formData.platformFees || 0) + (parseFloat(formData.bankFees || 0))) : g - parseFloat(formData.platformFees || 0);
    const d = { ...formData, grossAmount: g, netAmount: n, resExpenses: (formData.resExpenses || []).map(r => ({ ...r, amount: parseFloat(r.amount) || 0 })) };
    if (editingResId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', editingResId), d);
    else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), d);
    setIsModalOpen(false);
  };

  const deleteRes = async (id) => {
    if(window.confirm("Supprimer cette réservation ?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', id));
      setIsModalOpen(false);
    }
  };

  // --- IMPORT CSV ---
  const parseCSVLine = (text) => {
    const result = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
        else current += char;
    }
    result.push(current);
    return result;
  };

  const startReview = () => {
    if (!importText.trim()) return;
    const lines = importText.split('\n');
    const newList = [];
    lines.forEach((line, index) => {
        if (line.toLowerCase().includes('date') || line.trim() === '') return;
        const parts = parseCSVLine(line);
        if (parts.length < 10) return;
        const guestName = parts[7]?.trim();
        const formatDate = (raw) => {
            const [m, d, y] = raw.split('/');
            return (m && d && y) ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
        };
        const startDate = formatDate(parts[4]?.trim());
        const endDate = formatDate(parts[5]?.trim());
        const gross = parseFloat((parts[15] || parts[12]).replace('€', '').replace(' ', '')) || 0;
        const fees = parseFloat(parts[13].replace('€', '').replace(' ', '')) || 0;
        const listingName = parts[8]?.trim();
        const matchedProp = properties.find(p => listingName.toLowerCase().includes(p.name.toLowerCase()));
        const isDuplicate = tenants.some(t => t.name === guestName && t.startDate === startDate);
        newList.push({ id: index, propertyId: matchedProp?.id || '', propertyName: matchedProp?.name || listingName, name: guestName, startDate, endDate, grossAmount: gross, platformFees: fees, netAmount: gross - fees, isDuplicate, selected: !isDuplicate });
    });
    setReviewList(newList);
  };

  const confirmImport = async () => {
      for (let item of reviewList.filter(i => i.selected && i.propertyId)) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), { ...item, platform: 'Airbnb', isUrssaf: true, comment: 'Importé via CSV', resExpenses: [] });
      }
      setReviewList([]); setImportText(''); setImportStatus('Importation réussie !');
      setTimeout(() => setImportStatus(''), 5000);
  };

  // --- LOGIQUE FILTRAGE & TRI ---
  const filteredData = useMemo(() => {
    return tenants.filter(t => {
      const dateRef = t.startDate ? new Date(t.startDate) : new Date();
      return (filterYear === 'all' || dateRef.getFullYear() === parseInt(filterYear)) &&
             (filterMonth === 'all' || dateRef.getMonth() === parseInt(filterMonth)) &&
             (filterProp === 'all' || t.propertyId === filterProp) &&
             (filterPlat === 'all' || t.platform === filterPlat) &&
             (filterProv === 'all' || (t.resExpenses && t.resExpenses.some(e => e.person === filterProv)));
    });
  }, [tenants, filterYear, filterMonth, filterProp, filterPlat, filterProv]);

  const financials = useMemo(() => {
    const paid = filteredData.filter(t => !!t.paymentDate);
    const upcoming = filteredData.filter(t => !t.paymentDate);
    const netB = paid.reduce((a, t) => a + (t.netAmount || 0), 0);
    const taxes = paid.filter(t => t.isUrssaf).reduce((a, t) => a + (t.grossAmount || 0), 0) * 0.077;
    const exp = paid.reduce((a, t) => a + (t.resExpenses?.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) || 0), 0);
    return { netB, taxes, exp, profit: netB - exp - taxes, netUpcoming: upcoming.reduce((a, t) => a + (t.netAmount || 0), 0) };
  }, [filteredData]);

  const monthlyRecapData = useMemo(() => {
    const stats = {};
    filteredData.filter(t => !!t.paymentDate).forEach(t => {
      const m = t.paymentDate.substring(0, 7);
      if(!stats[m]) stats[m] = { totalBank: 0, urssafGross: 0, directNet: 0, charges: 0, taxes: 0 };
      stats[m].totalBank += (t.netAmount || 0);
      if (t.isUrssaf) { stats[m].urssafGross += (t.grossAmount || 0); stats[m].taxes += (t.grossAmount || 0) * 0.077; }
      else stats[m].directNet += (t.netAmount || 0);
      stats[m].charges += (t.resExpenses?.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0) || 0);
    });
    return Object.entries(stats).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredData]);

  const detailedExpenses = useMemo(() => {
    const list = [];
    filteredData.forEach(t => {
      (t.resExpenses || []).forEach(exp => {
        if (filterProv === 'all' || exp.person === filterProv) {
          list.push({ id: `${t.id}-${exp.id}`, propertyName: properties.find(p => p.id === t.propertyId)?.name || '--', dateRes: t.startDate, person: exp.person, type: exp.type, amount: parseFloat(exp.amount) || 0, paymentDate: exp.paymentDate || '' });
        }
      });
    });
    return list.sort((a, b) => b.dateRes.localeCompare(a.dateRes));
  }, [filteredData, properties, filterProv]);

  const reservationsList = useMemo(() => {
    return filteredData.filter(t => {
      if (filterStatus === 'paid') return !!t.paymentDate;
      if (filterStatus === 'pending') return !t.paymentDate;
      return true;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [filteredData, filterStatus]);

  const agendaDays = useMemo(() => {
    const y = filterYear === 'all' ? new Date().getFullYear() : parseInt(filterYear);
    const m = filterMonth === 'all' ? new Date().getMonth() : parseInt(filterMonth);
    const firstDay = new Date(y, m, 1), lastDay = new Date(y, m + 1, 0), days = [];
    let offset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < offset; i++) days.push({ empty: true });
    for (let i = 1; i <= lastDay.getDate(); i++) days.push({ day: i, dateStr: `${y}-${(m+1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}` });
    return days;
  }, [filterYear, filterMonth]);

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-black uppercase text-xs"><Loader2 className="animate-spin text-blue-600 mr-2" /> Chargement CADEL MANAGER...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      <aside className={`fixed md:sticky top-0 left-0 z-50 w-72 h-full md:h-screen bg-white border-r border-slate-100 flex flex-col transform md:translate-x-0 transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 border-b border-slate-50 flex flex-col items-center">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-4 rounded-2xl text-white shadow-xl shadow-blue-200 mb-2"><Building2 size={28} /></div>
          <h1 className="font-black uppercase tracking-tighter text-2xl">CADEL</h1><h2 className="font-black uppercase tracking-[0.3em] text-[10px] text-blue-600">MANAGER</h2>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {[{ id: 'reservations', label: 'Réservations', icon: <List size={18}/> }, { id: 'agenda', label: 'Agenda', icon: <CalendarRange size={18}/> }, { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={18}/> }, { id: 'finances', label: 'Finances', icon: <Calculator size={18}/> }, { id: 'settings', label: 'Paramètres', icon: <Settings size={18}/> }].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full text-left px-5 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-2xl translate-x-2' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>{item.icon} {item.label}</button>
          ))}
        </nav>
      </aside>

      <div className="md:hidden flex items-center justify-between p-5 bg-white border-b sticky top-0 z-40 shadow-sm"><div className="flex items-center gap-2"><div className="bg-blue-600 p-1.5 rounded-lg text-white"><Building2 size={16}/></div><h1 className="font-black uppercase text-sm">CADEL MANAGER</h1></div><button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">{isMobileMenuOpen ? <X /> : <Menu />}</button></div>

      <main className="flex-1 p-4 md:p-12 overflow-y-auto h-screen custom-scrollbar">
        <div className="max-w-7xl mx-auto pb-32">
          <RenderFilters />

          {activeTab === 'reservations' && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center"><h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Réservations</h2><button onClick={() => { setEditingResId(null); setFormData({ propertyId: properties[0]?.id || '', name: '', startDate: '', endDate: '', paymentDate: '', platform: availablePlatforms[0] || 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [], comment: '' }); setIsModalOpen(true); }} className="bg-blue-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-[20px] font-black text-[10px] uppercase shadow-xl hover:bg-blue-700 transition-all">+ Nouvelle</button></div>
              <div className="grid grid-cols-1 gap-4 md:hidden">{reservationsList.map(t => (
                  <div key={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="bg-white p-6 rounded-[32px] shadow-lg border border-slate-50"><div className="flex justify-between items-start mb-3"><div><h3 className="text-base font-black uppercase tracking-tighter">{properties.find(p => p.id === t.propertyId)?.name || '--'}</h3><div className="flex gap-2 mt-1"><span className="text-[9px] font-black text-blue-600 uppercase">{t.platform}</span><span className="text-[9px] font-bold text-slate-400">{t.name}</span></div></div><span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${t.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{t.paymentDate ? 'Payé' : 'Dû'}</span></div><div className="bg-slate-50 p-3 rounded-2xl flex justify-between text-xs font-black"><span>{t.startDate}</span><ArrowRight size={14} className="text-slate-300"/><span>{t.endDate}</span></div><div className="mt-3 text-right font-black text-lg">{(t.netAmount || 0).toFixed(2)}€</div></div>
              ))}</div>
              <div className="hidden md:block bg-white rounded-[40px] shadow-2xl overflow-hidden text-xs"><table className="w-full text-left min-w-[900px]"><thead className="bg-slate-50 font-black uppercase border-b text-slate-400"><tr><th className="p-6">Bien / Plateforme</th><th className="p-6">Client</th><th className="p-6 text-center">Dates</th><th className="p-6">Services</th><th className="p-6 text-right">Net Perçu</th><th className="p-6 text-center">État</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold">{reservationsList.map(t => (<tr key={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="hover:bg-slate-50 cursor-pointer"><td className="p-6"><div><div className="font-black uppercase">{properties.find(p => p.id === t.propertyId)?.name || '--'}</div><div className="text-blue-600 text-[9px] uppercase tracking-widest">{t.platform}</div></div></td><td className="p-6 text-sm">{t.name}</td><td className="p-6 text-center text-slate-500">{t.startDate} ➔ {t.endDate}</td><td className="p-6">{(t.resExpenses || []).map((e,i)=>(<div key={i} className="text-[9px] bg-slate-50 p-1 mb-1 rounded flex justify-between uppercase"><span>{e.type}</span><span className={e.paymentDate ? 'text-emerald-600' : 'text-orange-500'}>{e.amount}€</span></div>))}</td><td className="p-6 text-right font-black text-base">{(t.netAmount || 0).toFixed(2)}€</td><td className="p-6 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${t.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{t.paymentDate ? `Payé` : 'Attente'}</span></td></tr>))}</tbody></table></div>
            </div>
          )}

          {activeTab === 'finances' && (
            <div className="space-y-8 animate-in fade-in">
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Comptabilité</h2>
              <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden text-xs"><div className="p-6 bg-slate-900 text-white font-black uppercase flex justify-between items-center"><div className="flex items-center gap-2"><Calculator size={18} className="text-blue-400"/> Bilan Global</div><span className="opacity-40">Tax 7.7%</span></div><div className="overflow-x-auto"><table className="w-full text-left min-w-[700px]"><thead className="bg-slate-50 uppercase text-[9px] text-slate-400"><tr><th className="p-6">Période</th><th className="p-6 text-right">Banque</th><th className="p-6 text-right text-rose-500">Taxes</th><th className="p-6 text-right">Services</th><th className="p-4 md:p-6 text-right font-black">Profit Réel</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold">{monthlyRecapData.map(([m, d]) => (<tr key={m}><td className="p-6 capitalize">{formatMonthYear(m)}</td><td className="p-6 text-right text-indigo-600">{d.totalBank.toLocaleString('fr-FR')}€</td><td className="p-6 text-right text-rose-500">-{d.taxes.toFixed(2)}€</td><td className="p-6 text-right text-slate-500">-{d.charges.toLocaleString('fr-FR')}€</td><td className={`p-6 text-right font-black ${d.totalBank - d.taxes - d.charges >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{(d.totalBank - d.taxes - d.charges).toLocaleString('fr-FR')}€</td></tr>))}</tbody><tfoot className="bg-indigo-600 text-white font-black text-lg"><tr><td className="p-6 uppercase text-[10px]">TOTAL FILTRÉ</td><td className="p-6 text-right">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0).toLocaleString('fr-FR')}€</td><td colSpan="2"></td><td className="p-6 text-right bg-indigo-700/50">{(monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0) - monthlyRecapData.reduce((acc, [m, d]) => acc + d.taxes + d.charges, 0)).toLocaleString('fr-FR')}€</td></tr></tfoot></table></div></div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-10 animate-in fade-in"><h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Paramètres</h2><div className="bg-white p-8 rounded-[40px] border-2 border-dashed border-slate-200 shadow-xl shadow-slate-100 flex flex-col items-center justify-center text-center group hover:border-blue-400 transition-all"><div className="bg-blue-50 p-4 rounded-3xl text-blue-600 mb-4 group-hover:scale-110 transition-transform"><UploadCloud size={40}/></div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Importation intelligente Airbnb</h3><p className="text-xs text-slate-400 mt-2 max-w-md">Copiez et collez vos lignes CSV pour analyser les nouvelles réservations et éviter les doublons.</p><textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Date,Type,Confirmation Code..." className="w-full mt-6 p-4 bg-slate-50 border border-slate-100 rounded-3xl min-h-[150px] font-mono text-[10px] outline-none focus:border-blue-300" />{importStatus && <p className="mt-4 text-xs font-black text-emerald-600 uppercase tracking-widest">{importStatus}</p>}{reviewList.length > 0 && (<div className="w-full mt-6 overflow-x-auto"><table className="w-full text-left text-[10px] font-bold border-collapse min-w-[600px]"><thead className="bg-slate-50 uppercase tracking-widest text-slate-400 border-b"><tr><th className="p-3 text-center">Imp.</th><th className="p-3">Client / Dates</th><th className="p-3">Logement</th><th className="p-3">Statut</th></tr></thead><tbody>{reviewList.map(item => (<tr key={item.id} className={`border-b ${item.isDuplicate ? 'bg-orange-50/50' : 'bg-white'}`}><td className="p-3 text-center"><input type="checkbox" checked={item.selected} onChange={() => setReviewList(reviewList.map(r => r.id === item.id ? {...r, selected: !r.selected} : r))} /></td><td className="p-3"><div>{item.name}</div><div className="text-[9px] text-slate-400">{item.startDate} ➔ {item.endDate}</div></td><td className="p-3 uppercase">{item.propertyName}</td><td className="p-3">{item.isDuplicate ? (<span className="flex items-center gap-1 text-orange-600 uppercase text-[8px] font-black"><AlertTriangle size={10}/> Doublon</span>) : (<span className="flex items-center gap-1 text-emerald-600 uppercase text-[8px] font-black"><Check size={10}/> Nouveau</span>)}</td></tr>))}</tbody></table></div>)}<div className="flex gap-4 w-full mt-8">{reviewList.length === 0 ? (<button onClick={startReview} disabled={!importText.trim()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-[2px] shadow-xl hover:bg-blue-600 transition-all">Lancer l'analyse</button>) : (<button onClick={confirmImport} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-[2px] shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3"><UploadCloud size={18}/> Confirmer l'importation ({reviewList.filter(r => r.selected).length})</button>)}</div></div></div>
          )}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-[40px] md:rounded-[60px] shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col scale-in-center overflow-hidden border border-slate-100">
            <div className="p-6 md:p-10 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10 text-xs text-[10px]">
              <div className="flex items-center gap-4 text-blue-600"><div className="bg-blue-50 p-2 md:p-3 rounded-2xl"><CalendarCheck size={24} /></div><div><h3 className="font-black text-xl md:text-2xl tracking-tight text-slate-900 leading-none uppercase">Réservation</h3></div></div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={saveRes} className="p-6 md:p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-1"><label className="text-[10px] font-black uppercase ml-3 text-slate-400">Bien</label><select required value={formData.propertyId} onChange={e => setFormData({ ...formData, propertyId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[20px] font-black outline-none focus:border-blue-300">{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="space-y-1"><label className="text-[10px] font-black uppercase ml-3 text-slate-400">Voyageur</label><input required placeholder="Nom complet" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[20px] font-black outline-none" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black uppercase ml-3 text-slate-400">Arrivée</label><input type="date" required value={formData.startDate || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[20px] font-black outline-none" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black uppercase ml-3 text-slate-400">Départ</label><input type="date" required value={formData.endDate || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[20px] font-black outline-none" /></div>
                <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black uppercase ml-3 text-slate-400">Notes</label><textarea placeholder="Notes particulières..." value={formData.comment || ''} onChange={e => setFormData({ ...formData, comment: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[20px] font-bold outline-none focus:border-blue-300 min-h-[80px] resize-none" /></div>
              </div>
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-6 md:p-8 rounded-[40px] border border-blue-50 space-y-6">
                <div className="flex justify-between items-center font-black text-[11px] uppercase text-blue-900 border-b border-blue-100 pb-2"><div className="flex items-center gap-2"><Euro size={16}/> Finances</div><select value={formData.platform} onChange={e => setFormData({ ...formData, platform: e.target.value })} className="bg-white border border-blue-100 rounded-xl px-3 py-1.5 text-blue-600 shadow-sm outline-none">{availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                {formData.platform === 'Booking' || formData.platform === 'Abritel' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]"><div><label className="font-black uppercase text-slate-400 ml-1">Prix Client</label><input type="number" step="0.01" value={formData.displayedAmount || ''} onChange={e => setFormData({ ...formData, displayedAmount: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black" /></div><div><label className="font-black uppercase text-rose-400 ml-1">Taxe Séjour</label><input type="number" step="0.01" value={formData.cityTax || ''} onChange={e => setFormData({ ...formData, cityTax: e.target.value })} className="w-full p-3 border border-rose-100 rounded-xl font-black text-rose-500 bg-rose-50/20" /></div><div className="md:col-span-2 flex justify-between bg-slate-900 p-3 rounded-xl text-white font-black uppercase"><span>Brut URSSAF</span><span>{(parseFloat(formData.displayedAmount || 0) - (parseFloat(formData.cityTax || 0))).toFixed(2)}€</span></div></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]"><div><label className="font-black uppercase text-slate-400 ml-1">Brut URSSAF</label><input type="number" step="0.01" value={formData.grossAmount || ''} onChange={e => setFormData({ ...formData, grossAmount: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black" /></div><div><label className="font-black uppercase text-slate-400 ml-1">Comm. plateforme</label><input type="number" step="0.01" value={formData.platformFees || ''} onChange={e => setFormData({ ...formData, platformFees: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black" /></div></div>
                )}
                <div className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-sm"><input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={!!formData.isUrssaf} onChange={e => setFormData({ ...formData, isUrssaf: e.target.checked })} /><span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Provisionner taxes AE (7.7%)</span></div>
              </div>
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3"><span className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><UserCheck size={16}/> Prestations</span><button type="button" onClick={() => setFormData({ ...formData, resExpenses: [...(formData.resExpenses || []), { id: Date.now().toString(), person: availableProviders[0] || '', type: availableServiceTypes[0] || '', amount: 0, paymentDate: '' }] })} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-md hover:scale-105 tracking-widest transition-all">+ Ajouter</button></div>
                <div className="space-y-3">{(formData.resExpenses || []).map(exp => (
                    <div key={exp.id} className="flex flex-col bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-3">
                      <div className="flex gap-3 items-center">
                        <select value={exp.person} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, person: e.target.value } : x) })} className="flex-1 p-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase bg-white w-0 shrink">{availableProviders.map(p => <option key={p} value={p}>{p}</option>)}</select>
                        <select value={exp.type} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 p-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase bg-white w-0 shrink">{availableServiceTypes.map(p => <option key={p} value={p}>{p}</option>)}</select>
                        <div className="flex items-center gap-1 bg-white px-2 py-1.5 rounded-xl border border-slate-200 shrink-0"><input type="number" value={exp.amount || ''} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, amount: e.target.value } : x) })} className="w-10 font-black text-right text-xs outline-none" /><span className="text-slate-300 font-bold">€</span></div>
                        <button type="button" onClick={() => setFormData({ ...formData, resExpenses: formData.resExpenses.filter(x => x.id !== exp.id) })} className="text-slate-300 hover:text-rose-500 shrink-0 transition-colors"><Trash2 size={18} /></button>
                      </div>
                      <div className="flex items-center gap-3 border-t border-slate-200/50 pt-2">
                         <span className="text-[9px] font-black uppercase text-slate-400 shrink-0">Réglé :</span>
                         <input type="date" value={exp.paymentDate || ''} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, paymentDate: e.target.value } : x) })} className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black outline-none w-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`p-6 md:p-8 rounded-[32px] md:rounded-[40px] border-2 flex flex-col md:flex-row items-center justify-between transition-all shadow-xl gap-4 ${formData.paymentDate ? 'bg-emerald-50/50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}><div className="text-center md:text-left"><h4 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-900 leading-none text-slate-900 uppercase">Paiement Global</h4><p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase mt-1.5">Date en banque</p></div><input type="date" value={formData.paymentDate || ''} onChange={e => setFormData({ ...formData, paymentDate: e.target.value })} className="w-full md:w-auto p-3 border border-slate-200 rounded-[15px] font-black bg-white shadow-lg outline-none" /></div>
              <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-slate-100 gap-6"><div className="text-center md:text-left"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-2 uppercase">Profit Net Estimé</p><p className="text-2xl md:text-3xl font-black text-blue-600 tracking-tighter">{(nModale - curChargesModale - (formData.isUrssaf ? ((parseFloat(formData.displayedAmount || 0) - parseFloat(formData.cityTax || 0)) * 0.077) : 0)).toFixed(2)}€</p></div><div className="flex gap-3 w-full md:w-auto">{editingResId && <button type="button" onClick={() => deleteRes(editingResId)} className="flex-1 md:flex-none px-6 py-4 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 rounded-[20px] transition-colors">Supprimer</button>}<button type="submit" className="flex-1 md:flex-none bg-slate-900 text-white px-8 md:px-10 py-4 rounded-[20px] font-black shadow-2xl hover:bg-blue-600 uppercase tracking-widest text-[10px] transition-all">Enregistrer</button></div></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPOSANT FILTRES (Fixed reference) ---
const RenderFilters = ({filterYear, setFilterYear, filterMonth, setFilterMonth, filterProp, setFilterProp, filterPlat, setFilterPlat, filterProv, setFilterProv, yearsAvailable, properties, availablePlatforms, availableProviders, activeTab, filterStatus, setFilterStatus}) => (
    <div className="flex flex-wrap items-center gap-2 bg-white/70 backdrop-blur-md p-3 rounded-[28px] border border-white shadow-xl shadow-slate-200/50 mb-6 md:mb-8 animate-in slide-in-from-top-4">
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <Filter size={12} className="text-slate-400" />
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="text-[10px] font-black uppercase bg-transparent cursor-pointer outline-none text-slate-600">
          <option value="all">Années</option>
          {yearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="text-[10px] font-black uppercase bg-transparent cursor-pointer outline-none text-slate-600"><option value="all">Mois (Tous)</option>{['Janv','Févr','Mars','Avril','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'].map((m,i)=><option key={i} value={i}>{m}</option>)}</select>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterProp} onChange={e => setFilterProp(e.target.value)} className="text-[10px] font-black uppercase bg-transparent cursor-pointer outline-none text-slate-600 max-w-[100px] md:max-w-[130px]"><option value="all">Logements</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterPlat} onChange={e => setFilterPlat(e.target.value)} className="text-[10px] font-black uppercase bg-transparent cursor-pointer outline-none text-slate-600"><option value="all">Plateformes</option>{availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}</select>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterProv} onChange={e => setFilterProv(e.target.value)} className="text-[10px] font-black uppercase bg-transparent cursor-pointer outline-none text-slate-600"><option value="all">Prestataires</option>{availableProviders.map(p => <option key={p} value={p}>{p}</option>)}</select>
      </div>
      {(activeTab === 'reservations' || activeTab === 'agenda') && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50/50 rounded-2xl border border-blue-100 md:ml-auto w-full md:w-auto">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-[10px] font-black uppercase bg-transparent text-blue-600 cursor-pointer outline-none w-full"><option value="all">Tous les statuts</option><option value="paid">Payé</option><option value="pending">En attente</option></select>
        </div>
      )}
    </div>
);

export default App;
