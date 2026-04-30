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
  User, Sparkles, Key, UploadCloud, AlertTriangle, Check
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
  const visibleData = (data || []).filter(d => d.value > 0);
  const displayTotal = visibleData.reduce((acc, curr) => acc + curr.value, 0);
  let cumulativePercent = 0;

  if (!displayTotal) {
    return (
      <div className="bg-white p-6 rounded-[40px] border border-gray-100 flex flex-col items-center justify-center min-h-[300px] shadow-sm">
        <PieChartIcon size={24} className="text-gray-200 mb-2" />
        <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest text-center">{title}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-10 rounded-[48px] border border-gray-50 flex flex-col md:flex-row items-center gap-10 animate-in fade-in shadow-xl shadow-slate-200/50">
      <div className="relative w-48 h-48 flex-shrink-0">
        <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90">
          {visibleData.map((slice, i) => {
            const percent = (slice.value / displayTotal) * 100;
            const strokeDasharray = `${percent} ${100 - percent}`;
            const strokeDashoffset = -cumulativePercent;
            cumulativePercent += percent;
            return (
              <circle key={i} r="15.9155" cx="16" cy="16" fill="transparent" stroke={slice.color} strokeWidth="5" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000" />
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
                <span className="font-bold text-slate-600 truncate max-w-[140px]">{slice.label}</span>
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
  // HELPERS
  const formatMonthYear = (m) => {
    if (!m) return "";
    const [year, month] = m.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
  };

  const getGoogleCalendarUrl = (res, prop) => {
    if (!res.startDate || !res.endDate) return '#';
    const text = encodeURIComponent(`Reservation: ${res.name} - ${prop?.name || ''}`);
    const details = encodeURIComponent(`Client: ${res.name}\nLogement: ${prop?.name || ''}\nPlateforme: ${res.platform}\nNotes: ${res.comment || ''}`);
    const dates = `${res.startDate.replace(/-/g, '')}/${res.endDate.replace(/-/g, '')}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
  };

  // ETATS
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reservations');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [availablePlatforms, setAvailablePlatforms] = useState(['Airbnb', 'Booking', 'Abritel', 'En direct']);
  const [availableProviders, setAvailableProviders] = useState(['Justine', 'Marc']);
  const [availableServiceTypes, setAvailableServiceTypes] = useState(['Ménage', 'Entrée/Sortie']);

  // FILTRES PAR DEFAUT
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterProp, setFilterProp] = useState('all');
  const [filterPlat, setFilterPlat] = useState('all');
  const [filterProv, setFilterProv] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // FORMULAIRE
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResId, setEditingResId] = useState(null);
  const [formData, setFormData] = useState({ 
    propertyId: '', name: '', startDate: '', endDate: '', paymentDate: '', 
    platform: 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', 
    bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [], comment: ''
  });

  const [inputPlat, setInputPlat] = useState('');
  const [inputProv, setInputProv] = useState('');
  const [inputSvc, setInputSvc] = useState('');
  const [inputProp, setInputProp] = useState({ name: '', address: '' });
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [reviewList, setReviewList] = useState([]);

  // FIREBASE CONNECTION
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setLoading(false); }
      else signInAnonymously(auth);
    });
    const unsubProps = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), (snap) => setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTenants = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), (snap) => setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.platforms) setAvailablePlatforms(d.platforms);
        if (d.providers) setAvailableProviders(d.providers);
        if (d.services) setAvailableServiceTypes(d.services);
      }
    });
    return () => { unsubAuth(); unsubProps(); unsubTenants(); unsubSettings(); };
  }, []);

  const saveRes = async (e) => {
    e.preventDefault();
    if (!formData.propertyId) return;
    const isC = formData.platform === 'Booking' || formData.platform === 'Abritel';
    const g = isC ? (parseFloat(formData.displayedAmount || 0) - (parseFloat(formData.cityTax || 0))) : parseFloat(formData.grossAmount || 0);
    const n = isC ? g - (parseFloat(formData.platformFees || 0) + (parseFloat(formData.bankFees || 0))) : g - parseFloat(formData.platformFees || 0);
    const d = { ...formData, grossAmount: g, netAmount: n, resExpenses: (formData.resExpenses || []).map(r => ({ ...r, amount: parseFloat(r.amount) || 0 })) };
    if (editingResId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', editingResId), d);
    else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), d);
    setIsModalOpen(false);
  };

  // LOGIQUE FILTRAGE
  const filteredData = useMemo(() => {
    return (tenants || []).filter(t => {
      const dateRef = t.startDate ? new Date(t.startDate) : new Date();
      return (filterYear === 'all' || dateRef.getFullYear() === parseInt(filterYear)) &&
             (filterMonth === 'all' || dateRef.getMonth() === parseInt(filterMonth)) &&
             (filterProp === 'all' || t.propertyId === filterProp) &&
             (filterPlat === 'all' || t.platform === filterPlat) &&
             (filterProv === 'all' || (t.resExpenses && t.resExpenses.some(e => e.person === filterProv)));
    });
  }, [tenants, filterYear, filterMonth, filterProp, filterPlat, filterProv]);

  const reservationsList = useMemo(() => {
    return filteredData.filter(t => {
      if (filterStatus === 'paid') return !!t.paymentDate;
      if (filterStatus === 'pending') return !t.paymentDate;
      return true;
    }).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  }, [filteredData, filterStatus]);

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

  const handleMonthChange = (direction) => {
    let m = filterMonth === 'all' ? new Date().getMonth() : parseInt(filterMonth);
    let y = filterYear === 'all' ? new Date().getFullYear() : parseInt(filterYear);
    if (direction === 'next') { if (m === 11) { m = 0; y += 1; } else m += 1; }
    else { if (m === 0) { m = 11; y -= 1; } else m -= 1; }
    setFilterMonth(m.toString()); setFilterYear(y.toString());
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

  const todayStr = new Date().toISOString().split('T')[0];
  const yearsAvailable = useMemo(() => {
    const years = tenants.map(t => t.startDate ? new Date(t.startDate).getFullYear() : null).filter(Boolean);
    return [...new Set([...years, new Date().getFullYear()])].sort((a,b) => b-a);
  }, [tenants]);

  // IMPORT LOGIQUE
  const parseCSVLine = (text) => {
    const result = []; let current = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
        else current += char;
    }
    result.push(current); return result;
  };

  const startReview = () => {
    const lines = importText.split('\n'); const newList = [];
    lines.forEach((line, index) => {
        if (line.toLowerCase().includes('date') || line.trim() === '') return;
        const parts = parseCSVLine(line);
        if (parts.length < 10) return;
        const guestName = parts[7]?.trim();
        const formatDate = (raw) => { const [m, d, y] = raw.split('/'); return (m && d && y) ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : ''; };
        const startDate = formatDate(parts[4]?.trim());
        const gross = parseFloat((parts[15] || parts[12]).replace('€', '').replace(' ', '')) || 0;
        const fees = parseFloat(parts[13].replace('€', '').replace(' ', '')) || 0;
        const matchedProp = properties.find(p => (parts[8] || "").toLowerCase().includes(p.name.toLowerCase()));
        newList.push({ id: index, propertyId: matchedProp?.id || '', propertyName: matchedProp?.name || parts[8], name: guestName, startDate, endDate: formatDate(parts[5]?.trim()), grossAmount: gross, platformFees: fees, netAmount: gross - fees, isDuplicate: tenants.some(t => t.name === guestName && t.startDate === startDate), selected: !tenants.some(t => t.name === guestName && t.startDate === startDate) });
    });
    setReviewList(newList);
  };

  const confirmImport = async () => {
      for (let item of reviewList.filter(i => i.selected && i.propertyId)) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), { ...item, platform: 'Airbnb', isUrssaf: true, comment: 'Importé', resExpenses: [] });
      }
      setReviewList([]); setImportText(''); setImportStatus('Importation Réussie !');
  };

  const RenderFilters = () => (
    <div className="flex flex-wrap items-center gap-2 bg-white/70 backdrop-blur-md p-3 rounded-[28px] border border-white shadow-xl mb-6 md:mb-8">
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <Filter size={12} className="text-slate-400" />
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none">
          <option value="all">Années</option>{yearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none"><option value="all">Mois (Tous)</option>{['Janv','Févr','Mars','Avril','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'].map((m,i)=><option key={i} value={i}>{m}</option>)}</select>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterProp} onChange={e => setFilterProp(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none max-w-[100px] md:max-w-[130px]"><option value="all">Logements</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterPlat} onChange={e => setFilterPlat(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none"><option value="all">Plateformes</option>{availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}</select>
      </div>
    </div>
  );

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-black uppercase text-xs"><Loader2 className="animate-spin text-blue-600 mr-2" /> CADEL MANAGER...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      <aside className={`fixed md:sticky top-0 left-0 z-50 w-72 h-full md:h-screen bg-white border-r border-slate-100 flex flex-col transform md:translate-x-0 transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 border-b border-slate-50 flex flex-col items-center">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-4 rounded-2xl text-white shadow-xl mb-2"><Building2 size={28} /></div>
          <h1 className="font-black uppercase tracking-tighter text-2xl">CADEL</h1><h2 className="font-black uppercase tracking-[0.3em] text-[10px] text-blue-600">MANAGER</h2>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {[{ id: 'reservations', label: 'Réservations', icon: <List size={18}/> }, { id: 'agenda', label: 'Agenda', icon: <CalendarRange size={18}/> }, { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={18}/> }, { id: 'finances', label: 'Finances', icon: <Calculator size={18}/> }, { id: 'settings', label: 'Paramètres', icon: <Settings size={18}/> }].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full text-left px-5 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-2xl' : 'text-slate-400 hover:bg-slate-50'}`}>{item.icon} {item.label}</button>
          ))}
        </nav>
      </aside>

      <div className="md:hidden flex items-center justify-between p-5 bg-white border-b sticky top-0 z-40 shadow-sm"><div className="flex items-center gap-2"><div className="bg-blue-600 p-1.5 rounded-lg text-white"><Building2 size={16}/></div><h1 className="font-black text-sm uppercase">CADEL MANAGER</h1></div><button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">{isMobileMenuOpen ? <X /> : <Menu />}</button></div>

      <main className="flex-1 p-4 md:p-12 overflow-y-auto h-screen custom-scrollbar">
        <div className="max-w-7xl mx-auto pb-32">
          <RenderFilters />

          {activeTab === 'reservations' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center"><h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Réservations</h2><button onClick={() => { setEditingResId(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-8 py-4 rounded-[24px] font-black text-[11px] shadow-xl hover:bg-blue-700 transition-all">+ Nouvelle</button></div>
              <div className="grid grid-cols-1 gap-4 md:hidden">{reservationsList.map(t => (<div key={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="bg-white p-6 rounded-[32px] shadow-lg border border-slate-50"><div className="flex justify-between items-start mb-3"><div><h3 className="text-base font-black uppercase">{properties.find(p => p.id === t.propertyId)?.name || '--'}</h3><div className="flex gap-2 text-[10px] text-slate-400"><span>{t.platform}</span><span>{t.name}</span></div></div><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${t.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{t.paymentDate ? 'Payé' : 'Dû'}</span></div><div className="bg-slate-50 p-3 rounded-2xl flex justify-between font-black text-xs"><span>{t.startDate}</span><ArrowRight size={14} className="text-slate-300"/><span>{t.endDate}</span></div><div className="mt-3 text-right font-black text-lg">{(t.netAmount || 0).toFixed(2)}€</div></div>))}</div>
              <div className="hidden md:block bg-white rounded-[40px] shadow-2xl overflow-hidden"><table className="w-full text-left text-xs"><thead className="bg-slate-50 font-black uppercase border-b text-slate-400"><tr><th className="p-6">Logement</th><th className="p-6">Client</th><th className="p-6 text-center">Dates</th><th className="p-6 text-right">Net</th><th className="p-6 text-center">État</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold">{reservationsList.map(t => (<tr key={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="hover:bg-slate-50 cursor-pointer"><td className="p-6"><div className="font-black uppercase">{properties.find(p => p.id === t.propertyId)?.name || '--'}</div><div className="text-blue-600 text-[10px] uppercase">{t.platform}</div></td><td className="p-6">{t.name}</td><td className="p-6 text-center text-slate-500">{t.startDate} ➔ {t.endDate}</td><td className="p-6 text-right font-black">{(t.netAmount || 0).toFixed(2)}€</td><td className="p-6 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${t.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{t.paymentDate ? 'Payé' : 'Attente'}</span></td></tr>))}</tbody></table></div>
            </div>
          )}

          {activeTab === 'agenda' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-end"><div><h2 className="text-3xl font-black uppercase tracking-tighter">Agenda Visuel</h2></div><div className="flex items-center gap-4 bg-white px-6 py-3 rounded-[24px] shadow-lg border border-slate-50"><button onClick={() => handleMonthChange('prev')} className="p-2 text-blue-600"><ChevronLeft size={24}/></button><div className="text-center min-w-[140px]"><span className="block text-[10px] font-black text-slate-300 uppercase tracking-widest">{filterYear}</span><span className="text-xl font-black text-slate-900">{currentMonthName}</span></div><button onClick={() => handleMonthChange('next')} className="p-2 text-blue-600"><ChevronRight size={24}/></button></div></div>
              <div className="bg-white/50 p-4 rounded-[32px] border border-white flex flex-wrap gap-4">{properties.map((p, idx) => (<div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-slate-50"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div><span className="text-[10px] font-black uppercase text-slate-600">{p.name}</span></div>))}</div>
              <div className="bg-white p-6 md:p-10 rounded-[48px] shadow-2xl overflow-x-auto"><div className="min-w-[600px]"><div className="grid grid-cols-7 mb-6 border-b border-slate-100 pb-6 text-center text-[11px] font-black uppercase text-slate-300 tracking-widest">{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <div key={d}>{d}</div>)}</div><div className="grid grid-cols-7 gap-2 md:gap-3">{agendaDays.map((item, idx) => { if (item.empty) return <div key={idx} className="h-24 md:h-36 bg-slate-50/20 rounded-3xl"></div>; const isToday = item.dateStr === todayStr; const dayRes = reservationsList.filter(res => item.dateStr >= res.startDate && item.dateStr <= res.endDate); return (<div key={item.dateStr} className={`h-24 md:h-36 bg-white border ${isToday ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-100'} rounded-[24px] p-3 relative flex flex-col group overflow-hidden`}><span className={`text-[11px] font-black ${isToday ? 'text-blue-600' : 'text-slate-300'}`}>{item.day}</span><div className="flex-1 space-y-1 overflow-y-auto no-scrollbar mt-1">{dayRes.map((res) => { const propIdx = properties.findIndex(p => p.id === res.propertyId); return (<div key={res.id} onClick={(e) => { e.stopPropagation(); setEditingResId(res.id); setFormData(res); setIsModalOpen(true); }} className="h-4 md:h-5 rounded-lg text-[8px] md:text-[9px] font-black text-white px-2 flex items-center truncate cursor-pointer" style={{ backgroundColor: CHART_COLORS[propIdx % CHART_COLORS.length] }}>{res.name?.split(' ')[0]}</div>);})}</div></div>);})}</div></div></div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in duration-700"><div><h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-1 text-blue-600">Tableau de bord</h2><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Performances annuelles ({filterYear})</p></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-xl shadow-slate-200/40 relative overflow-hidden group"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Net Banque (Encaissé)</p><p className="text-3xl font-black text-indigo-600 tracking-tighter">{financials.netB.toLocaleString('fr-FR')}€</p></div><div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl shadow-slate-900/20 relative overflow-hidden group"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-white">Bénéfice Réel (Net Net)</p><p className="text-3xl font-black text-white tracking-tighter">{Math.round(financials.profit).toLocaleString('fr-FR')}€</p></div><div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-xl shadow-slate-200/40 relative overflow-hidden group"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recettes à venir</p><p className="text-3xl font-black text-blue-500 tracking-tighter">{Math.round(financials.netUpcoming).toLocaleString('fr-FR')}€</p></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-10"><DonutChart title="Net par Logement" data={properties.map((p, idx) => ({ label: p.name, value: tenants.filter(t => t.propertyId === p.id && !!t.paymentDate).reduce((acc, t) => acc + ((t.netAmount || 0) - (t.resExpenses?.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) || 0) - (t.isUrssaf ? (t.grossAmount || 0) * 0.077 : 0)), 0), color: CHART_COLORS[idx % CHART_COLORS.length] }))} /><DonutChart title="Net par Plateforme" data={availablePlatforms.map((p, idx) => ({ label: p, value: tenants.filter(t => t.platform === p && !!t.paymentDate).reduce((acc, t) => acc + ((t.netAmount || 0) - (t.isUrssaf ? (t.grossAmount || 0) * 0.077 : 0)), 0), color: CHART_COLORS[(idx + 4) % CHART_COLORS.length] }))} /></div></div>
          )}

          {activeTab === 'finances' && (
            <div className="space-y-10 animate-in fade-in"><h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">Comptabilité</h2><div className="bg-white rounded-[40px] border border-slate-50 shadow-2xl shadow-slate-200/50 overflow-hidden text-xs"><div className="p-8 bg-slate-900 text-white font-black uppercase text-[11px] tracking-widest flex justify-between items-center"><div>Bilan Global</div><span className="opacity-40 font-bold">Base Taxes 7.7%</span></div><div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[700px]"><thead className="bg-slate-50/50 font-black uppercase tracking-widest border-b border-slate-100 text-[10px] text-slate-400"><tr><th className="p-6">Période</th><th className="p-6 text-right text-indigo-600 font-black">Banque</th><th className="p-6 text-right">Base URSSAF</th><th className="p-6 text-right text-rose-500">Provision Taxes</th><th className="p-6 text-right">Charges Svc.</th><th className="p-6 text-right font-black">Profit Réel</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold">{monthlyRecapData.map(([m, d]) => (<tr key={m} className="hover:bg-slate-50"><td className="p-6 capitalize font-black text-slate-900">{formatMonthYear(m)}</td><td className="p-6 text-right font-black text-indigo-600 tabular-nums">{d.totalBank.toLocaleString('fr-FR')}€</td><td className="p-6 text-right text-slate-500 tabular-nums">{d.urssafGross.toLocaleString('fr-FR')}€</td><td className="p-6 text-right text-rose-500 tabular-nums">-{d.taxes.toFixed(2)}€</td><td className="p-6 text-right text-slate-500 tabular-nums">-{d.charges.toLocaleString('fr-FR')}€</td><td className={`p-6 text-right font-black text-sm tabular-nums ${d.totalBank - d.taxes - d.charges >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{(d.totalBank - d.taxes - d.charges).toLocaleString('fr-FR')}€</td></tr>))}</tbody><tfoot className="bg-indigo-600 text-white font-black border-t-2 border-indigo-700"><tr><td className="p-8 uppercase text-[11px] tracking-widest">TOTAUX FILTRÉS</td><td className="p-8 text-right tabular-nums text-lg">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0).toLocaleString('fr-FR')}€</td><td className="p-8 text-right tabular-nums opacity-80">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.urssafGross, 0).toLocaleString('fr-FR')}€</td><td className="p-8 text-right tabular-nums text-rose-200">-{monthlyRecapData.reduce((acc, [m, d]) => acc + d.taxes, 0).toLocaleString('fr-FR')}€</td><td className="p-8 text-right tabular-nums opacity-80">-{monthlyRecapData.reduce((acc, [m, d]) => acc + d.charges, 0).toLocaleString('fr-FR')}€</td><td className="p-8 text-right tabular-nums text-2xl font-black bg-indigo-700/50">{(monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0) - monthlyRecapData.reduce((acc, [m, d]) => acc + d.taxes + d.charges, 0)).toLocaleString('fr-FR')}€</td></tr></tfoot></table></div></div><div className="bg-white rounded-[40px] border border-slate-50 shadow-2xl shadow-slate-200/50 overflow-hidden text-xs"><div className="p-8 bg-slate-900 text-white font-black flex justify-between items-center uppercase tracking-widest border-b border-white/5"><div className="flex items-center gap-3"><UserCheck className="text-indigo-400" size={20}/> Suivi Prestataires</div></div><div className="overflow-x-auto text-xs"><table className="w-full text-left min-w-[700px]"><thead className="bg-slate-50 font-black uppercase tracking-widest border-b border-slate-100 text-[10px] text-slate-400"><tr><th className="p-6">Date</th><th className="p-6">Logement</th><th className="p-6">Prestataire</th><th className="p-6 text-right font-black">Montant</th><th className="p-6 text-center">Règlement</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold text-slate-600">{detailedExpenses.map((exp) => (<tr key={exp.id} className="hover:bg-slate-50 transition-all"><td className="p-6 tabular-nums">{exp.dateRes}</td><td className="p-6 text-slate-900 uppercase tracking-tighter">{exp.propertyName}</td><td className="p-6 text-blue-600 font-black uppercase text-[10px] tracking-widest">{exp.person}</td><td className="p-6 text-right font-black text-slate-900 tabular-nums">{exp.amount.toLocaleString('fr-FR')} €</td><td className="p-6 text-center">{exp.paymentDate ? (<div className="flex flex-col items-center"><span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] uppercase tracking-widest">Payé</span><span className="text-[8px] text-slate-400 mt-1 uppercase">{exp.paymentDate}</span></div>) : (<span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[9px] uppercase tracking-widest">Attente</span>)}</td></tr>))}</tbody><tfoot className="bg-slate-800 text-white font-black border-t-2"><tr><td colSpan="3" className="p-8 uppercase text-[11px] tracking-widest">TOTAL PRESTATIONS</td><td className="p-8 text-right text-2xl tracking-tighter tabular-nums">{detailedExpenses.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('fr-FR')}€</td><td className="bg-slate-900/50"></td></tr></tfoot></table></div></div></div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-10 animate-in fade-in">
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Paramètres</h2>
              <div className="bg-white p-8 rounded-[40px] border-2 border-dashed border-slate-200 shadow-xl shadow-slate-100 flex flex-col items-center justify-center text-center group hover:border-blue-400 transition-all"><div className="bg-blue-50 p-4 rounded-3xl text-blue-600 mb-4 group-hover:scale-110 transition-transform"><UploadCloud size={40}/></div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Importation intelligente Airbnb</h3><p className="text-xs text-slate-400 mt-2 max-w-md">Analysez vos réservations CSV et évitez les doublons.</p><textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Collez ici..." className="w-full mt-6 p-4 bg-slate-50 border border-slate-100 rounded-3xl min-h-[150px] font-mono text-[10px] outline-none" />{reviewList.length > 0 && (<div className="w-full mt-6 overflow-x-auto"><table className="w-full text-left text-[10px] font-bold min-w-[600px] border-collapse"><thead className="bg-slate-50 uppercase text-slate-400 border-b"><tr><th className="p-3">Imp.</th><th className="p-3">Client</th><th className="p-3">Logement</th><th className="p-3">Statut</th></tr></thead><tbody>{reviewList.map(item => (<tr key={item.id} className={`border-b ${item.isDuplicate ? 'bg-orange-50/50' : ''}`}><td className="p-3"><input type="checkbox" checked={item.selected} onChange={() => setReviewList(reviewList.map(r => r.id === item.id ? {...r, selected: !r.selected} : r))} /></td><td className="p-3"><div>{item.name}</div><div className="text-[9px] text-slate-400">{item.startDate}</div></td><td className="p-3 uppercase">{item.propertyName}</td><td className="p-3 uppercase">{item.isDuplicate ? 'Doublon' : 'Nouveau'}</td></tr>))}</tbody></table></div>)}<div className="flex gap-4 w-full mt-8">{reviewList.length === 0 ? (<button onClick={startReview} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[11px] shadow-xl hover:bg-blue-600 transition-all">Analyse</button>) : (<button onClick={confirmImport} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[11px] shadow-xl hover:bg-emerald-600 transition-all">Importer ({reviewList.filter(r => r.selected).length})</button>)}</div></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-xl flex flex-col h-full"><h3 className="text-[11px] font-black uppercase tracking-widest mb-6 text-slate-400 leading-none">Plateformes</h3><div className="space-y-2 mb-8 flex-1 overflow-y-auto max-h-[250px] custom-scrollbar">{availablePlatforms.map(p => (<div key={p} className="flex justify-between items-center text-[11px] font-black bg-slate-50 p-4 rounded-2xl border border-slate-100 uppercase">{p}<button onClick={() => { const n = availablePlatforms.filter(x => x !== p); setAvailablePlatforms(n); updateSettings({ platforms: n }); }} className="text-slate-300 hover:text-rose-500"><X size={16} /></button></div>))}</div><form onSubmit={(e) => { e.preventDefault(); if (inputPlat.trim()) { const n = [...availablePlatforms, inputPlat.trim()]; setAvailablePlatforms(n); updateSettings({ platforms: n }); setInputPlat(''); } }} className="flex gap-2 bg-slate-100 p-2 rounded-[24px]"><input value={inputPlat} onChange={e => setInputPlat(e.target.value)} className="flex-1 bg-transparent px-4 py-2 font-bold text-xs outline-none w-0" placeholder="..." /><button type="submit" className="bg-slate-900 text-white p-3 rounded-[18px]"><Plus size={18} /></button></form></div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-xl flex flex-col h-full"><h3 className="text-[11px] font-black uppercase tracking-widest mb-6 text-slate-400 leading-none">Prestataires</h3><div className="space-y-2 mb-8 flex-1 overflow-y-auto max-h-[250px] custom-scrollbar text-blue-600 font-black">{availableProviders.map(p => (<div key={p} className="flex justify-between items-center text-[11px] font-black bg-slate-50 p-4 rounded-2xl border border-slate-100 uppercase">{p}<button onClick={() => { const n = availableProviders.filter(x => x !== p); setAvailableProviders(n); updateSettings({ providers: n }); }} className="text-slate-300 hover:text-rose-500"><X size={16} /></button></div>))}</div><form onSubmit={(e) => { e.preventDefault(); if (inputProv.trim()) { const n = [...availableProviders, inputProv.trim()]; setAvailableProviders(n); updateSettings({ providers: n }); setInputProv(''); } }} className="flex gap-2 bg-slate-100 p-2 rounded-[24px]"><input value={inputProv} onChange={e => setInputProv(e.target.value)} className="flex-1 bg-transparent px-4 py-2 font-bold text-xs outline-none w-0" placeholder="..." /><button type="submit" className="bg-slate-900 text-white p-3 rounded-[18px]"><Plus size={18} /></button></form></div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-50 shadow-xl flex flex-col h-full"><h3 className="text-[11px] font-black uppercase tracking-widest mb-6 text-slate-400 leading-none">Services</h3><div className="space-y-2 mb-8 flex-1 overflow-y-auto max-h-[250px] custom-scrollbar">{availableServiceTypes.map(p => (<div key={p} className="flex justify-between items-center text-[11px] font-black bg-slate-50 p-4 rounded-2xl border border-slate-100 uppercase">{p}<button onClick={() => { const n = availableServiceTypes.filter(x => x !== p); setAvailableServiceTypes(n); updateSettings({ services: n }); }} className="text-slate-300 hover:text-rose-500"><X size={16} /></button></div>))}</div><form onSubmit={(e) => { e.preventDefault(); if (inputSvc.trim()) { const n = [...availableServiceTypes, inputSvc.trim()]; setAvailableServiceTypes(n); updateSettings({ services: n }); setInputSvc(''); } }} className="flex gap-2 bg-slate-100 p-2 rounded-[24px]"><input value={inputSvc} onChange={e => setInputSvc(e.target.value)} className="flex-1 bg-transparent px-4 py-2 font-bold text-xs outline-none w-0" placeholder="..." /><button type="submit" className="bg-slate-900 text-white p-3 rounded-[18px]"><Plus size={18} /></button></form></div>
                <div className="bg-white p-8 rounded-[40px] shadow-2xl flex flex-col h-full border-2 border-blue-100 relative font-black uppercase"><h3 className="text-[11px] font-black uppercase tracking-widest mb-6 text-blue-600 leading-none"><Home size={14} className="inline mr-2"/>Logements</h3><div className="space-y-3 mb-8 flex-1 overflow-y-auto max-h-[250px] custom-scrollbar text-[11px] leading-tight">{properties.map(p => (<div key={p.id} className="flex justify-between items-start bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100/50"><div>{p.name}</div><button onClick={async () => { if(window.confirm("Supprimer ce bien ?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'properties', p.id)) }} className="text-slate-300 hover:text-rose-500 ml-2"><Trash2 size={16} /></button></div>))}</div><form onSubmit={async (e) => { e.preventDefault(); if(user && user.uid !== 'local-test-user' && inputProp.name.trim()) { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), { name: inputProp.name.trim(), address: inputProp.address.trim() }); setInputProp({ name: '', address: '' }); } }} className="space-y-2 pt-4 border-t border-blue-50 leading-tight uppercase font-black"><input required value={inputProp.name} onChange={e => setInputProp({...inputProp, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none" placeholder="Nom" /><div className="flex gap-2"><input value={inputProp.address} onChange={e => setInputProp({...inputProp, address: e.target.value})} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none w-0" placeholder="Adresse" /><button type="submit" className="bg-blue-600 text-white p-3 rounded-2xl hover:scale-105 transition-all"><Plus size={18} /></button></div></form></div>
              </div>
            </div>
          )}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-[40px] md:rounded-[60px] shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col border border-slate-100 overflow-hidden"><div className="p-6 md:p-10 border-b flex justify-between items-center bg-white sticky top-0 z-10"><div className="flex items-center gap-4 text-blue-600 font-black uppercase leading-none"><CalendarCheck size={28} /> Détails</div><button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all duration-300"><X size={28} /></button></div><form onSubmit={saveRes} className="p-6 md:p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar text-xs"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Logement<select required value={formData.propertyId} onChange={e => setFormData({ ...formData, propertyId: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900">{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Voyageur<input required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Début<input type="date" required value={formData.startDate || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Fin<input type="date" required value={formData.endDate || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div></div><div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-8 rounded-[48px] border border-blue-50 space-y-6"><div className="flex justify-between font-black uppercase text-blue-900 border-b border-blue-100 pb-3 text-[11px] tracking-widest">Plateforme<select value={formData.platform} onChange={e => setFormData({ ...formData, platform: e.target.value })} className="bg-white border rounded-xl px-4 py-1 text-blue-600">{availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isCplxFormModale ? (
                <><div><label className="text-[10px] font-black uppercase text-slate-400">Brut Client</label><input type="number" step="0.01" value={formData.displayedAmount || ''} onChange={e => setFormData({ ...formData, displayedAmount: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div><div><label className="text-[10px] font-black uppercase text-rose-400">Taxe Séjour</label><input type="number" step="0.01" value={formData.cityTax || ''} onChange={e => setFormData({ ...formData, cityTax: e.target.value })} className="w-full p-4 border border-rose-100 rounded-2xl font-black bg-rose-50/30 text-rose-500" /></div></>
              ) : (
                <><div><label className="text-[10px] font-black uppercase text-slate-400">Brut URSSAF</label><input type="number" step="0.01" value={formData.grossAmount || ''} onChange={e => setFormData({ ...formData, grossAmount: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div><div><label className="text-[10px] font-black uppercase text-slate-400">Commission</label><input type="number" step="0.01" value={formData.platformFees || ''} onChange={e => setFormData({ ...formData, platformFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div></>
              )}
            </div></div><div className="space-y-4">
                <div className="flex justify-between font-black uppercase tracking-widest text-slate-400 text-[10px]">Prestations<button type="button" onClick={() => setFormData({ ...formData, resExpenses: [...(formData.resExpenses || []), { id: Date.now().toString(), person: availableProviders[0], type: availableServiceTypes[0], amount: 0, paymentDate: '' }] })} className="bg-slate-900 text-white px-4 py-2 rounded-xl">+ Ajouter</button></div>
                {(formData.resExpenses || []).map(exp => (
                  <div key={exp.id} className="flex gap-2 bg-slate-50 p-4 rounded-[28px] border border-slate-100 items-center">
                    <select value={exp.person} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, person: e.target.value } : x) })} className="flex-1 p-3 border rounded-xl font-black uppercase text-[10px]">{availableProviders.map(p => <option key={p} value={p}>{p}</option>)}</select>
                    <input type="number" value={exp.amount || ''} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, amount: e.target.value } : x) })} className="w-20 p-3 border rounded-xl font-black text-right" />
                    <button type="button" onClick={() => setFormData({ ...formData, resExpenses: formData.resExpenses.filter(x => x.id !== exp.id) })} className="text-rose-500 font-black px-2">X</button>
                  </div>
                ))}
            </div><div className="bg-slate-900 p-8 rounded-[48px] text-white flex flex-col md:flex-row justify-between items-center gap-6"><div className="text-center md:text-left leading-none"><p className="text-[10px] font-black uppercase text-slate-400 mb-2">Net Estimé</p><p className="text-4xl font-black text-blue-400 tracking-tighter">{(nModale - curChargesModale).toFixed(2)}€</p></div><button type="submit" className="w-full md:w-auto bg-blue-600 px-12 py-5 rounded-[24px] font-black uppercase tracking-[2px] shadow-xl hover:-translate-y-1 transition-all">Enregistrer</button></div></form></div></div>
      )}
    </div>
  );
};

export default App;
