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

// --- COMPOSANTS GRAPHIQUES ---
const DonutChart = ({ data, title }) => {
  const visibleData = (data || []).filter(d => d && d.value > 0);
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

const ComparisonChart = ({ data, year1, year2 }) => {
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const months = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear().toString();

  const safeData = Array.isArray(data) ? data : [];

  const calcNet = (t) => {
    const gross = parseFloat(t.grossAmount) || 0;
    const fees = parseFloat(t.platformFees) || 0;
    const isC = t.platform === 'Booking' || t.platform === 'Abritel';
    let net = 0;
    if (isC) {
      const disp = parseFloat(t.displayedAmount) || 0;
      const city = parseFloat(t.cityTax) || 0;
      const bank = parseFloat(t.bankFees) || 0;
      net = (disp - city) - (fees + bank);
    } else {
      net = gross - fees;
    }
    const exp = (t.resExpenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const urssaf = t.isUrssaf ? gross * 0.077 : 0;
    return net - exp - urssaf;
  };

  const getDataForYear = (yStr) => {
    const res = Array(12).fill(0);
    safeData.forEach(t => {
      const dateRef = t.endDate || t.startDate;
      if (!dateRef) return;
      const [y, mStr] = dateRef.split('-');
      if (y === yStr) {
        const m = parseInt(mStr, 10) - 1;
        if (m >= 0 && m <= 11) res[m] += calcNet(t);
      }
    });
    return res;
  };

  const d1 = getDataForYear(year1);
  const d2 = getDataForYear(year2);
  const maxVal = Math.max(...d1, ...d2, 1000) * 1.15; 

  const total1 = d1.reduce((acc, val) => acc + val, 0);
  const total2 = d2.reduce((acc, val) => acc + val, 0);

  const w = 900, h = 300, padX = 40, padY = 30;
  const getX = (i) => padX + (i * (w - 2 * padX) / 11);
  const getY = (val) => h - padY - ((val / maxVal) * (h - 2 * padY));

  const buildPath = (dArr, start, end) => {
    if (start > end || start < 0) return '';
    let p = `M ${getX(start)},${getY(dArr[start])} `;
    for (let i = start + 1; i <= end; i++) p += `L ${getX(i)},${getY(dArr[i])} `;
    return p;
  };

  const getSplit = (yStr) => {
    if (parseInt(yStr) < parseInt(currentYear)) return 11;
    if (parseInt(yStr) > parseInt(currentYear)) return -1;
    return currentMonth;
  };

  const split1 = getSplit(year1);
  const path1Solid = buildPath(d1, 0, Math.max(0, split1));
  const path1Dotted = buildPath(d1, Math.max(0, split1), 11);

  const split2 = getSplit(year2);
  const path2Solid = buildPath(d2, 0, Math.max(0, split2));
  const path2Dotted = buildPath(d2, Math.max(0, split2), 11);

  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];

  return (
    <div className="w-full bg-white p-8 rounded-[48px] shadow-xl shadow-slate-200/50 border border-slate-50 animate-in fade-in">
      <div className="overflow-x-auto no-scrollbar">
        <div className="min-w-[600px] relative">
          <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            {yTicks.map((tick, i) => (
              <g key={`grid-${i}`}>
                <line x1={padX} y1={getY(tick)} x2={w - padX} y2={getY(tick)} stroke="#F8FAFC" strokeWidth="2" />
                <text x={w - padX + 10} y={getY(tick) + 4} fill="#CBD5E1" fontSize="11" fontFamily="sans-serif" fontWeight="900">{(tick / 1000).toFixed(1)}k€</text>
              </g>
            ))}
            {months.map((m, i) => (
              <text key={m} x={getX(i)} y={h - 5} fill={hoveredMonth === i ? "#0F172A" : "#94A3B8"} fontSize="12" fontFamily="sans-serif" fontWeight="900" textAnchor="middle" className="transition-colors cursor-pointer" onMouseEnter={() => setHoveredMonth(i)} onMouseLeave={() => setHoveredMonth(null)}>{m}</text>
            ))}
            <path d={path2Solid} stroke="#9333EA" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={path2Dotted} stroke="#9333EA" strokeWidth="4" fill="none" strokeDasharray="6 8" strokeLinecap="round" strokeLinejoin="round" />
            <path d={path1Solid} stroke="#F43F5E" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={path1Dotted} stroke="#F43F5E" strokeWidth="4" fill="none" strokeDasharray="6 8" strokeLinecap="round" strokeLinejoin="round" />
            {months.map((_, i) => (
              <g key={`points-${i}`} onMouseEnter={() => setHoveredMonth(i)} onMouseLeave={() => setHoveredMonth(null)} className="cursor-pointer">
                <rect x={getX(i) - 20} y={0} width="40" height={h} fill="transparent" />
                <circle cx={getX(i)} cy={getY(d2[i])} r={hoveredMonth === i ? 7 : 5} fill={hoveredMonth === i ? "#9333EA" : "white"} stroke="#9333EA" strokeWidth="3" className="transition-all duration-200" />
                <circle cx={getX(i)} cy={getY(d1[i])} r={hoveredMonth === i ? 7 : 5} fill={hoveredMonth === i ? "#F43F5E" : "white"} stroke="#F43F5E" strokeWidth="3" className="transition-all duration-200" />
              </g>
            ))}
          </svg>
        </div>
      </div>
      <div className="mt-8 bg-slate-50 border border-slate-100 p-6 rounded-3xl flex justify-between items-center h-[90px] transition-all overflow-hidden">
        {hoveredMonth !== null ? (
          <>
            <div className="animate-in slide-in-from-left-4 fade-in">
               <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">{d1[hoveredMonth].toFixed(2)}€</div>
               <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2 mt-1"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm"></div> {months[hoveredMonth]} {year1}</div>
            </div>
            <div className="text-right animate-in slide-in-from-right-4 fade-in">
               <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">{d2[hoveredMonth].toFixed(2)}€</div>
               <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center justify-end gap-2 mt-1"><div className="w-2.5 h-2.5 rounded-full bg-purple-600 shadow-sm"></div> {months[hoveredMonth]} {year2}</div>
            </div>
          </>
        ) : (
          <div className="w-full text-center text-slate-300 font-black uppercase text-[10px] tracking-widest italic animate-in fade-in">Survolez le graphique pour comparer les détails mensuels</div>
        )}
      </div>

      {/* TOTAUX ANNUELS */}
      <div className="grid grid-cols-2 gap-6 mt-8">
        <div className="bg-rose-50/50 border border-rose-100 p-6 rounded-3xl text-center shadow-sm">
          <p className="text-[10px] font-black uppercase text-rose-400 tracking-widest mb-1">Total Global {year1}</p>
          <p className="text-2xl md:text-3xl font-black text-rose-600 tracking-tighter">{total1.toLocaleString('fr-FR')}€</p>
        </div>
        <div className="bg-purple-50/50 border border-purple-100 p-6 rounded-3xl text-center shadow-sm">
          <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest mb-1">Total Global {year2}</p>
          <p className="text-2xl md:text-3xl font-black text-purple-600 tracking-tighter">{total2.toLocaleString('fr-FR')}€</p>
        </div>
      </div>
    </div>
  );
};

// --- COMPOSANT PRINCIPAL ---
const App = () => {
  const formatMonthYear = (m) => {
    if (!m) return "";
    const [year, month] = m.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
  };

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reservations');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [availablePlatforms, setAvailablePlatforms] = useState(['Airbnb', 'Booking', 'Abritel', 'En direct']);
  const [availableProviders, setAvailableProviders] = useState(['Justine', 'Marc']);
  const [availableServiceTypes, setAvailableServiceTypes] = useState(['Ménage', 'Entrée/Sortie']);

  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterProp, setFilterProp] = useState('all');
  const [filterPlat, setFilterPlat] = useState('all');
  const [filterProv, setFilterProv] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [compYear1, setCompYear1] = useState(new Date().getFullYear().toString());
  const [compYear2, setCompYear2] = useState((new Date().getFullYear() - 1).toString());

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

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setLoading(false); }
      else signInAnonymously(auth);
    });
    const unsubProps = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), (snap) => setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTenants = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), (snap) => {
      setTenants(snap.docs.map(d => {
        const data = d.data();
        const year = data.startDate ? parseInt(data.startDate.split('-')[0], 10) : 0;
        if (year >= 2022 && year <= 2025) {
          if (!data.paymentDate) data.paymentDate = data.endDate || `${year}-12-31`;
          if (data.resExpenses) {
            data.resExpenses = data.resExpenses.map(exp => ({ ...exp, paymentDate: exp.paymentDate || data.endDate || `${year}-12-31` }));
          }
        }
        return { id: d.id, ...data };
      }));
    });
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

  const updateSettings = async (n) => {
    if(!user || user.uid === 'local-test-user') return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), n, { merge: true });
  };

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

  // --- TOGGLE STATUT PAIEMENT AVEC CONFIRMATION ---
  const toggleStatus = async (e, tenant, type, expId = null) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user || user.uid === 'local-test-user') return;
    
    if (!window.confirm("Confirmez-vous le changement de statut de paiement ?")) return;

    const today = new Date().toISOString().split('T')[0];
    try {
      if (type === 'global') {
        const newStatus = tenant.paymentDate ? '' : today;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', tenant.id), { paymentDate: newStatus }, { merge: true });
      } else if (type === 'expense') {
        const newExpenses = (tenant.resExpenses || []).map(exp => 
          exp.id === expId ? { ...exp, paymentDate: exp.paymentDate ? '' : today } : exp
        );
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', tenant.id), { resExpenses: newExpenses }, { merge: true });
      }
    } catch (error) {
      console.error("Erreur mise à jour statut", error);
    }
  };

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
    if (!importText.trim()) return;
    const lines = importText.split('\n'); const newList = [];
    lines.forEach((line, index) => {
        if (line.toLowerCase().includes('date') || line.trim() === '') return;
        const parts = parseCSVLine(line);
        if (parts.length < 10) return;
        const typeIndex = parts.findIndex(p => p.toLowerCase().includes('réservation') || p.toLowerCase().includes('reservation'));
        if (typeIndex === -1) return;
        let guestName, rawStart, rawEnd, listingName, grossStr, serviceFeeStr;
        if (typeIndex === 2) {
            rawStart = parts[5]?.trim(); rawEnd = parts[6]?.trim(); guestName = parts[8]?.trim(); listingName = parts[9]?.trim();
            grossStr = parts[18]?.trim() || parts[13]?.trim(); serviceFeeStr = parts[15]?.trim();
        } else if (typeIndex === 1) {
            rawStart = parts[4]?.trim(); rawEnd = parts[5]?.trim(); guestName = parts[7]?.trim(); listingName = parts[8]?.trim();
            grossStr = parts[15]?.trim() || parts[12]?.trim(); serviceFeeStr = parts[13]?.trim();
        } else return;
        const formatDate = (raw) => { if(!raw) return ''; const [m, d, y] = raw.split('/'); return (m && d && y) ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : ''; };
        const startDate = formatDate(rawStart); const endDate = formatDate(rawEnd);
        if (!startDate || !endDate) return;
        const gross = parseFloat(grossStr?.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        const fees = parseFloat(serviceFeeStr?.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        const matchedProp = properties.find(p => listingName && p.name && (listingName.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(listingName.toLowerCase())));
        const isDuplicate = tenants.some(t => t.name === guestName && t.startDate === startDate);
        const hasProperty = !!matchedProp;
        newList.push({ id: index, propertyId: matchedProp?.id || '', propertyName: matchedProp?.name || listingName || 'Inconnu', name: guestName || 'Client Inconnu', startDate, endDate, grossAmount: gross, platformFees: fees, netAmount: gross - fees, isDuplicate, hasProperty, selected: !isDuplicate && hasProperty });
    });
    setReviewList(newList);
  };

  const confirmImport = async () => {
      const toImport = reviewList.filter(i => i.selected && i.hasProperty);
      for (let item of toImport) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), { ...item, platform: 'Airbnb', isUrssaf: true, comment: 'Importé via CSV', resExpenses: [] });
      }
      setReviewList([]); setImportText(''); setImportStatus(`${toImport.length} réservation(s) importée(s) !`);
      setTimeout(() => setImportStatus(''), 5000);
  };

  const RenderFilters = () => (
    <div className="flex flex-wrap items-center gap-2 bg-white/70 backdrop-blur-md p-3 rounded-[28px] border border-white shadow-xl mb-6 md:mb-8">
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <Filter size={12} className="text-slate-400" />
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none cursor-pointer">
          <option value="all">Années</option>{(yearsAvailable || []).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none cursor-pointer"><option value="all">Mois (Tous)</option>{['Janv','Févr','Mars','Avril','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'].map((m,i)=><option key={i} value={i}>{m}</option>)}</select>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterProp} onChange={e => setFilterProp(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none max-w-[100px] md:max-w-[130px] cursor-pointer"><option value="all">Logements</option>{(properties || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <select value={filterPlat} onChange={e => setFilterPlat(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none cursor-pointer"><option value="all">Plateformes</option>{(availablePlatforms || []).map(p => <option key={p} value={p}>{p}</option>)}</select>
      </div>
    </div>
  );

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-black uppercase text-xs"><Loader2 className="animate-spin text-blue-600 mr-2" /> CADEL MANAGER...</div>;

  const curChargesModale = (formData?.resExpenses || []).reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const isCplxFormModale = formData?.platform === 'Booking' || formData?.platform === 'Abritel';
  const nModale = isCplxFormModale 
    ? (parseFloat(formData?.displayedAmount || 0) - parseFloat(formData?.cityTax || 0)) - (parseFloat(formData?.platformFees || 0) + parseFloat(formData?.bankFees || 0))
    : (parseFloat(formData?.grossAmount || 0) - parseFloat(formData?.platformFees || 0));

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      <aside className={`fixed md:sticky top-0 left-0 z-50 w-72 h-full md:h-screen bg-white border-r transform md:translate-x-0 transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 border-b flex flex-col items-center">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-4 rounded-2xl text-white shadow-xl mb-2"><Building2 size={28} /></div>
          <h1 className="font-black uppercase tracking-tighter text-2xl">CADEL</h1><h2 className="font-black uppercase tracking-[0.3em] text-[10px] text-blue-600">MANAGER</h2>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {[{ id: 'reservations', label: 'Réservations', icon: <List size={18}/> }, { id: 'agenda', label: 'Agenda', icon: <CalendarRange size={18}/> }, { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={18}/> }, { id: 'finances', label: 'Finances', icon: <Calculator size={18}/> }, { id: 'settings', label: 'Paramètres', icon: <Settings size={18}/> }].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full text-left px-5 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-2xl' : 'text-slate-400 hover:bg-slate-50'}`}>{item.icon} {item.label}</button>
          ))}
        </nav>
      </aside>

      <div className="md:hidden flex justify-between p-5 bg-white border-b sticky top-0 z-40 shadow-sm"><div className="flex items-center gap-2"><div className="bg-blue-600 p-1.5 rounded-lg text-white"><Building2 size={16}/></div><h1 className="font-black text-sm uppercase">CADEL MANAGER</h1></div><button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">{isMobileMenuOpen ? <X /> : <Menu />}</button></div>

      <main className="flex-1 p-4 md:p-12 overflow-y-auto h-screen custom-scrollbar">
        <div className="max-w-7xl mx-auto pb-32">
          <RenderFilters />

          {activeTab === 'reservations' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center"><h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Réservations</h2><button onClick={() => { setEditingResId(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-8 py-4 rounded-[24px] font-black text-[11px] shadow-xl hover:bg-blue-700 transition-all">+ Nouvelle</button></div>
              
              {/* MOBILE RESERVATIONS */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {(reservationsList || []).map(t => (
                  <div key={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="bg-white p-6 rounded-[32px] shadow-lg border border-slate-50 cursor-pointer">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-base font-black uppercase">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}</h3>
                        <div className="flex gap-2 text-[10px] text-slate-400"><span>{t.platform}</span><span>{t.name}</span></div>
                      </div>
                      <span onClick={(e) => toggleStatus(e, t, 'global')} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase cursor-pointer hover:scale-105 transition-transform ${t.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                        {t.paymentDate ? 'Payé' : 'Dû'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl flex justify-between font-black text-xs mb-3"><span>{t.startDate}</span><ArrowRight size={14} className="text-slate-300"/><span>{t.endDate}</span></div>
                    
                    {/* Prestations Mobile */}
                    {t.resExpenses && t.resExpenses.length > 0 && (
                      <div className="space-y-1.5 border-t border-slate-50 pt-3 mb-3">
                        {(t.resExpenses || []).map((exp, idx) => (
                          <div key={idx} onClick={(e) => toggleStatus(e, t, 'expense', exp.id)} className="flex items-center justify-between text-[10px] bg-slate-50 p-2 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                            <span className="uppercase font-black text-slate-500">{exp.type} ({exp.person})</span>
                            <span className={`font-black flex items-center gap-1 ${exp.paymentDate ? 'text-emerald-600' : 'text-orange-500'}`}>{exp.amount}€ {exp.paymentDate ? <CheckCircle size={10}/> : <Clock size={10}/>}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-right font-black text-lg">{(t.netAmount || 0).toFixed(2)}€</div>
                  </div>
                ))}
              </div>

              {/* DESKTOP RESERVATIONS */}
              <div className="hidden md:block bg-white rounded-[40px] shadow-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 font-black uppercase border-b text-slate-400">
                    <tr><th className="p-6">Logement</th><th className="p-6">Client</th><th className="p-6 text-center">Dates</th><th className="p-6">Prestations</th><th className="p-6 text-right">Net</th><th className="p-6 text-center">État</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold">
                    {(reservationsList || []).map(t => (
                      <tr key={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="hover:bg-slate-50 cursor-pointer">
                        <td className="p-6 uppercase">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}<div className="text-blue-600 text-[10px]">{t.platform}</div></td>
                        <td className="p-6">{t.name}</td>
                        <td className="p-6 text-center text-slate-500">{t.startDate} ➔ {t.endDate}</td>
                        <td className="p-6">
                           <div className="space-y-1.5">
                              {(t.resExpenses || []).map((exp, idx) => (
                                <div key={idx} onClick={(e) => toggleStatus(e, t, 'expense', exp.id)} className="flex items-center justify-between text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-100 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
                                  <span className="uppercase font-black text-slate-500 leading-none">{exp.type} ({exp.person})</span>
                                  <div className="flex items-center gap-1.5">
                                      <span className={`font-black ${exp.paymentDate ? 'text-emerald-600' : 'text-orange-500'}`}>{exp.amount}€</span>
                                      {exp.paymentDate ? <CheckCircle size={10} className="text-emerald-500" /> : <Clock size={10} className="text-orange-400" />}
                                  </div>
                                </div>
                              ))}
                           </div>
                        </td>
                        <td className="p-6 text-right font-black">{(t.netAmount || 0).toFixed(2)}€</td>
                        <td className="p-6 text-center">
                          <span onClick={(e) => toggleStatus(e, t, 'global')} className={`px-4 py-2 rounded-full text-[9px] uppercase cursor-pointer hover:scale-105 transition-transform inline-block ${t.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                            {t.paymentDate ? 'Payé' : 'Attente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'agenda' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center"><div><h2 className="text-2xl font-black uppercase">Agenda</h2></div><div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl shadow-lg"><button onClick={()=>handleMonthChange('prev')}><ChevronLeft/></button><div className="text-center font-black min-w-[120px] uppercase text-xs">{['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][filterMonth==='all'?new Date().getMonth():parseInt(filterMonth)]}</div><button onClick={()=>handleMonthChange('next')}><ChevronRight/></button></div></div>
              <div className="bg-white p-6 rounded-[40px] shadow-2xl overflow-x-auto"><div className="min-w-[700px]"><div className="grid grid-cols-7 text-center font-black text-slate-300 text-[10px] uppercase mb-4">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=><div key={d}>{d}</div>)}</div><div className="grid grid-cols-7 gap-2">{(agendaDays || []).map((item,idx)=>{ if(item.empty) return <div key={idx} className="h-24 bg-slate-50/30 rounded-2xl"></div>; const dayRes = (reservationsList || []).filter(r=>item.dateStr>=r.startDate && item.dateStr<=r.endDate); return (<div key={item.dateStr} className={`h-24 md:h-32 border rounded-2xl p-2 relative flex flex-col ${item.dateStr===todayStr?'border-blue-500 bg-blue-50/10':'border-slate-100'}`}><span className="text-[10px] font-black text-slate-300">{item.day}</span><div className="flex-1 space-y-1 overflow-y-auto no-scrollbar">{dayRes.map(r=>(<div key={r.id} onClick={(e)=>{e.stopPropagation();setEditingResId(r.id);setFormData(r);setIsModalOpen(true)}} className="text-[8px] font-black text-white p-1 rounded truncate cursor-pointer" style={{backgroundColor: CHART_COLORS[(properties || []).findIndex(p=>p.id===r.propertyId)%CHART_COLORS.length]}}>{r.name?.split(' ')[0]}</div>))}</div></div>);})}</div></div></div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                 <div>
                    <h2 className="text-3xl md:text-4xl font-black uppercase text-slate-900 tracking-tighter leading-none mb-2">Tableau de bord</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Performances & Comparaisons</p>
                 </div>
                 <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border shadow-sm">
                    <select value={compYear1} onChange={e=>setCompYear1(e.target.value)} className="bg-transparent font-black text-rose-500 outline-none cursor-pointer">
                        {yearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <span className="text-[10px] font-black text-slate-300 mx-2">VS</span>
                    <select value={compYear2} onChange={e=>setCompYear2(e.target.value)} className="bg-transparent font-black text-purple-600 outline-none cursor-pointer">
                        {yearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                 </div>
              </div>

              <ComparisonChart data={tenants} year1={compYear1} year2={compYear2} />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="bg-white p-8 rounded-[40px] shadow-xl"><p className="text-[10px] font-black text-slate-400 uppercase">Net Encaissé ({filterYear})</p><p className="text-3xl font-black text-indigo-600">{financials.netB.toLocaleString('fr-FR')}€</p></div><div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl text-white"><p className="text-[10px] font-black uppercase">Profit Réel ({filterYear})</p><p className="text-3xl font-black">{Math.round(financials.profit).toLocaleString('fr-FR')}€</p></div><div className="bg-white p-8 rounded-[40px] shadow-xl"><p className="text-[10px] font-black text-slate-400 uppercase">À venir ({filterYear})</p><p className="text-3xl font-black text-blue-500">{Math.round(financials.netUpcoming).toLocaleString('fr-FR')}€</p></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10"><DonutChart title="Net par Logement" data={(properties || []).map((p,idx)=>({label:p.name,value:(tenants || []).filter(t=>t.propertyId===p.id&&!!t.paymentDate).reduce((acc,t)=>acc+((t.netAmount||0)-(t.resExpenses?.reduce((s,e)=>s+(parseFloat(e.amount)||0),0)||0)-(t.isUrssaf?(t.grossAmount||0)*0.077:0)),0),color:CHART_COLORS[idx%CHART_COLORS.length]}))} /><DonutChart title="Net par Plateforme" data={(availablePlatforms || []).map((p,idx)=>({label:p,value:(tenants || []).filter(t=>t.platform===p&&!!t.paymentDate).reduce((acc,t)=>acc+((t.netAmount||0)-(t.isUrssaf?(t.grossAmount||0)*0.077:0)),0),color:CHART_COLORS[(idx+4)%CHART_COLORS.length]}))} /></div>
            </div>
          )}

          {activeTab === 'finances' && (
            <div className="space-y-10 animate-in fade-in"><h2 className="text-3xl font-black uppercase">Comptabilité</h2><div className="bg-white rounded-[40px] shadow-2xl overflow-hidden text-xs"><div className="p-8 bg-slate-900 text-white font-black uppercase flex justify-between items-center"><div>Bilan Global</div><span className="opacity-40 font-bold">Tax 7.7%</span></div><div className="overflow-x-auto"><table className="w-full text-left min-w-[700px]"><thead className="bg-slate-50 uppercase text-slate-400 border-b"><tr><th className="p-6">Période</th><th className="p-6 text-right">Banque</th><th className="p-6 text-right text-rose-500">Taxes</th><th className="p-6 text-right">Services</th><th className="p-6 text-right font-black">Profit Réel</th></tr></thead><tbody className="divide-y font-bold">{(monthlyRecapData || []).map(([m, d]) => (<tr key={m}><td className="p-6 capitalize">{formatMonthYear(m)}</td><td className="p-6 text-right text-indigo-600">{d.totalBank.toLocaleString('fr-FR')}€</td><td className="p-6 text-right text-rose-500">-{d.taxes.toFixed(2)}€</td><td className="p-6 text-right text-slate-500">-{d.charges.toLocaleString('fr-FR')}€</td><td className={`p-6 text-right font-black ${d.totalBank - d.taxes - d.charges >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{(d.totalBank - d.taxes - d.charges).toLocaleString('fr-FR')}€</td></tr>))}</tbody><tfoot className="bg-indigo-600 text-white font-black text-lg"><tr><td className="p-8 uppercase text-[10px]">TOTAL</td><td className="p-8 text-right">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0).toLocaleString('fr-FR')}€</td><td colSpan="2"></td><td className="p-8 text-right bg-indigo-700/50">{(monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0) - monthlyRecapData.reduce((acc, [m, d]) => acc + d.taxes + d.charges, 0)).toLocaleString('fr-FR')}€</td></tr></tfoot></table></div></div><div className="bg-white rounded-[40px] shadow-2xl overflow-hidden text-xs"><div className="p-8 bg-slate-900 text-white font-black uppercase flex justify-between">Suivi Prestataires</div><div className="overflow-x-auto"><table className="w-full text-left min-w-[700px]"><thead className="bg-slate-50 uppercase text-slate-400 border-b"><tr><th className="p-6">Date</th><th className="p-6">Logement</th><th className="p-6">Prestataire</th><th className="p-6 text-right">Montant</th><th className="p-6 text-center">Statut</th></tr></thead><tbody className="divide-y font-bold">{(detailedExpenses || []).map((exp) => (<tr key={exp.id}><td className="p-6">{exp.dateRes}</td><td className="p-6 uppercase">{exp.propertyName}</td><td className="p-6 text-blue-600 uppercase">{exp.person}</td><td className="p-6 text-right">{(exp.amount || 0).toLocaleString('fr-FR')}€</td><td className="p-6 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${exp.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{exp.paymentDate || 'Attente'}</span></td></tr>))}</tbody></table></div></div></div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-10 animate-in fade-in">
              <h2 className="text-3xl font-black uppercase">Paramètres</h2>
              
              <div className="bg-white p-8 rounded-[40px] border-2 border-dashed shadow-xl flex flex-col items-center justify-center text-center">
                <UploadCloud size={40} className="text-blue-600 mb-4"/>
                <h3 className="text-xl font-black uppercase">Importation Airbnb</h3>
                <p className="text-xs text-slate-400 mt-2">Copiez vos lignes CSV ici (Gère les deux formats Airbnb).</p>
                <textarea value={importText} onChange={(e)=>setImportText(e.target.value)} placeholder="Collez votre CSV Airbnb ici..." className="w-full mt-6 p-4 bg-slate-50 border rounded-3xl min-h-[150px] font-mono text-[10px] outline-none" />
                
                {importStatus && <p className="mt-4 font-black text-emerald-600 uppercase">{importStatus}</p>}
                
                {(reviewList || []).length > 0 && (
                  <div className="w-full mt-6 overflow-x-auto">
                    <table className="w-full text-left text-[10px] font-bold border-collapse">
                      <thead className="bg-slate-50 border-b text-slate-500"><tr><th className="p-3">Imp.</th><th className="p-3">Client</th><th className="p-3">Logement</th><th className="p-3">Statut</th></tr></thead>
                      <tbody>
                        {reviewList.map(item => (
                          <tr key={item.id} className={`border-b ${!item.hasProperty ? 'bg-rose-50' : item.isDuplicate ? 'bg-orange-50' : ''}`}>
                            <td className="p-3"><input type="checkbox" checked={item.selected} disabled={!item.hasProperty} onChange={()=>setReviewList(reviewList.map(r=>r.id===item.id?{...r,selected:!r.selected}:r))} /></td>
                            <td className="p-3">{item.name}<div className="text-slate-400">{item.startDate}</div></td>
                            <td className="p-3 uppercase">{item.propertyName}</td>
                            <td className="p-3 uppercase">
                              {!item.hasProperty ? <span className="text-rose-600 flex items-center gap-1"><AlertTriangle size={10}/> Logement Inconnu</span> : item.isDuplicate ? <span className="text-orange-600 flex items-center gap-1"><AlertTriangle size={10}/> Doublon</span> : <span className="text-emerald-600 flex items-center gap-1"><Check size={10}/> Nouveau</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <div className="flex gap-4 w-full mt-8">
                  {reviewList.length === 0 ? (
                    <button onClick={startReview} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase shadow-xl hover:bg-blue-600 transition-colors">Analyser le texte</button>
                  ) : (
                    <button onClick={confirmImport} disabled={reviewList.filter(r=>r.selected).length === 0} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase shadow-xl hover:bg-emerald-600 transition-colors disabled:opacity-50">Importer ({reviewList.filter(r=>r.selected).length})</button>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[32px] shadow-lg flex flex-col h-full"><h3 className="text-[10px] font-black uppercase text-slate-400 mb-4">Plateformes</h3><div className="space-y-2 mb-6 flex-1 overflow-y-auto max-h-[200px] text-[10px] font-black uppercase">{(availablePlatforms || []).map(p=>(<div key={p} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl"><span>{p}</span><button onClick={()=>{const n = availablePlatforms.filter(x=>x!==p); setAvailablePlatforms(n); updateSettings({platforms:n})}} className="text-slate-300 hover:text-rose-500"><X size={14}/></button></div>))}</div><form onSubmit={(e)=>{e.preventDefault(); if(inputPlat.trim()){const n = [...availablePlatforms, inputPlat.trim()]; setAvailablePlatforms(n); updateSettings({platforms:n}); setInputPlat('')}}} className="flex gap-2"><input value={inputPlat} onChange={e=>setInputPlat(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-xl text-[10px]" /><button className="bg-slate-900 text-white p-2 rounded-xl">+</button></form></div>
                <div className="bg-white p-6 rounded-[32px] shadow-lg flex flex-col h-full"><h3 className="text-[10px] font-black uppercase text-slate-400 mb-4">Prestataires</h3><div className="space-y-2 mb-6 flex-1 overflow-y-auto max-h-[200px] text-[10px] font-black uppercase">{(availableProviders || []).map(p=>(<div key={p} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl"><span>{p}</span><button onClick={()=>{const n = availableProviders.filter(x=>x!==p); setAvailableProviders(n); updateSettings({providers:n})}} className="text-slate-300 hover:text-rose-500"><X size={14}/></button></div>))}</div><form onSubmit={(e)=>{e.preventDefault(); if(inputProv.trim()){const n = [...availableProviders, inputProv.trim()]; setAvailableProviders(n); updateSettings({providers:n}); setInputProv('')}}} className="flex gap-2"><input value={inputProv} onChange={e=>setInputProv(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-xl text-[10px]" /><button className="bg-slate-900 text-white p-2 rounded-xl">+</button></form></div>
                <div className="bg-white p-6 rounded-[32px] shadow-lg flex flex-col h-full"><h3 className="text-[10px] font-black uppercase text-slate-400 mb-4">Services</h3><div className="space-y-2 mb-6 flex-1 overflow-y-auto max-h-[200px] text-[10px] font-black uppercase">{(availableServiceTypes || []).map(p=>(<div key={p} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl"><span>{p}</span><button onClick={()=>{const n = availableServiceTypes.filter(x=>x!==p); setAvailableServiceTypes(n); updateSettings({services:n})}} className="text-slate-300 hover:text-rose-500"><X size={14}/></button></div>))}</div><form onSubmit={(e)=>{e.preventDefault(); if(inputSvc.trim()){const n = [...availableServiceTypes, inputSvc.trim()]; setAvailableServiceTypes(n); updateSettings({services:n}); setInputSvc('')}}} className="flex gap-2"><input value={inputSvc} onChange={e=>setInputSvc(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-xl text-[10px]" /><button className="bg-slate-900 text-white p-2 rounded-xl">+</button></form></div>
                <div className="bg-white p-6 rounded-[32px] shadow-lg flex flex-col h-full border-2 border-blue-50"><h3 className="text-[10px] font-black uppercase text-blue-600 mb-4">Logements</h3><div className="space-y-2 mb-6 flex-1 overflow-y-auto max-h-[200px] text-[10px] font-black uppercase">{(properties || []).map(p=>(<div key={p.id} className="flex justify-between items-center p-3 bg-blue-50 rounded-xl"><span>{p.name}</span><button onClick={async()=>{if(window.confirm('Supprimer ?'))await deleteDoc(doc(db,'artifacts',appId,'public', 'data', 'properties', p.id))}} className="text-slate-300 hover:text-rose-500"><Trash2 size={14}/></button></div>))}</div><form onSubmit={async(e)=>{e.preventDefault(); if(inputProp.name.trim()){await addDoc(collection(db,'artifacts',appId,'public','data','properties'),{name:inputProp.name.trim(),address:inputProp.address.trim()}); setInputProp({name:'',address:''})}}} className="flex flex-col gap-2"><input required value={inputProp.name} onChange={e=>setInputProp({...inputProp,name:e.target.value})} className="p-3 bg-slate-50 rounded-xl text-[10px] outline-none" placeholder="Nom du bien" /><button type="submit" className="bg-blue-600 text-white p-3 rounded-xl font-black text-[10px] uppercase shadow-md">+ Ajouter</button></form></div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODALE DE RESERVATION SECURISEE */}
      {isModalOpen && formData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-[40px] md:rounded-[60px] shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col border border-slate-100 overflow-hidden"><div className="p-6 md:p-10 border-b flex justify-between items-center bg-white sticky top-0 z-10"><div className="flex items-center gap-4 text-blue-600 font-black uppercase leading-none"><CalendarCheck size={28} /> Détails</div><button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all duration-300"><X size={28} /></button></div><form onSubmit={saveRes} className="p-6 md:p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar text-xs"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Logement<select required value={formData.propertyId || ''} onChange={e => setFormData({ ...formData, propertyId: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900">{(properties || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Voyageur<input required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Début<input type="date" required value={formData.startDate || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Fin<input type="date" required value={formData.endDate || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div></div><div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-8 rounded-[48px] border border-blue-50 space-y-6"><div className="flex justify-between font-black uppercase text-blue-900 border-b border-blue-100 pb-3 text-[11px] tracking-widest">Plateforme<select value={formData.platform || ''} onChange={e => setFormData({ ...formData, platform: e.target.value })} className="bg-white border rounded-xl px-4 py-1 text-blue-600">{(availablePlatforms || []).map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isCplxFormModale ? (
                <><div><label className="text-[10px] font-black uppercase text-slate-400">Brut Client</label><input type="number" step="0.01" value={formData.displayedAmount || ''} onChange={e => setFormData({ ...formData, displayedAmount: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div><div><label className="text-[10px] font-black uppercase text-rose-400">Taxe Séjour</label><input type="number" step="0.01" value={formData.cityTax || ''} onChange={e => setFormData({ ...formData, cityTax: e.target.value })} className="w-full p-4 border border-rose-100 rounded-2xl font-black bg-rose-50/30 text-rose-500" /></div></>
              ) : (
                <><div><label className="text-[10px] font-black uppercase text-slate-400">Brut URSSAF</label><input type="number" step="0.01" value={formData.grossAmount || ''} onChange={e => setFormData({ ...formData, grossAmount: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div><div><label className="text-[10px] font-black uppercase text-slate-400">Commission</label><input type="number" step="0.01" value={formData.platformFees || ''} onChange={e => setFormData({ ...formData, platformFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div></>
              )}
            </div></div><div className="space-y-4">
                <div className="flex justify-between font-black uppercase tracking-widest text-slate-400 text-[10px]">Prestations<button type="button" onClick={() => setFormData({ ...formData, resExpenses: [...(formData.resExpenses || []), { id: Date.now().toString(), person: availableProviders[0] || '', type: availableServiceTypes[0] || '', amount: 0, paymentDate: '' }] })} className="bg-slate-900 text-white px-4 py-2 rounded-xl">+ Ajouter</button></div>
                {(formData.resExpenses || []).map(exp => (
                  <div key={exp.id} className="flex gap-2 bg-slate-50 p-4 rounded-[28px] border border-slate-100 items-center">
                    <select value={exp.person || ''} onChange={e => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).map(x => x.id === exp.id ? { ...x, person: e.target.value } : x) })} className="flex-1 p-3 border rounded-xl font-black uppercase text-[10px]">{(availableProviders || []).map(p => <option key={p} value={p}>{p}</option>)}</select>
                    <select value={exp.type || ''} onChange={e => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 p-3 border rounded-xl font-black uppercase text-[10px]">{(availableServiceTypes || []).map(p => <option key={p} value={p}>{p}</option>)}</select>
                    <input type="number" value={exp.amount || ''} onChange={e => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).map(x => x.id === exp.id ? { ...x, amount: e.target.value } : x) })} className="w-20 p-3 border rounded-xl font-black text-right" />
                    <button type="button" onClick={() => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).filter(x => x.id !== exp.id) })} className="text-rose-500 font-black px-2"><Trash2 size={18}/></button>
                  </div>
                ))}
            </div><div className="bg-slate-900 p-8 rounded-[48px] text-white flex flex-col md:flex-row justify-between items-center gap-6"><div className="text-center md:text-left leading-none"><p className="text-[10px] font-black uppercase text-slate-400 mb-2">Net Estimé</p><p className="text-4xl font-black text-blue-400 tracking-tighter">{(nModale - curChargesModale).toFixed(2)}€</p></div><button type="submit" className="w-full md:w-auto bg-blue-600 px-12 py-5 rounded-[24px] font-black uppercase tracking-[2px] shadow-xl hover:-translate-y-1 transition-all">Enregistrer</button></div></form></div></div>
      )}
    </div>
  );
};

export default App;
