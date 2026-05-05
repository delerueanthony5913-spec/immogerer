import React, { useState, useMemo, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, addDoc, query } from 'firebase/firestore';
import { 
  Home, Euro, LayoutDashboard, Plus, Trash2, MapPin, Calendar as CalendarIcon,
  Menu, X, CalendarCheck, CheckCircle, Clock, PieChart as PieChartIcon,
  ChevronLeft, ChevronRight, BarChart3, List, Wallet, Settings, Calculator,
  UserCheck, PlusCircle, TrendingUp, Info, Filter, Loader2,
  Building2, CalendarRange, MessageSquare, CreditCard, Activity, ArrowRight,
  User, Sparkles, Key, UploadCloud, AlertTriangle, Check, TrendingDown, Search, BarChart2,
  LocateFixed, Lock, Mail, Link
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
  TIME_SLOTS.push(`${hour}:00`);
  TIME_SLOTS.push(`${hour}:30`);
}

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

// --- COMPOSANTS GRAPHIQUES ---
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
          <span className="text-[7px] md:text-[9px] text-slate-400 font-black uppercase leading-none mb-0.5 md:mb-1">Total Net</span>
          <span className="text-sm md:text-xl font-black text-slate-900">{Math.round(displayTotal).toLocaleString('fr-FR')}€</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-1.5 md:space-y-3">
        <h3 className="text-[9px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-2 md:mb-4 text-center md:text-left">{title}</h3>
        <div className="space-y-1 md:space-y-2">
          {visibleData.map((slice, i) => (
            <div key={i} className="flex items-center justify-between text-[9px] md:text-[11px] group">
              <div className="flex items-center gap-1.5 md:gap-3">
                <div className="w-1.5 h-1.5 md:w-3 md:h-3 rounded-full shadow-sm" style={{ backgroundColor: slice.color }}></div>
                <span className="font-bold text-slate-600 truncate max-w-[120px] md:max-w-[140px]">{slice.label}</span>
              </div>
              <span className="font-black text-slate-900 tabular-nums">{Math.round(slice.value).toLocaleString('fr-FR')} €</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ComparisonChart = ({ data, properties, platforms, yearsAvailable = [] }) => {
  const currentYear = new Date().getFullYear().toString();
  const [mode, setMode] = useState('years'); 
  const [metric, setMetric] = useState('net'); 
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [contextYear, setContextYear] = useState(currentYear);
  const [contextProp, setContextProp] = useState('all');
  const [contextPlat, setContextPlat] = useState('all');
  const safeData = Array.isArray(data) ? data : [];
  const safeYears = yearsAvailable.length > 0 ? yearsAvailable : [currentYear];

  useEffect(() => {
    if (mode === 'years') setSelectedKeys(safeYears.slice(0, 3)); 
    if (mode === 'properties') setSelectedKeys(properties.map(p => p.id).slice(0, 4)); 
    if (mode === 'platforms') setSelectedKeys(platforms.slice(0, 4)); 
  }, [mode, properties, platforms, safeYears]);

  const toggleKey = (key) => setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const buildSeriesFor = (targetYear, targetProp, targetPlat) => {
      const res = Array(12).fill(0);
      const prov = Array(12).fill(false);
      const processItem = (dateStr, amount, isProv) => {
          if (!dateStr || !dateStr.startsWith(targetYear)) return;
          const m = parseInt(dateStr.split('-')[1], 10) - 1;
          if (m >= 0 && m <= 11) { res[m] += amount; if (isProv) prov[m] = true; }
      };
      safeData.forEach(t => {
          if (targetProp !== 'all' && t.propertyId !== targetProp) return;
          if (targetPlat !== 'all' && t.platform !== targetPlat) return;
          const isDirect = t.platform === 'En direct';
          const expectedDate = t.endDate || t.startDate || `${targetYear}-12-31`;
          const g = parseFloat(t.grossAmount) || 0;
          const n = parseFloat(t.netAmount) || 0;
          const tax = t.isUrssaf !== false ? g * 0.077 : 0;
          let totalPaidGross = 0;
          if (metric === 'net' || metric === 'gross') {
              if (isDirect) {
                  const a1 = parseFloat(t.acompte1Amount) || 0; const a2 = parseFloat(t.acompte2Amount) || 0; const s = parseFloat(t.soldeAmount) || 0;
                  if (t.acompte1Date) { processItem(t.acompte1Date, a1, false); totalPaidGross += a1; }
                  if (t.acompte2Date) { processItem(t.acompte2Date, a2, false); totalPaidGross += a2; }
                  if (t.soldeDate) { processItem(t.soldeDate, s, false); if (metric === 'net' && tax > 0) processItem(t.soldeDate, -tax, false); totalPaidGross += s; }
                  if (!t.soldeDate) { const remaining = g - totalPaidGross; if (remaining > 0) processItem(expectedDate, remaining, true); if (metric === 'net' && tax > 0) processItem(expectedDate, -tax, true); }
              } else {
                  if (t.paymentDate) { processItem(t.paymentDate, metric === 'gross' ? g : n, false); if (metric === 'net' && tax > 0) processItem(t.paymentDate, -tax, false); }
                  else { processItem(expectedDate, metric === 'gross' ? g : n, true); if (metric === 'net' && tax > 0) processItem(expectedDate, -tax, true); }
              }
          }
          if (metric === 'net' || metric === 'expenses') {
              (t.resExpenses || []).forEach(exp => {
                  const amt = parseFloat(exp.amount) || 0;
                  if (exp.paymentDate) processItem(exp.paymentDate, metric === 'expenses' ? amt : -amt, false);
                  else processItem(expectedDate, metric === 'expenses' ? amt : -amt, true);
              });
          }
      });
      let splitIndex = 11; for (let i = 0; i < 12; i++) { if (prov[i]) { splitIndex = i - 1; break; } }
      return { data: res.map(val => isNaN(val) ? 0 : val), splitIndex };
  };

  const series = selectedKeys.map((key, index) => {
      let result; let label = '';
      if (mode === 'years') { result = buildSeriesFor(key, contextProp, contextPlat); label = key; }
      else if (mode === 'properties') { result = buildSeriesFor(contextYear, key, contextPlat); label = properties.find(p=>p.id===key)?.name || 'Inconnu'; }
      else if (mode === 'platforms') { result = buildSeriesFor(contextYear, contextProp, key); label = key; }
      return { id: key, label, data: result.data, color: CHART_COLORS[index % CHART_COLORS.length], total: result.data.reduce((acc, val) => acc + val, 0), splitIndex: result.splitIndex };
  });

  const [hoveredMonth, setHoveredMonth] = useState(null);
  const months = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  const allDataValues = series.reduce((acc, currentSeries) => acc.concat(currentSeries.data), []);
  const maxValRaw = Math.max(...allDataValues, 100);
  const maxVal = (!isFinite(maxValRaw) || maxValRaw <= 0) ? 100 : maxValRaw * 1.15;
  const w = 900, h = 300, padX = 60, padY = 30; 
  const getX = (i) => padX + (i * (w - 2 * padX) / 11);
  const getY = (val) => isNaN(val) || !maxVal || maxVal === 0 ? h - padY : h - padY - ((val / maxVal) * (h - 2 * padY));
  const buildPath = (dArr, start, end) => {
    if (start > end || start < 0) return '';
    const points = []; for (let i = start; i <= end; i++) { const x = getX(i); const y = getY(dArr[i]); if (!isNaN(x) && !isNaN(y)) points.push(`${x},${y}`); }
    if (points.length === 0) return ''; if (points.length === 1) return `M ${points[0]} L ${points[0]}`;
    return `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(' ');
  };
  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];
  const options = mode === 'years' ? safeYears.map(y => ({ id: y, label: y })) : mode === 'properties' ? properties.map(p => ({ id: p.id, label: p.name })) : platforms.map(p => ({ id: p, label: p }));

  return (
    <div className="w-auto mx-2 md:mx-0 bg-white p-4 md:p-8 rounded-[32px] md:rounded-[48px] shadow-2xl border border-slate-50 animate-in fade-in relative mt-8">
      <div className="flex bg-slate-100 p-1.5 rounded-[20px] w-max mb-6">
         <button onClick={()=>{setMode('years'); setContextProp('all'); setContextPlat('all');}} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'years' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>📅 Années</button>
         <button onClick={()=>{setMode('properties'); setContextYear(currentYear); setContextPlat('all');}} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'properties' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>🏠 Logements</button>
         <button onClick={()=>{setMode('platforms'); setContextYear(currentYear); setContextProp('all');}} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'platforms' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>💻 Platefs.</button>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6 bg-slate-50 p-3 rounded-[24px] border border-slate-100">
         <div className="flex-1">
            <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 mb-2 block">Cochez :</span>
            <div className="flex flex-wrap gap-1.5">
               {options.map((opt) => {
                  const isSelected = selectedKeys.includes(opt.id);
                  const color = isSelected ? CHART_COLORS[selectedKeys.indexOf(opt.id) % CHART_COLORS.length] : '#CBD5E1';
                  return <button key={opt.id} onClick={() => toggleKey(opt.id)} className={`px-2.5 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border ${isSelected ? 'bg-white shadow-sm border-transparent' : 'bg-transparent border-slate-200 text-slate-400'}`} style={{ color: isSelected ? color : undefined }}><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>{opt.label}</button>;
               })}
            </div>
         </div>
         <div className="flex flex-col gap-2 min-w-full md:min-w-[200px]">
             <select value={metric} onChange={e=>setMetric(e.target.value)} className="w-full bg-slate-900 text-white rounded-xl px-2 py-1.5 text-[8px] md:text-[10px] font-black uppercase outline-none shadow-md cursor-pointer"><option value="net">Profit Net Réel</option><option value="gross">CA Brut</option><option value="expenses">Coût Prestations</option></select>
             <div className="flex flex-col gap-1 pl-1">
                 {mode !== 'years' && <select value={contextYear} onChange={e=>setContextYear(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[8px] md:text-[10px] font-bold text-slate-700">{safeYears.map(y=><option key={y} value={y}>Année {y}</option>)}</select>}
                 {mode !== 'properties' && <select value={contextProp} onChange={e=>setContextProp(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[8px] md:text-[10px] font-bold text-slate-700"><option value="all">Tous Logements</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}
                 {mode !== 'platforms' && <select value={contextPlat} onChange={e=>setContextPlat(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[8px] md:text-[10px] font-bold text-slate-700"><option value="all">Toutes Plateformes</option>{platforms.map(p=><option key={p} value={p}>{p}</option>)}</select>}
             </div>
         </div>
      </div>
      <div className="overflow-x-auto hide-scroll touch-manipulation">
        <div className="min-w-[450px] md:min-w-[600px] relative">
          <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            {yTicks.map((tick, i) => (
              <g key={`grid-${i}`}><line x1={padX} y1={getY(tick)} x2={w - padX} y2={getY(tick)} stroke="#F1F5F9" strokeWidth="2" /><text x={w - padX + 8} y={getY(tick) + 4} fill="#475569" fontSize="11" fontWeight="900">{tick >= 1000 ? (tick / 1000).toFixed(1) + 'k€' : Math.round(tick) + '€'}</text></g>
            ))}
            {months.map((m, i) => (
              <text key={m} x={getX(i)} y={h - 5} fill={hoveredMonth === i ? "#0F172A" : "#94A3B8"} fontSize="12" fontWeight="900" textAnchor="middle" onMouseEnter={() => setHoveredMonth(i)} onMouseLeave={() => setHoveredMonth(null)}>{m}</text>
            ))}
            {series.map((s, idx) => (
               <g key={`series-${s.id}`}>
                  <path d={buildPath(s.data, 0, Math.max(0, s.splitIndex))} stroke={s.color} strokeWidth="4" fill="none" strokeLinecap="round" className="transition-all duration-500" />
                  <path d={buildPath(s.data, Math.max(0, s.splitIndex), 11)} stroke={s.color} strokeWidth="4" fill="none" strokeDasharray="6 8" strokeLinecap="round" className="transition-all duration-500" />
               </g>
            ))}
          </svg>
        </div>
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
  const [filterStatus, setFilterStatus] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResId, setEditingResId] = useState(null);
  const [formData, setFormData] = useState({ 
    propertyId: '', name: '', phone: '', startDate: '', endDate: '', paymentDate: '', platform: 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [], comment: '', acompte1Amount: '', acompte1Date: '', acompte2Amount: '', acompte2Date: '', soldeAmount: '', soldeDate: ''
  });
  const [inputPlat, setInputPlat] = useState('');
  const [inputProv, setInputProv] = useState('');
  const [inputProvEmail, setInputProvEmail] = useState(''); 
  const [inputSvc, setInputSvc] = useState('');
  const [inputProp, setInputProp] = useState({ name: '', address: '' });
  const [importSource, setImportSource] = useState('Airbnb');
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [reviewList, setReviewList] = useState([]);
  const [quickPayConfig, setQuickPayConfig] = useState(null); 
  const [statsDetailConfig, setStatsDetailConfig] = useState(null);
  const [hasScrolledToNext, setHasScrolledToNext] = useState(false);
  const scrollContainerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const TABS_ORDER = ['reservations', 'agenda', 'statistiques', 'finances', 'settings'];
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => { if (u) { setUser(u); setLoading(false); } else signInAnonymously(auth); });
    const unsubProps = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), (snap) => { setProperties(snap.docs.map(d => ({ ...d.data(), id: d.id }))); });
    const unsubTenants = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), (snap) => { setTenants(snap.docs.map(d => ({ ...d.data(), id: d.id }))); });
    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), (snap) => {
      if (snap.exists()) { const d = snap.data(); if (d.platforms) setAvailablePlatforms(d.platforms); if (d.providers) setAvailableProviders(d.providers); if (d.services) setAvailableServiceTypes(d.services); if (d.providerEmails) setProviderEmails(d.providerEmails); }
    });
    return () => { unsubAuth(); unsubProps(); unsubTenants(); unsubSettings(); };
  }, []);

  const yearsAvailable = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    tenants.forEach(t => { if (t.startDate) years.add(parseInt(t.startDate.split('-')[0], 10)); });
    return Array.from(years).sort((a, b) => b - a).map(String);
  }, [tenants]);

  const agendaDays = useMemo(() => {
    const y = filterYear === 'all' ? new Date().getFullYear() : parseInt(filterYear);
    const m = filterMonth === 'all' ? new Date().getMonth() : parseInt(filterMonth);
    const firstDay = new Date(y, m, 1), lastDay = new Date(y, m + 1, 0), days = [];
    let offset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < offset; i++) days.push({ empty: true });
    for (let i = 1; i <= lastDay.getDate(); i++) days.push({ day: i, dateStr: `${y}-${(m+1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}` });
    return days;
  }, [filterYear, filterMonth]);

  const generateICalLInk = (propertyId) => {
      const baseUrl = window.location.origin + window.location.pathname;
      return `${baseUrl}?ical=${propertyId}`;
  };

  useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const icalPropId = urlParams.get('ical');
      if (icalPropId && tenants.length > 0) {
          const propRes = tenants.filter(t => t.propertyId === icalPropId);
          const prop = properties.find(p => p.id === icalPropId);
          let icalContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Cadel Manager//NONSGML v1.0//EN\r\n";
          propRes.forEach(r => {
              const start = r.startDate?.replace(/-/g, '') || '';
              const endDt = new Date(r.endDate); endDt.setDate(endDt.getDate() + 1);
              const end = endDt.toISOString().split('T')[0].replace(/-/g, '');
              icalContent += `BEGIN:VEVENT\r\nSUMMARY:LOC - ${r.name || 'Client'} (${r.platform})\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nDESCRIPTION:Logement: ${prop?.name || ''}\\nNotes: ${r.comment || ''}\r\nEND:VEVENT\r\n`;
          });
          icalContent += "END:VCALENDAR";
          const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a'); link.href = url;
          link.setAttribute('download', `calendrier-${prop?.name || 'logement'}.ics`);
          document.body.appendChild(link); link.click(); document.body.removeChild(link);
          window.history.replaceState({}, '', window.location.pathname);
      }
  }, [tenants, properties]);

  const baseTenants = useMemo(() => tenants.filter(t => (filterProp === 'all' || t.propertyId === filterProp) && (filterPlat === 'all' || t.platform === filterPlat)), [tenants, filterProp, filterPlat]);
  const filteredData = useMemo(() => baseTenants.filter(t => {
      const dateRef = t.startDate ? new Date(t.startDate) : new Date();
      return (filterYear === 'all' || dateRef.getFullYear() === parseInt(filterYear)) && (filterMonth === 'all' || dateRef.getMonth() === parseInt(filterMonth)) && (filterProv === 'all' || (t.resExpenses && t.resExpenses.some(e => e.person === filterProv)));
  }), [baseTenants, filterYear, filterMonth, filterProv]);
  const reservationsList = useMemo(() => filteredData.filter(t => filterStatus === 'paid' ? (t.platform === 'En direct' ? !!t.soldeDate : !!t.paymentDate) : filterStatus === 'pending' ? (t.platform === 'En direct' ? !t.soldeDate : !t.paymentDate) : true).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || "")), [filteredData, filterStatus]);
  const groupedReservationsList = useMemo(() => {
      const groups = []; let currentMonthYear = '';
      reservationsList.forEach(t => {
          const start = t.startDate || '';
          if (start) {
              const [year, month] = start.split('-'); const dateObj = new Date(parseInt(year), parseInt(month) - 1);
              const formattedLabel = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
              if (formattedLabel !== currentMonthYear) { groups.push({ isSeparator: true, label: formattedLabel, id: `sep-${year}-${month}` }); currentMonthYear = formattedLabel; }
          }
          groups.push(t);
      });
      return groups;
  }, [reservationsList]);

  const statsCalculations = useMemo(() => {
    const year = filterYear === 'all' ? new Date().getFullYear() : parseInt(filterYear); const prevYear = year - 1;
    let currentYearGross = 0, prevYearGross = 0, currentYearExp = 0, upcomingGross = 0, currentYearNights = 0;
    baseTenants.forEach(t => {
       if (!t.startDate) return;
       const resYear = parseInt(t.startDate.split('-')[0], 10);
       const gross = parseFloat(t.grossAmount) || 0; const exp = (t.resExpenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
       const nights = t.endDate ? Math.max(1, Math.round((new Date(t.endDate) - new Date(t.startDate)) / 86400000)) : 1;
       let isFullyPaid = t.platform === 'En direct' ? !!t.soldeDate : !!t.paymentDate;
       if (!isFullyPaid) upcomingGross += gross;
       if (resYear === year) { currentYearGross += gross; currentYearExp += exp; currentYearNights += nights; } 
       else if (resYear === prevYear) { prevYearGross += gross; }
    });
    const currentBase = baseTenants.filter(t => t.startDate && t.startDate.startsWith(year.toString()));
    const avgStay = currentBase.length > 0 ? (currentYearNights / currentBase.length).toFixed(1) : 0;
    const avgGrossPerRes = currentBase.length > 0 ? (currentYearGross / currentBase.length).toFixed(2) : 0;
    const revPerNight = currentYearNights > 0 ? (currentYearGross / currentYearNights).toFixed(2) : 0;
    const calcGrowth = (curr, prev) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0);
    return { year, prevYear, currentYearGross, currentYearExp, upcomingGross, currentYearNights, avgStay, avgGrossPerRes, revPerNight, grossGrowth: calcGrowth(currentYearGross, prevYearGross) };
  }, [baseTenants, filterYear]);

  const checkDateFilter = (dateStr) => {
    if (!dateStr) return false;
    const [y, mo] = dateStr.split('-');
    if (filterYear !== 'all' && y !== filterYear) return false;
    if (filterMonth !== 'all' && parseInt(mo)-1 !== parseInt(filterMonth)) return false;
    return true;
  };

  const monthlyRecapData = useMemo(() => {
    const stats = {}; const initStats = (m) => { if(!stats[m]) stats[m] = { totalBank: 0, urssafGross: 0, directNet: 0, charges: 0, taxes: 0 }; };
    baseTenants.forEach(t => {
      const isDirect = t.platform === 'En direct';
      if (isDirect) {
          const a1 = parseFloat(t.acompte1Amount) || 0; const a2 = parseFloat(t.acompte2Amount) || 0; const s = parseFloat(t.soldeAmount) || 0;
          if (t.acompte1Date && checkDateFilter(t.acompte1Date)) { initStats(t.acompte1Date.substring(0,7)); stats[t.acompte1Date.substring(0,7)].totalBank += a1; if(t.isUrssaf===false) stats[t.acompte1Date.substring(0,7)].directNet += a1; }
          if (t.acompte2Date && checkDateFilter(t.acompte2Date)) { initStats(t.acompte2Date.substring(0,7)); stats[t.acompte2Date.substring(0,7)].totalBank += a2; if(t.isUrssaf===false) stats[t.acompte2Date.substring(0,7)].directNet += a2; }
          if (t.soldeDate && checkDateFilter(t.soldeDate)) { initStats(t.soldeDate.substring(0,7)); stats[t.soldeDate.substring(0,7)].totalBank += s; if(t.isUrssaf===false) stats[t.soldeDate.substring(0,7)].directNet += s; if (t.isUrssaf !== false) { stats[t.soldeDate.substring(0,7)].urssafGross += (parseFloat(t.grossAmount)||0); stats[t.soldeDate.substring(0,7)].taxes += (parseFloat(t.grossAmount)||0)*0.077; } }
      } else if (t.paymentDate && checkDateFilter(t.paymentDate)) {
          const m = t.paymentDate.substring(0, 7); initStats(m); stats[m].totalBank += (parseFloat(t.netAmount)||0);
          if (t.isUrssaf !== false) { stats[m].urssafGross += (parseFloat(t.grossAmount)||0); stats[m].taxes += (parseFloat(t.grossAmount)||0)*0.077; } else { stats[m].directNet += (parseFloat(t.netAmount)||0); }
      }
      (t.resExpenses || []).forEach(exp => { if (exp.paymentDate && checkDateFilter(exp.paymentDate)) { initStats(exp.paymentDate.substring(0,7)); stats[exp.paymentDate.substring(0,7)].charges += (parseFloat(exp.amount)||0); } });
    });
    return Object.entries(stats).sort((a, b) => b[0].localeCompare(a[0]));
  }, [baseTenants, filterYear, filterMonth]);

  const detailedExpenses = useMemo(() => {
    const list = [];
    baseTenants.forEach(t => (t.resExpenses || []).forEach(exp => { if ((filterProv === 'all' || exp.person === filterProv) && checkDateFilter(exp.paymentDate || t.startDate)) list.push({ id: `${t.id}-${exp.id}`, propertyName: properties.find(p => p.id === t.propertyId)?.name || '--', dateRes: t.startDate, person: exp.person, type: exp.type, amount: parseFloat(exp.amount) || 0, paymentDate: exp.paymentDate || '' }); }));
    return list.sort((a, b) => b.dateRes.localeCompare(a.dateRes));
  }, [baseTenants, properties, filterProv, filterYear, filterMonth]);

  const handleScroll = () => { if (!scrollContainerRef.current || isScrollingRef.current) return; const newIndex = Math.round(scrollContainerRef.current.scrollLeft / scrollContainerRef.current.clientWidth); if (TABS_ORDER[newIndex] && TABS_ORDER[newIndex] !== activeTab) setActiveTab(TABS_ORDER[newIndex]); };
  const changeTab = (tabId) => { setActiveTab(tabId); setIsMobileMenuOpen(false); const index = TABS_ORDER.indexOf(tabId); if (scrollContainerRef.current) { isScrollingRef.current = true; scrollContainerRef.current.scrollTo({ left: index * scrollContainerRef.current.clientWidth, behavior: 'smooth' }); setTimeout(() => { isScrollingRef.current = false; }, 600); } };
  const scrollToCurrentRes = (withFlash = false) => {
    if (reservationsList.length === 0) return; let targetRes = reservationsList.find(t => t.startDate >= todayStr || (t.endDate && t.endDate >= todayStr)) || reservationsList[reservationsList.length - 1];
    if (targetRes) { document.querySelectorAll(`[data-res-id="${targetRes.id}"]`).forEach(el => { const container = el.closest('.overflow-y-auto'); if (container && window.getComputedStyle(el).display !== 'none') { container.scrollTo({ top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' }); if (withFlash) { const bg = el.style.backgroundColor; el.style.backgroundColor = '#FEF9C3'; el.style.transition = 'background-color 0.8s ease'; setTimeout(() => el.style.backgroundColor = bg, 2500); } } }); }
  };
  useEffect(() => { if (activeTab === 'reservations' && !hasScrolledToNext && reservationsList.length > 0) { setTimeout(() => { scrollToCurrentRes(false); setHasScrolledToNext(true); }, 500); } }, [activeTab, reservationsList]);

  const getTenantProfitForStats = (t) => {
    let profit = 0;
    if (t.platform === 'En direct') {
        const a1 = parseFloat(t.acompte1Amount) || 0, a2 = parseFloat(t.acompte2Amount) || 0, s = parseFloat(t.soldeAmount) || 0;
        if (t.acompte1Date && checkDateFilter(t.acompte1Date)) profit += a1;
        if (t.acompte2Date && checkDateFilter(t.acompte2Date)) profit += a2;
        if (t.soldeDate && checkDateFilter(t.soldeDate)) { profit += s; if (t.isUrssaf !== false) profit -= (parseFloat(t.grossAmount) || 0) * 0.077; }
    } else { if (t.paymentDate && checkDateFilter(t.paymentDate)) { profit += (parseFloat(t.netAmount) || 0); if (t.isUrssaf !== false) profit -= (parseFloat(t.grossAmount) || 0) * 0.077; } }
    (t.resExpenses || []).forEach(exp => { if (exp.paymentDate && checkDateFilter(exp.paymentDate)) profit -= (parseFloat(exp.amount) || 0); });
    return profit;
  };

  const handlePinSubmit = (e) => { e.preventDefault(); if (pinInput === 'Cadel2026') { localStorage.setItem('cadel_unlocked', 'true'); setIsUnlocked(true); } else { setPinError(true); setPinInput(''); } };
  const getRowColors = (id) => { const name = properties.find(p=>p.id===id)?.name?.toLowerCase() || ''; return name.includes('cocon') || name.includes('kadelia') ? { bg: 'bg-emerald-50' } : name.includes('signes') || name.includes('cadelio') ? { bg: 'bg-blue-50' } : name.includes('villa') || name.includes('cadelia') ? { bg: 'bg-red-50' } : { bg: 'bg-white' }; };
  const getStatusProps = (t) => t.platform === 'En direct' ? (t.soldeDate ? { label: 'Payé', color: 'bg-emerald-100 text-emerald-700' } : t.acompte1Date || t.acompte2Date ? { label: 'Incomplet', color: 'bg-blue-100 text-blue-700' } : { label: 'Attente', color: 'bg-orange-100 text-orange-700' }) : (t.paymentDate ? { label: 'Payé', color: 'bg-emerald-100 text-emerald-700' } : { label: 'Attente', color: 'bg-orange-100 text-orange-700' });
  
  const updateDiasField = (expId, field, value) => {
    setFormData(prev => {
        const newExpenses = (prev.resExpenses || []).map(x => {
            if (x.id === expId) {
                const updated = { ...x, [field]: value };
                if (field === 'dateEntry') updated.rateEntry = isSundayOrHoliday(value) ? 25 : 15;
                if (field === 'dateExit') updated.rateExit = isSundayOrHoliday(value) ? 25 : 15;
                const he = parseFloat(updated.hoursEntry) || 0, re = parseFloat(updated.rateEntry) || 0;
                const hs = parseFloat(updated.hoursExit) || 0, rs = parseFloat(updated.rateExit) || 0;
                updated.amount = (he * re) + (hs * rs);
                return updated;
            }
            return x;
        });
        return { ...prev, resExpenses: newExpenses };
    });
  };

  const getProviderCalendarUrl = (exp, prop, type) => {
    const isEntry = type === 'ENTREE'; const dateStr = isEntry ? exp.dateEntry : exp.dateExit; const timeStr = isEntry ? exp.timeEntry : exp.timeExit; const hours = isEntry ? parseFloat(exp.hoursEntry) || 0 : parseFloat(exp.hoursExit) || 0; if (!dateStr) return '#';
    const title = encodeURIComponent(`MENAGE ${prop?.name?.toUpperCase() || ''} ${type}`); const details = encodeURIComponent(exp.providerNote || '');
    let dates = '';
    if (timeStr && hours > 0) {
        const [y, m, d] = dateStr.split('-'); const [hh, mm] = timeStr.split(':'); const startObj = new Date(y, m - 1, d, hh, mm); const endObj = new Date(startObj.getTime() + hours * 60 * 60 * 1000);
        const f = (dt) => `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}00`;
        dates = `${f(startObj)}/${f(endObj)}`;
    } else { const [y, m, d] = dateStr.split('-'); const s = new Date(y, m - 1, d); const e = new Date(s); e.setDate(e.getDate() + 1); const f = (dt) => `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`; dates = `${f(s)}/${f(e)}`; }
    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
    if (providerEmails[exp.person]) url += `&add=${encodeURIComponent(providerEmails[exp.person])}`;
    return url;
  };

  const getGoogleCalendarUrl = (res, prop) => {
    if (!res.startDate || !res.endDate) return '#';
    const text = encodeURIComponent(`Réservation : ${res.name} - ${prop?.name || ''}`);
    let expensesText = '';
    let guestEmails = [];
    if (res.resExpenses && res.resExpenses.length > 0) {
       expensesText = '\n\nPrestations :\n' + res.resExpenses.map(e => {
           const isDias = e.person && e.person.toLowerCase().includes('dias');
           if (e.sendEmail !== false && providerEmails[e.person] && !isDias) { guestEmails.push(providerEmails[e.person]); }
           return `- ${e.type} (${e.person})`;
       }).join('\n');
    }
    const dt = encodeURIComponent(`Client : ${res.name}\nLogement : ${prop?.name || ''}\nPlateforme : ${res.platform}\nNotes : ${res.comment || ''}${expensesText}`);
    const eObj = new Date(res.endDate); eObj.setDate(eObj.getDate() + 1);
    const fE = `${eObj.getFullYear()}${String(eObj.getMonth() + 1).padStart(2, '0')}${String(eObj.getDate()).padStart(2, '0')}`;
    const dates = `${res.startDate.replace(/-/g, '')}/${fE}`;
    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${dt}`;
    if (guestEmails.length > 0) { const uniqueEmails = [...new Set(guestEmails)]; const emailsParam = uniqueEmails.map(email => `add=${encodeURIComponent(email)}`).join('&'); url += `&${emailsParam}`; }
    return url;
  };

  const updateSettings = async (n) => { if(!user) return; await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), n, { merge: true }); };
  const saveRes = async (e) => {
    e.preventDefault(); if (!formData.propertyId || !formData.name || !formData.startDate || !formData.endDate) { alert("Champs obligatoires."); return; }
    const isDirect = formData.platform === 'En direct'; const isC = formData.platform === 'Booking' || formData.platform === 'Abritel';
    const disp = parseFloat(formData.displayedAmount) || 0; const city = parseFloat(formData.cityTax) || 0; const plat = parseFloat(formData.platformFees) || 0; const bank = parseFloat(formData.bankFees) || 0; const gross = parseFloat(formData.grossAmount) || 0;
    const a1 = parseFloat(formData.acompte1Amount) || 0; const a2 = parseFloat(formData.acompte2Amount) || 0; const s = parseFloat(formData.soldeAmount) || 0;
    const g = isDirect ? gross : (isC ? (disp - city) : gross);
    const n = isDirect ? gross : (isC ? (g - plat - bank) : (g - plat));
    const d = { ...formData, isUrssaf: formData.isUrssaf !== false, grossAmount: g, netAmount: n, platformFees: plat, bankFees: bank, cityTax: city, displayedAmount: disp, acompte1Amount: a1, acompte2Amount: a2, soldeAmount: s, resExpenses: (formData.resExpenses || []).map(r => ({ ...r, amount: parseFloat(r.amount) || 0 })) };
    delete d.id; if (editingResId) { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', editingResId), d); } else { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), d); }
    setIsModalOpen(false);
  };
  const deleteRes = async (id) => { if(window.confirm("Supprimer ?")) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', id)); setIsModalOpen(false); } };

  if (!isUnlocked) return <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans text-center overflow-hidden relative"><div className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col items-center animate-in zoom-in-95 relative z-10"><div className="bg-slate-50 p-4 rounded-3xl mb-6 shadow-inner border border-slate-100"><Key size={48} className="text-blue-600" /></div><h1 className="font-black text-2xl uppercase tracking-tighter text-slate-900 mb-1">Cadel Manager</h1><p className="text-[10px] uppercase tracking-widest text-slate-400 mb-8 font-bold">Espace Sécurisé</p><form onSubmit={handlePinSubmit} className="w-full flex flex-col gap-4"><div><input type="password" value={pinInput} onChange={(e) => { setPinInput(e.target.value); setPinError(false); }} placeholder="Votre mot de passe" className={`w-full p-4 bg-slate-50 border rounded-2xl font-black text-center text-lg tracking-widest outline-none transition-all ${pinError ? 'border-rose-500 text-rose-500' : 'border-slate-200'}`} autoFocus />{pinError && <p className="text-rose-500 text-[10px] font-black uppercase mt-2">Mot de passe incorrect</p>}</div><button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase text-sm shadow-xl shadow-blue-200 hover:bg-indigo-600 transition-all">Déverrouiller</button></form></div></div>;
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col gap-6 animate-in zoom-in-95 text-center">
              <h3 className="font-black text-xl uppercase">Valider le paiement</h3>
              <input type="date" value={quickPayConfig.date} onChange={e => setQuickPayConfig({...quickPayConfig, date: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-center" />
              <div className="flex gap-3"><button onClick={() => setQuickPayConfig(null)} className="flex-1 p-4 rounded-2xl text-slate-400">Annuler</button><button onClick={submitQuickPay} className="flex-1 p-4 rounded-2xl bg-emerald-500 text-white font-black">Encaisser</button></div>
            </div>
          </div>
        )}
        <div className="sticky top-0 z-30 bg-[#F8FAFC]/95 backdrop-blur-md pt-2 pb-4 px-2 md:px-0"><div className="flex flex-wrap items-center gap-2 bg-white/80 p-3 rounded-[28px] border border-white shadow-lg mx-auto max-w-7xl"><div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100"><Filter size={12} className="text-slate-400" /><select value={filterYear} onChange={e => {setFilterYear(e.target.value); setHasScrolledToNext(false);}} className="text-[10px] font-black uppercase bg-transparent outline-none cursor-pointer"><option value="all">Toutes Années</option>{yearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}</select></div><div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100"><select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none cursor-pointer"><option value="all">Mois (Tous)</option>{['Janv','Févr','Mars','Avril','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'].map((m,i)=><option key={i} value={i}>{m}</option>)}</select></div><div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100"><select value={filterProp} onChange={e => setFilterProp(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none max-w-[100px] md:max-w-[130px] cursor-pointer"><option value="all">Logements</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100"><select value={filterPlat} onChange={e => setFilterPlat(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none cursor-pointer"><option value="all">Plateformes</option>{availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}</select></div></div></div>
        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory hide-scroll">
          {/* 1. RÉSERVATIONS */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border" style={{ scrollSnapStop: 'always' }}><div className="max-w-7xl mx-auto pb-32"><div className="flex justify-between items-center mx-2 md:mx-0 mb-6"><h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Réservations</h2><div className="flex items-center gap-2 md:gap-4"><button onClick={() => scrollToCurrentRes(true)} className="p-3 md:px-4 md:py-3 bg-white text-blue-600 rounded-full md:rounded-[20px] shadow-lg border border-slate-100 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"><LocateFixed size={18} /><span className="hidden md:inline font-black text-[10px] uppercase">Aujourd'hui</span></button><button onClick={() => { setEditingResId(null); setFormData({ propertyId: properties[0]?.id || '', name: '', phone: '', startDate: '', endDate: '', paymentDate: '', platform: availablePlatforms[0] || 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [], comment: '', acompte1Amount: '', acompte1Date: '', acompte2Amount: '', acompte2Date: '', soldeAmount: '', soldeDate: '' }); setIsModalOpen(true); }} className="bg-blue-600 text-white px-6 py-3 md:px-8 md:py-4 rounded-[20px] md:rounded-[24px] font-black text-[11px] shadow-xl hover:bg-blue-700 transition-all">+ Nouvelle</button></div></div><div className="md:hidden max-h-[70vh] overflow-y-auto custom-scrollbar p-1 rounded-[20px] border border-slate-100 bg-slate-50/50 shadow-inner mx-2 relative"><div className="grid grid-cols-1 gap-2.5">{(groupedReservationsList || []).map(item => { if (item.isSeparator) return <div key={item.id} className="flex items-center justify-center mt-2 mb-0.5"><span className="bg-slate-800 text-white px-4 py-1.5 rounded-[10px] text-[8px] font-black uppercase tracking-[0.2em] shadow-sm">{item.label}</span></div>; const t = item; const c = getRowColors(t.propertyId); return <div key={t.id} data-res-id={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className={`${c.bg} p-3 rounded-[16px] shadow-sm border border-slate-50 cursor-pointer transition-colors`}><div className="flex justify-between items-start mb-1.5"><div><h3 className="text-sm font-black uppercase leading-tight">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}</h3><div className="flex items-center gap-1.5 mt-1 leading-tight"><span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{t.platform}</span><span className="text-[11px] font-black text-slate-700">{t.name}</span></div></div><div className="flex flex-col items-end"><span onClick={(e) => handleQuickPayToggle(e, t, 'global')} className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase cursor-pointer inline-block ${getStatusProps(t).color}`}>{getStatusProps(t).label}</span>{t.paymentDate && <span className="text-[7px] text-slate-400 mt-1 font-bold">{formatDateFr(t.paymentDate)}</span>}</div></div><div className="bg-white/60 p-2 rounded-[12px] flex justify-between font-black text-[9px] mb-1.5 items-center"><span>{formatDateFr(t.startDate)}</span><ArrowRight size={10} className="text-slate-300"/><span>{formatDateFr(t.endDate)}</span></div>{t.comment && <div className="text-[9px] italic text-slate-600 mb-1.5 px-1 leading-tight whitespace-pre-wrap">📝 {t.comment}</div>}<div className="text-right font-black text-sm">{(parseFloat(t.netAmount) || 0).toFixed(2)}€</div></div>; })}</div></div><div className="hidden md:block bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100"><div className="max-h-[70vh] overflow-y-auto custom-scrollbar relative"><table className="w-full text-left text-xs"><thead className="bg-slate-50 font-black uppercase border-b text-slate-400 sticky top-0 z-20 shadow-sm"><tr><th className="p-4 w-[15%]">Logement</th><th className="p-4 w-[15%]">Client</th><th className="p-4 w-[12%] text-center">Dates</th><th className="p-4 w-[25%]">Notes</th><th className="p-4 w-[18%]">Prestations</th><th className="p-4 text-right">Net</th><th className="p-4 text-center">État</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold">{(groupedReservationsList || []).map(item => { if (item.isSeparator) return <tr key={item.id} className="bg-slate-100/50"><td colSpan="7" className="p-3 text-center"><span className="bg-slate-800 text-white px-5 py-2 rounded-[14px] text-[10px] font-black uppercase tracking-[0.2em] shadow-md inline-block">{item.label}</span></td></tr>; const t = item; const c = getRowColors(t.propertyId); return <tr key={t.id} data-res-id={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className={`${c.bg} cursor-pointer hover:bg-slate-50`}><td className="p-4 uppercase"><div className="font-black">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}</div><div className="text-blue-600 text-xs font-black mt-0.5">{t.platform}</div></td><td className="p-4"><div className="text-sm font-black">{t.name}</div></td><td className="p-4 text-center text-slate-500 whitespace-nowrap">{formatDateFr(t.startDate)} <ArrowRight size={10} className="inline" /> {formatDateFr(t.endDate)}</td><td className="p-4 text-[11px] text-slate-600 font-medium">{t.comment ? <div className="bg-slate-50/50 p-2 rounded-xl italic">📝 {t.comment}</div> : ''}</td><td className="p-4"><div className="space-y-1.5">{(t.resExpenses || []).map((exp, idx) => (<div key={idx} className="flex items-center justify-between text-[10px] bg-white/50 p-1.5 rounded-lg border border-slate-100/50"><span className="uppercase font-black text-slate-500 leading-none">{exp.type} ({exp.person})</span><div className="text-right"><div className="flex items-center justify-end gap-1.5"><span className={`font-black ${exp.paymentDate ? 'text-emerald-600' : 'text-orange-500'}`}>{exp.amount}€</span>{exp.paymentDate ? <CheckCircle size={10} /> : <Clock size={10} />}</div></div></div>))}</div></td><td className="p-4 text-right font-black">{(parseFloat(t.netAmount) || 0).toFixed(2)}€</td><td className="p-4 text-center"><span onClick={(e) => handleQuickPayToggle(e, t, 'global')} className={`px-4 py-2 rounded-full text-[9px] uppercase cursor-pointer inline-block ${getStatusProps(t).color}`}>{getStatusProps(t).label}</span></td></tr>; })}</tbody></table></div></div></div></div>

          {/* 2. AGENDA */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border" style={{ scrollSnapStop: 'always' }}><div className="max-w-7xl mx-auto pb-32"><h2 className="text-2xl md:text-3xl font-black uppercase mb-6 mx-2">Agenda</h2><div className="bg-white p-4 md:p-6 rounded-[32px] md:rounded-[40px] shadow-2xl overflow-x-auto mx-2 md:mx-0"><div className="min-w-[320px] md:min-w-[700px]"><div className="grid grid-cols-7 text-center font-black text-slate-300 text-[8px] md:text-[10px] uppercase mb-4">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=><div key={d}>{d}</div>)}</div><div className="grid grid-cols-7 gap-1 md:gap-2">{(agendaDays || []).map((item,idx)=>{ if(item.empty) return <div key={idx} className="h-16 md:h-32 bg-slate-50/30 rounded-xl md:rounded-2xl"></div>; const dayRes = (reservationsList || []).filter(r=>item.dateStr>=r.startDate && item.dateStr<=r.endDate); return (<div key={item.dateStr} className={`h-16 md:h-32 border rounded-xl md:rounded-2xl p-1 md:p-2 flex flex-col ${item.dateStr===todayStr?'border-blue-500 bg-blue-50/10':'border-slate-100'}`}><span className="text-[8px] md:text-[10px] font-black text-slate-300">{item.day}</span><div className="flex-1 space-y-0.5 overflow-y-auto no-scrollbar">{dayRes.map(r=>(<div key={r.id} onClick={()=> {setEditingResId(r.id); setFormData(r); setIsModalOpen(true);}} className="text-[6px] md:text-[8px] font-black text-white p-0.5 rounded truncate" style={{backgroundColor: CHART_COLORS[(properties || []).findIndex(p=>p.id===r.propertyId)%CHART_COLORS.length]}}>{r.name?.split(' ')[0]}</div>))}</div></div>);})}</div></div></div></div></div>

          {/* 3. STATISTIQUES */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border" style={{ scrollSnapStop: 'always' }}><div className="max-w-7xl mx-auto pb-32 space-y-10 px-2"><h2 className="text-3xl md:text-4xl font-black uppercase text-slate-900 tracking-tighter">Statistiques</h2><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div className="bg-white p-3 md:p-6 rounded-[20px] md:rounded-[32px] shadow-xl border border-slate-50 text-center"><p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CA Brut ({statsCalculations.year})</p><p className="text-xl md:text-3xl font-black text-indigo-600">{Math.round(statsCalculations.currentYearGross).toLocaleString('fr-FR')}€</p></div><div className="bg-white p-3 md:p-6 rounded-[20px] md:rounded-[32px] shadow-xl border border-slate-50 text-center"><p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CA à venir</p><p className="text-xl md:text-3xl font-black text-blue-600">{Math.round(statsCalculations.upcomingGross).toLocaleString('fr-FR')}€</p></div><div className="bg-white p-3 md:p-6 rounded-[20px] md:rounded-[32px] shadow-xl border border-slate-50 text-center"><p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Coût Prestations</p><p className="text-xl md:text-3xl font-black text-rose-500">-{Math.round(statsCalculations.currentYearExp).toLocaleString('fr-FR')}€</p></div><div className="bg-white p-3 md:p-6 rounded-[20px] md:rounded-[32px] shadow-xl border border-slate-50 text-center"><p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CA / Nuit</p><p className="text-xl md:text-3xl font-black text-emerald-600">{statsCalculations.revPerNight}€</p></div></div><ComparisonChart data={baseTenants} properties={properties} platforms={availablePlatforms} yearsAvailable={yearsAvailable} /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><DonutChart title={`Net / Logement (${filterYear})`} data={(properties || []).map((p,idx)=>({label:p.name,value:(baseTenants || []).reduce((acc,t) => t.propertyId===p.id ? acc + getTenantProfitForStats(t) : acc, 0),color:CHART_COLORS[idx%CHART_COLORS.length]}))} /><DonutChart title={`Net / Plateforme (${filterYear})`} data={(availablePlatforms || []).map((p,idx)=>({label:p,value:(baseTenants || []).reduce((acc,t) => t.platform===p ? acc + getTenantProfitForStats(t) : acc, 0),color:CHART_COLORS[(idx+4)%CHART_COLORS.length]}))} /></div></div></div>

          {/* 4. FINANCES */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border" style={{ scrollSnapStop: 'always' }}><div className="max-w-7xl mx-auto pb-32 space-y-10 px-2"><h2 className="text-3xl font-black uppercase">Comptabilité</h2><div className="bg-white rounded-[24px] shadow-2xl overflow-hidden border border-slate-100"><div className="p-3 md:p-8 bg-slate-900 text-white font-black text-[10px] uppercase">Bilan Global</div><div className="max-h-[60vh] overflow-y-auto overflow-x-auto custom-scrollbar relative"><table className="w-full text-left min-w-[500px]"><thead className="bg-slate-50 uppercase text-slate-400 border-b text-[10px]"><tr><th className="p-4">Période</th><th className="p-4 text-right">Brut URSSAF</th><th className="p-4 text-right text-indigo-600">Virement</th><th className="p-4 text-right text-slate-500">Prest.</th><th className="p-4 text-right font-black">Profit</th></tr></thead><tbody className="divide-y font-bold">{(monthlyRecapData || []).map(([m, d]) => (<tr key={m} className="text-xs group hover:bg-slate-50/50"><td className="p-4 capitalize">{m}</td><td className="p-4 text-right text-slate-500">{d.urssafGross.toLocaleString('fr-FR')}€</td><td className="p-4 text-right text-indigo-600 font-black">{d.totalBank.toLocaleString('fr-FR')}€</td><td className="p-4 text-right text-slate-500">-{d.charges.toLocaleString('fr-FR')}€</td><td className={`p-4 text-right font-black ${d.totalBank - d.taxes - d.charges >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{(d.totalBank - d.taxes - d.charges).toLocaleString('fr-FR')}€</td></tr>))}</tbody><tfoot className="bg-indigo-600 text-white font-black"><tr><td className="p-4 uppercase">TOTAL</td><td className="p-4 text-right">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.urssafGross, 0).toLocaleString('fr-FR')}€</td><td className="p-4 text-right">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0).toLocaleString('fr-FR')}€</td><td className="p-4 text-right">-{monthlyRecapData.reduce((acc, [m, d]) => acc + d.charges, 0).toLocaleString('fr-FR')}€</td><td className="p-4 text-right">{(monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0) - monthlyRecapData.reduce((acc, [m, d]) => acc + d.taxes + d.charges, 0)).toLocaleString('fr-FR')}€</td></tr></tfoot></table></div></div><div className="bg-white rounded-[24px] shadow-2xl overflow-hidden border border-slate-100"><div className="p-3 md:p-8 bg-slate-900 text-white font-black text-[10px] uppercase">Détail Prestataires</div><div className="max-h-[60vh] overflow-y-auto relative"><table className="w-full text-left min-w-[400px]"><thead className="bg-slate-50 uppercase text-slate-400 border-b text-[10px]"><tr><th className="p-4">Date</th><th className="p-4">Logement</th><th className="p-4">Prestataire</th><th className="p-4 text-right">Montant</th></tr></thead><tbody className="divide-y font-bold">{(detailedExpenses || []).map((exp) => (<tr key={exp.id} className="text-xs"><td className="p-4">{formatDateFr(exp.dateRes)}</td><td className="p-4 uppercase">{exp.propertyName}</td><td className="p-4 text-blue-600">{exp.person}</td><td className="p-4 text-right">{(exp.amount || 0).toLocaleString('fr-FR')}€</td></tr>))}</tbody></table></div></div></div></div>

          {/* 5. PARAMÈTRES */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border" style={{ scrollSnapStop: 'always' }}><div className="max-w-7xl mx-auto pb-32 space-y-10 px-2"><h2 className="text-3xl font-black uppercase">Paramètres</h2><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"><div className="bg-white p-6 rounded-[32px] shadow-lg border-2 border-blue-50"><h3 className="text-[10px] font-black uppercase text-blue-600 mb-4">Logements & iCal</h3><div className="space-y-2 mb-6 max-h-[400px] overflow-y-auto">{(properties || []).map(p=>(<div key={p.id} className="flex flex-col gap-2 p-3 bg-blue-50 rounded-xl"><div className="flex justify-between items-center text-[10px] font-black uppercase"><span>{p.name}</span><button onClick={async()=>{if(window.confirm('Supprimer ?'))await deleteDoc(doc(db,'artifacts',appId,'public', 'data', 'properties', p.id))}} className="text-slate-300 hover:text-rose-500"><Trash2 size={14}/></button></div><button onClick={()=>{navigator.clipboard.writeText(generateICalLInk(p.id)); alert('Lien copié !');}} className="w-full bg-white text-blue-600 text-[9px] font-black py-2 rounded-lg flex items-center justify-center gap-2 border border-blue-200"><Link size={12}/> Copier iCal</button></div>))}</div><form onSubmit={async(e)=>{e.preventDefault(); if(inputProp.name.trim()){await addDoc(collection(db,'artifacts',appId,'public','data','properties'),{name:inputProp.name.trim(),address:inputProp.address.trim()}); setInputProp({name:'',address:''})}}} className="flex flex-col gap-2"><input required value={inputProp.name} onChange={e=>setInputProp({...inputProp,name:e.target.value})} className="p-3 bg-slate-50 rounded-xl text-[10px]" placeholder="Nom du bien" /><button type="submit" className="bg-slate-900 text-white p-3 rounded-xl font-black text-[10px] uppercase shadow-md">+ Ajouter</button></form></div><div className="bg-white p-6 rounded-[32px] shadow-lg flex flex-col h-full border-2 border-blue-50"><h3 className="text-[10px] font-black uppercase text-blue-600 mb-4">Prestataires (Emails)</h3><div className="space-y-2 mb-6 flex-1 overflow-y-auto max-h-[200px] text-[10px] font-black uppercase">{(availableProviders || []).map(p=>(<div key={p} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100"><div><span className="block">{p}</span>{providerEmails[p] && <span className="text-[8px] normal-case text-slate-400 block mt-0.5"><Mail size={8} className="inline mr-1"/>{providerEmails[p]}</span>}</div><button onClick={()=>{const n = availableProviders.filter(x=>x!==p); setAvailableProviders(n); const newEmails = {...providerEmails}; delete newEmails[p]; setProviderEmails(newEmails); updateSettings({providers:n, providerEmails: newEmails});}} className="text-slate-300 hover:text-rose-500"><Trash2 size={14}/></button></div>))}</div><form onSubmit={(e)=>{e.preventDefault(); if(inputProv.trim()){const n = [...availableProviders, inputProv.trim()]; setAvailableProviders(n); const newEmails = {...providerEmails}; if (inputProvEmail.trim()) newEmails[inputProv.trim()] = inputProvEmail.trim(); setProviderEmails(newEmails); updateSettings({providers:n, providerEmails: newEmails}); setInputProv(''); setInputProvEmail('');}}} className="flex flex-col gap-2"><input value={inputProv} onChange={e=>setInputProv(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-[10px]" placeholder="Nom (ex: Dias)" /><input type="email" value={inputProvEmail} onChange={e=>setInputProvEmail(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-[10px]" placeholder="Email (facultatif)" /><button type="submit" className="bg-blue-600 text-white p-2.5 rounded-xl font-black text-[10px] uppercase">+ Ajouter</button></form></div></div></div></div>
        </div>
      </main>
      {isModalOpen && formData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"><div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div><div className="bg-white rounded-[40px] md:rounded-[60px] shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col border border-slate-100 overflow-hidden relative z-10"><div className="p-6 md:p-10 border-b flex justify-between items-center bg-white sticky top-0 z-10"><div className="flex items-center gap-4 text-blue-600 font-black uppercase leading-none"><CalendarCheck size={28} /> Détails</div><div className="flex items-center gap-2"><a href={getGoogleCalendarUrl(formData, (properties || []).find(p => p.id === formData.propertyId))} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition-all shadow-sm"><CalendarIcon size={20} /></a><button type="button" onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all duration-300"><X size={20} /></button></div></div><form onSubmit={saveRes} className="p-6 md:p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar text-xs"><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="space-y-1 uppercase font-black text-slate-400 text-[10px]">Logement<select value={formData.propertyId || ''} onChange={e => setFormData({ ...formData, propertyId: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900">{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="space-y-1 uppercase font-black text-slate-400 text-[10px]">Voyageur<input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="space-y-1 uppercase font-black text-slate-400 text-[10px]">Contact<input value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="space-y-1 uppercase font-black text-slate-400 text-[10px]">Début<input type="date" value={formData.startDate || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="space-y-1 uppercase font-black text-slate-400 text-[10px]">Fin<input type="date" value={formData.endDate || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div><div className="md:col-span-3 space-y-1 uppercase font-black text-slate-400 text-[10px]">Notes<textarea value={formData.comment || ''} onChange={e => setFormData({ ...formData, comment: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-bold text-slate-700 min-h-[100px]" /></div></div><div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-8 rounded-[48px] border border-blue-50 space-y-6"><div className="flex flex-col md:flex-row md:items-center justify-between font-black uppercase text-blue-900 border-b border-blue-100 pb-4 gap-4 text-[11px]">Plateforme<select value={formData.platform || ''} onChange={e => setFormData({ ...formData, platform: e.target.value })} className="bg-white border rounded-xl px-4 py-2 text-blue-600 outline-none">{availablePlatforms.map(p => <option key={p} value={p}>{p}</option>)}</select><label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border shadow-sm"><input type="checkbox" checked={formData.isUrssaf !== false} onChange={e => setFormData({ ...formData, isUrssaf: e.target.checked })} className="w-4 h-4" /><span>URSSAF</span></label></div>{formData.platform === 'En direct' ? (<div className="space-y-4"><div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4"><div className="w-full md:w-1/2"><label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Montant Global</label><input type="number" step="0.01" value={formData.grossAmount || ''} onChange={e => setFormData({ ...formData, grossAmount: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-lg" /></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm"><label className="text-[10px] font-black text-slate-400 mb-2 block">Acompte 1</label><input type="number" step="0.01" value={formData.acompte1Amount || ''} onChange={e => setFormData({ ...formData, acompte1Amount: e.target.value })} className="w-full p-3 border border-slate-100 rounded-xl mb-2 font-black" /><input type="date" value={formData.acompte1Date || ''} onChange={e => setFormData({ ...formData, acompte1Date: e.target.value })} className="w-full p-3 border border-slate-100 rounded-xl" /></div><div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm"><label className="text-[10px] font-black text-slate-400 mb-2 block">Acompte 2</label><input type="number" step="0.01" value={formData.acompte2Amount || ''} onChange={e => setFormData({ ...formData, acompte2Amount: e.target.value })} className="w-full p-3 border border-slate-100 rounded-xl mb-2 font-black" /><input type="date" value={formData.acompte2Date || ''} onChange={e => setFormData({ ...formData, acompte2Date: e.target.value })} className="w-full p-3 border border-slate-100 rounded-xl" /></div><div className="bg-emerald-50/50 p-4 rounded-3xl border border-emerald-100 shadow-sm"><label className="text-[10px] font-black text-emerald-600 mb-2 block">Solde</label><input type="number" step="0.01" value={formData.soldeAmount || ''} onChange={e => setFormData({ ...formData, soldeAmount: e.target.value })} className="w-full p-3 border border-emerald-200 rounded-xl mb-2 font-black" /><input type="date" value={formData.soldeDate || ''} onChange={e => setFormData({ ...formData, soldeDate: e.target.value })} className="w-full p-3 border border-emerald-200 rounded-xl" /></div></div></div>) : (<div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div><label className="text-[10px] font-black text-slate-400 uppercase">Total Appli</label><input type="number" step="0.01" value={formData.displayedAmount || ''} onChange={e => setFormData({ ...formData, displayedAmount: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div><div><label className="text-[10px] font-black text-rose-400 uppercase">Taxe Séjour</label><input type="number" step="0.01" value={formData.cityTax || ''} onChange={e => setFormData({ ...formData, cityTax: e.target.value })} className="w-full p-4 border border-rose-100 rounded-2xl font-black text-rose-500" /></div><div><label className="text-[10px] font-black text-slate-400 uppercase">Commission</label><input type="number" step="0.01" value={formData.platformFees || ''} onChange={e => setFormData({ ...formData, platformFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div><div><label className="text-[10px] font-black text-slate-400 uppercase">Banque</label><input type="number" step="0.01" value={formData.bankFees || ''} onChange={e => setFormData({ ...formData, bankFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black" /></div></div>)}</div><div className="space-y-4"><div className="flex justify-between font-black text-slate-400 text-[10px] uppercase">Prestations<button type="button" onClick={() => setFormData({ ...formData, resExpenses: [...(formData.resExpenses || []), { id: Date.now().toString(), person: availableProviders[0], type: availableServiceTypes[0], amount: 0, paymentDate: '', hoursEntry: '', rateEntry: '', hoursExit: '', rateExit: '', dateEntry: formData.startDate, dateExit: formData.endDate, timeEntry: '10:00', timeExit: '10:00', providerNote: '', sendEmail: true }] })} className="bg-slate-900 text-white px-4 py-2 rounded-xl">+ Ajouter</button></div>{(formData.resExpenses || []).map(exp => { const isDias = exp.person?.toLowerCase().includes('dias'); return isDias ? (<div key={exp.id} className="flex flex-col gap-3 bg-blue-50/50 p-4 rounded-[28px] border border-blue-100 relative"><div className="flex gap-1.5 items-center relative z-10"><select value={exp.person} onChange={e => { const val = e.target.value; setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => { if (x.id === exp.id) { if (val.toLowerCase().includes('dias')) { const rE = isSundayOrHoliday(x.dateEntry) ? 25 : 15; const rX = isSundayOrHoliday(x.dateExit) ? 25 : 15; return { ...x, person: val, rateEntry: rE, rateExit: rX, amount: (parseFloat(x.hoursEntry||0)*rE) + (parseFloat(x.hoursExit||0)*rX) }; } return { ...x, person: val }; } return x; }) }); }} className="flex-1 min-w-0 p-2 border border-blue-200 rounded-xl font-black text-[9px] uppercase outline-none">{availableProviders.map(p => <option key={p} value={p}>{p}</option>)}</select><select value={exp.type} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 min-w-0 p-2 border border-blue-200 rounded-xl font-black text-[9px] uppercase outline-none">{availableServiceTypes.map(p => <option key={p} value={p}>{p}</option>)}</select><button type="button" onClick={() => setFormData({ ...formData, resExpenses: formData.resExpenses.filter(x => x.id !== exp.id) })} className="flex-shrink-0 text-rose-500 font-black px-1"><Trash2 size={18}/></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10"><div className="bg-white p-3 rounded-[20px] border border-blue-100 space-y-2"><div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-blue-600">Entrée</span>{isSundayOrHoliday(exp.dateEntry) && <span className="text-[8px] font-black text-white bg-rose-500 px-2 rounded-full">Férié</span>}</div><input type="date" value={exp.dateEntry} onChange={e => updateDiasField(exp.id, 'dateEntry', e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-[10px]" /><div className="flex gap-2"><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">Heure</label><select value={exp.timeEntry} onChange={e => updateDiasField(exp.id, 'timeEntry', e.target.value)} className="w-full p-1.5 border rounded-lg text-[10px] font-black">{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">H.</label><input type="number" step="0.5" value={exp.hoursEntry} onChange={e => updateDiasField(exp.id, 'hoursEntry', e.target.value)} className="w-full p-1.5 border rounded-lg text-[10px] font-black text-center" /></div><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">Tarif</label><input type="number" step="0.5" value={exp.rateEntry} onChange={e => updateDiasField(exp.id, 'rateEntry', e.target.value)} className={`w-full p-1.5 border rounded-lg text-[10px] font-black text-center ${isSundayOrHoliday(exp.dateEntry) ? 'bg-rose-50 text-rose-700' : ''}`} /></div></div></div><div className="bg-white p-3 rounded-[20px] border border-blue-100 space-y-2"><div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-blue-600">Sortie</span>{isSundayOrHoliday(exp.dateExit) && <span className="text-[8px] font-black text-white bg-rose-500 px-2 rounded-full">Férié</span>}</div><input type="date" value={exp.dateExit} onChange={e => updateDiasField(exp.id, 'dateExit', e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-[10px]" /><div className="flex gap-2"><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">Heure</label><select value={exp.timeExit} onChange={e => updateDiasField(exp.id, 'timeExit', e.target.value)} className="w-full p-1.5 border rounded-lg text-[10px] font-black">{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">H.</label><input type="number" step="0.5" value={exp.hoursExit} onChange={e => updateDiasField(exp.id, 'hoursExit', e.target.value)} className="w-full p-1.5 border rounded-lg text-[10px] font-black text-center" /></div><div className="w-1/3"><label className="text-[7px] font-bold text-slate-400">Tarif</label><input type="number" step="0.5" value={exp.rateExit} onChange={e => updateDiasField(exp.id, 'rateExit', e.target.value)} className={`w-full p-1.5 border rounded-lg text-[10px] font-black text-center ${isSundayOrHoliday(exp.dateExit) ? 'bg-rose-50 text-rose-700' : ''}`} /></div></div></div></div><textarea value={exp.providerNote} onChange={e => updateDiasField(exp.id, 'providerNote', e.target.value)} className="w-full p-3 border border-blue-200 rounded-[16px] text-xs font-medium outline-none" placeholder="Note pour le prestataire..." /><div className="flex gap-2 relative z-10"><a href={getProviderCalendarUrl(exp, properties.find(p=>p.id===formData.propertyId), 'ENTREE')} target="_blank" className="flex-1 bg-white border border-blue-200 text-blue-600 p-2.5 rounded-xl font-black text-[9px] uppercase text-center shadow-sm flex items-center justify-center gap-1"><CalendarIcon size={12}/> RDV Entrée</a><a href={getProviderCalendarUrl(exp, properties.find(p=>p.id===formData.propertyId), 'SORTIE')} target="_blank" className="flex-1 bg-white border border-blue-200 text-blue-600 p-2.5 rounded-xl font-black text-[9px] uppercase text-center shadow-sm flex items-center justify-center gap-1"><CalendarIcon size={12}/> RDV Sortie</a></div><div className="flex justify-between items-center bg-blue-600 text-white p-4 rounded-[18px]"><span className="text-[10px] font-black uppercase">Total Bloqué</span><span className="font-black text-xl">{(parseFloat(exp.amount)||0).toFixed(2)}€</span></div></div>) : (<div key={exp.id} className="flex flex-col gap-2 bg-slate-50 p-4 rounded-[28px] border border-slate-100"><div className="flex gap-1.5 md:gap-2 items-center"><select value={exp.person} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, person: e.target.value } : x) })} className="flex-1 min-w-0 p-2 border rounded-xl font-black text-[9px] uppercase">{availableProviders.map(p => <option key={p} value={p}>{p}</option>)}</select><select value={exp.type} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 min-w-0 p-2 border rounded-xl font-black text-[9px] uppercase">{availableServiceTypes.map(p => <option key={p} value={p}>{p}</option>)}</select><input type="number" value={exp.amount} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, amount: e.target.value } : x) })} className="w-14 min-w-0 p-2 border rounded-xl font-black text-right text-[9px]" /><button type="button" onClick={() => setFormData({ ...formData, resExpenses: formData.resExpenses.filter(x => x.id !== exp.id) })} className="flex-shrink-0 text-rose-500 font-black px-1"><Trash2 size={18}/></button></div>{providerEmails[exp.person] && <label className="flex items-center gap-2 cursor-pointer pl-1 mt-1"><input type="checkbox" checked={exp.sendEmail !== false} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, sendEmail: e.target.checked } : x) })} className="w-3.5 h-3.5" /><span className="text-[8px] font-black text-slate-500 uppercase flex items-center gap-1"><Mail size={12}/> Inviter ({providerEmails[exp.person]})</span></label>}</div>); })}</div>{formData.platform !== 'En direct' && <div className={`p-6 rounded-[32px] border-2 flex flex-col md:flex-row items-center justify-between shadow-xl gap-4 ${formData.paymentDate ? 'bg-emerald-50/50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}><div><h4 className="text-[10px] font-black uppercase">Paiement Global Reçu</h4><p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Définit le mois URSSAF</p></div><input type="date" value={formData.paymentDate} onChange={e => setFormData({ ...formData, paymentDate: e.target.value })} className="w-full md:w-auto p-3 border border-slate-200 rounded-[15px] font-black bg-white" /></div>}<div className="bg-slate-900 p-8 rounded-[48px] text-white flex flex-col md:flex-row justify-between items-center gap-6"><div><p className="text-[10px] font-black uppercase text-slate-400 mb-2">Net Estimé</p><p className="text-4xl font-black text-blue-400">{(formData.platform === 'En direct' ? parseFloat(formData.grossAmount||0) : ((parseFloat(formData.displayedAmount||0)-parseFloat(formData.cityTax||0))-(parseFloat(formData.platformFees||0)+parseFloat(formData.bankFees||0))) - (formData.resExpenses||[]).reduce((s,e)=>s+parseFloat(e.amount||0),0)).toFixed(2)}€</p></div><div className="flex items-center gap-4 w-full md:w-auto">{editingResId && <button type="button" onClick={() => deleteRes(editingResId)} className="p-4 text-rose-500 bg-rose-50 rounded-[24px]"><Trash2 size={24}/></button>}<button type="submit" className="w-full md:w-auto bg-blue-600 px-12 py-5 rounded-[24px] font-black uppercase shadow-xl hover:-translate-y-1 transition-all">Enregistrer</button></div></div></form></div></div>
      )}
    </div>
  );
};

export default App;
