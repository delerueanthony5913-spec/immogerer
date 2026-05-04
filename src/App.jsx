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
  User, Sparkles, Key, UploadCloud, AlertTriangle, Check, TrendingDown, Search, BarChart2
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

// GRAPHIQUE MULTI-COURBES DYNAMIQUE
const ComparisonChart = ({ data, properties, platforms, yearsAvailable = [] }) => {
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date().getMonth();
  
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
  }, [mode, properties, platforms]);

  const toggleKey = (key) => {
    setSelectedKeys(prev => 
       prev.includes(key) 
         ? prev.filter(k => k !== key) 
         : [...prev, key]
    );
  };

  const buildSeriesFor = (targetYear, targetProp, targetPlat) => {
      const res = Array(12).fill(0);
      safeData.forEach(t => {
          if (targetProp !== 'all' && t.propertyId !== targetProp) return;
          if (targetPlat !== 'all' && t.platform !== targetPlat) return;

          let isUrssafTriggered = false;

          const addIncome = (dateStr, amt, isUrssafCheck) => {
              if (dateStr && dateStr.startsWith(targetYear)) {
                  const m = parseInt(dateStr.split('-')[1], 10) - 1;
                  if (m >= 0 && m <= 11) {
                      if (metric === 'gross') res[m] += amt;
                      if (metric === 'net') {
                          res[m] += amt;
                          if (isUrssafCheck) isUrssafTriggered = true;
                      }
                  }
              }
          };

          if (t.platform === 'En direct') {
              addIncome(t.acompte1Date, parseFloat(t.acompte1Amount)||0, false);
              addIncome(t.acompte2Date, parseFloat(t.acompte2Amount)||0, false);
              addIncome(t.soldeDate, parseFloat(t.soldeAmount)||0, true);
          } else {
              addIncome(t.paymentDate, parseFloat(t.netAmount)||0, true);
              if (metric === 'gross') addIncome(t.paymentDate, parseFloat(t.platformFees)||0, false); 
          }

          const addExpense = (dateStr, amount) => {
              if (dateStr && dateStr.startsWith(targetYear)) {
                  const m = parseInt(dateStr.split('-')[1], 10) - 1;
                  if (m >= 0 && m <= 11) {
                      if (metric === 'expenses') res[m] += amount;
                      if (metric === 'net') res[m] -= amount;
                  }
              }
          };

          (t.resExpenses || []).forEach(e => addExpense(e.paymentDate, parseFloat(e.amount)||0));

          if (isUrssafTriggered && t.isUrssaf !== false && metric === 'net') {
               const taxDate = t.platform === 'En direct' ? t.soldeDate : t.paymentDate;
               if (taxDate && taxDate.startsWith(targetYear)) {
                   const m = parseInt(taxDate.split('-')[1], 10) - 1;
                   if (m >= 0 && m <= 11) {
                       res[m] -= (parseFloat(t.grossAmount)||0) * 0.077;
                   }
               }
          }
      });
      return res.map(val => isNaN(val) ? 0 : val);
  };

  const series = selectedKeys.map((key, index) => {
      let dataArr = [];
      let label = '';
      let isPastCurrentYear = false;

      if (mode === 'years') {
          dataArr = buildSeriesFor(key, contextProp, contextPlat);
          label = key;
          isPastCurrentYear = parseInt(key) < parseInt(currentYear);
      } else if (mode === 'properties') {
          dataArr = buildSeriesFor(contextYear, key, contextPlat);
          label = properties.find(p=>p.id===key)?.name || 'Inconnu';
          isPastCurrentYear = parseInt(contextYear) < parseInt(currentYear);
      } else if (mode === 'platforms') {
          dataArr = buildSeriesFor(contextYear, contextProp, key);
          label = key;
          isPastCurrentYear = parseInt(contextYear) < parseInt(currentYear);
      }

      let splitIndex = 11;
      if (!isPastCurrentYear) {
         if (mode === 'years' && parseInt(key) > parseInt(currentYear)) splitIndex = -1; 
         else if (mode === 'years' && parseInt(key) === parseInt(currentYear)) splitIndex = currentMonth; 
         else if (parseInt(contextYear) > parseInt(currentYear)) splitIndex = -1;
         else if (parseInt(contextYear) === parseInt(currentYear)) splitIndex = currentMonth;
      }

      return {
          id: key,
          label,
          data: dataArr,
          color: CHART_COLORS[index % CHART_COLORS.length],
          total: dataArr.reduce((acc, val) => acc + val, 0),
          splitIndex
      };
  });

  const [hoveredMonth, setHoveredMonth] = useState(null);
  const months = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

  // Remplacement du .flat() pour la compatibilité absolue
  const allDataValues = series.reduce((acc, currentSeries) => {
      return acc.concat(currentSeries.data);
  }, []);

  const maxValRaw = Math.max(...allDataValues, 100);
  const maxVal = (!isFinite(maxValRaw) || maxValRaw <= 0) ? 100 : maxValRaw * 1.15;

  const w = 900, h = 300, padX = 60, padY = 30; 
  
  const getX = (i) => padX + (i * (w - 2 * padX) / 11);
  const getY = (val) => {
     if (isNaN(val) || !maxVal || maxVal === 0) return h - padY;
     return h - padY - ((val / maxVal) * (h - 2 * padY));
  };

  const buildPath = (dArr, start, end) => {
    if (start > end || start < 0) return '';
    const points = [];
    for (let i = start; i <= end; i++) {
        const x = getX(i);
        const y = getY(dArr[i]);
        if (!isNaN(x) && !isNaN(y)) points.push(`${x},${y}`);
    }
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0]} L ${points[0]}`;
    return `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(' ');
  };

  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];

  const availableOptions = mode === 'years' 
     ? safeYears.map(y => ({ id: y, label: y }))
     : mode === 'properties'
        ? properties.map(p => ({ id: p.id, label: p.name }))
        : platforms.map(p => ({ id: p, label: p }));

  return (
    <div className="w-full bg-white p-6 md:p-8 rounded-[48px] shadow-2xl border border-slate-50 animate-in fade-in relative mt-8">
      
      {/* 1. SELECTION DU MODE */}
      <div className="flex bg-slate-100 p-1.5 rounded-[20px] w-max mb-6">
         <button onClick={()=>{setMode('years'); setContextProp('all'); setContextPlat('all');}} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'years' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-900'}`}>📅 Années</button>
         <button onClick={()=>{setMode('properties'); setContextYear(currentYear); setContextPlat('all');}} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'properties' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-900'}`}>🏠 Logements</button>
         <button onClick={()=>{setMode('platforms'); setContextYear(currentYear); setContextProp('all');}} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'platforms' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-900'}`}>💻 Plateformes</button>
      </div>

      {/* 2. BOUTONS DE SELECTION MULTIPLE + FILTRES */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8 bg-slate-50 p-4 md:p-6 rounded-3xl border border-slate-100">
         <div className="flex-1">
            <span className="text-[10px] font-black uppercase text-slate-400 mb-3 block">Que voulez-vous afficher ? (Cochez)</span>
            <div className="flex flex-wrap gap-2">
               {availableOptions.map((opt, i) => {
                  const isSelected = selectedKeys.includes(opt.id);
                  const color = isSelected ? CHART_COLORS[selectedKeys.indexOf(opt.id) % CHART_COLORS.length] : '#CBD5E1';
                  return (
                     <button key={opt.id} onClick={() => toggleKey(opt.id)} className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all flex items-center gap-2 border ${isSelected ? 'bg-white shadow-sm border-transparent' : 'bg-transparent border-slate-200 text-slate-400 hover:border-slate-400'}`} style={{ color: isSelected ? color : undefined }}>
                        <div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{ backgroundColor: color }}></div>
                        {opt.label}
                     </button>
                  );
               })}
            </div>
         </div>
         <div className="w-full lg:w-px h-px lg:h-auto bg-slate-200"></div>
         <div className="flex flex-col gap-3 min-w-[200px]">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 w-16">Analyser :</span>
                <select value={metric} onChange={e=>setMetric(e.target.value)} className="flex-1 bg-slate-900 text-white border-none rounded-xl px-3 py-2 text-[10px] font-black uppercase outline-none shadow-md cursor-pointer hover:bg-blue-600 transition-colors">
                   <option value="net">Profit Net Réel</option>
                   <option value="gross">CA Brut</option>
                   <option value="expenses">Coût Prestations</option>
                </select>
             </div>
             <div className="flex items-center gap-2">
                <Filter size={12} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase text-slate-400">Filtres :</span>
             </div>
             <div className="flex flex-col gap-2 pl-5">
                {mode !== 'years' && <select value={contextYear} onChange={e=>setContextYear(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none cursor-pointer text-slate-700">{safeYears.map(y=><option key={y} value={y}>Année {y}</option>)}</select>}
                {mode !== 'properties' && <select value={contextProp} onChange={e=>setContextProp(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none cursor-pointer text-slate-700 truncate"><option value="all">Tous Logements</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}
                {mode !== 'platforms' && <select value={contextPlat} onChange={e=>setContextPlat(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none cursor-pointer text-slate-700 truncate"><option value="all">Toutes Plateformes</option>{platforms.map(p=><option key={p} value={p}>{p}</option>)}</select>}
             </div>
         </div>
      </div>

      {/* 3. LE GRAPHIQUE */}
      {series.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-slate-300 font-black uppercase text-xs">Cochez au moins une option pour voir le graphique</div>
      ) : (
          <div className="overflow-x-auto no-scrollbar">
            <div className="min-w-[600px] relative">
              <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
                {yTicks.map((tick, i) => (
                  <g key={`grid-${i}`}>
                    <line x1={padX} y1={getY(tick)} x2={w - padX} y2={getY(tick)} stroke="#F1F5F9" strokeWidth="2" />
                    <text x={w - padX + 8} y={getY(tick) + 4} fill="#475569" fontSize="11" fontFamily="sans-serif" fontWeight="900">{tick >= 1000 ? (tick / 1000).toFixed(1) + 'k€' : Math.round(tick) + '€'}</text>
                  </g>
                ))}

                {hoveredMonth !== null && (
                    <line x1={getX(hoveredMonth)} y1={padY} x2={getX(hoveredMonth)} y2={h - padY} stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 4" />
                )}
                
                {months.map((m, i) => (
                  <text key={m} x={getX(i)} y={h - 5} fill={hoveredMonth === i ? "#0F172A" : "#94A3B8"} fontSize="12" fontFamily="sans-serif" fontWeight="900" textAnchor="middle" className="transition-colors cursor-pointer" onMouseEnter={() => setHoveredMonth(i)} onMouseLeave={() => setHoveredMonth(null)}>{m}</text>
                ))}
                
                {series.map((s, idx) => (
                   <g key={`series-${s.id}`}>
                      <path d={buildPath(s.data, 0, Math.max(0, s.splitIndex))} stroke={s.color} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />
                      <path d={buildPath(s.data, Math.max(0, s.splitIndex), 11)} stroke={s.color} strokeWidth="4" fill="none" strokeDasharray="6 8" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />
                   </g>
                ))}

                {months.map((_, i) => (
                  <g key={`points-${i}`} onMouseEnter={() => setHoveredMonth(i)} onMouseLeave={() => setHoveredMonth(null)} className="cursor-pointer">
                    <rect x={getX(i) - 20} y={0} width="40" height={h} fill="transparent" />
                    {series.map(s => (
                       <circle key={`dot-${s.id}-${i}`} cx={getX(i)} cy={getY(s.data[i])} r={hoveredMonth === i ? 7 : 4} fill={hoveredMonth === i ? s.color : "white"} stroke={s.color} strokeWidth="3" className="transition-all duration-200" />
                    ))}
                  </g>
                ))}
              </svg>

              {/* TOOLTIP INTERACTIF AU SURVOL */}
              {hoveredMonth !== null && series.length > 0 && (
                <div 
                  className="absolute z-20 bg-slate-900/95 backdrop-blur-sm text-white p-4 rounded-2xl shadow-2xl pointer-events-none transition-all duration-200 min-w-[160px] border border-slate-700"
                  style={{ 
                    left: `${(getX(hoveredMonth) / w) * 100}%`, 
                    top: '15%', 
                    transform: hoveredMonth > 7 ? 'translateX(calc(-100% - 15px))' : hoveredMonth < 4 ? 'translateX(15px)' : 'translateX(-50%)' 
                  }}
                >
                   <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3 border-b border-slate-700 pb-2">{months[hoveredMonth]}</div>
                   <div className="flex flex-col gap-2.5">
                      {series.map(s => (
                         <div key={`tt-${s.id}`} className="flex justify-between items-center gap-6">
                            <div className="text-[10px] font-black uppercase flex items-center gap-2 truncate max-w-[120px]"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{backgroundColor: s.color}}></div>{s.label}</div>
                            <div className="font-black text-sm">{s.data[hoveredMonth].toFixed(2)}€</div>
                         </div>
                      ))}
                   </div>
                </div>
              )}
            </div>
          </div>
      )}
      
      {/* 4. TOTAUX GLOBAUX */}
      {series.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {series.map(s => (
                <div key={`total-${s.id}`} className="bg-white border border-slate-100 p-5 rounded-[24px] shadow-sm flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: s.color}}></div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 truncate" title={s.label}>Total {s.label}</p>
                  <p className="text-xl font-black text-slate-800 tracking-tighter">{s.total.toLocaleString('fr-FR')}€</p>
                </div>
            ))}
          </div>
      )}
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

  const formatDateFr = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const getGoogleCalendarUrl = (res, prop) => {
    if (!res.startDate || !res.endDate) return '#';
    const text = encodeURIComponent(`Réservation : ${res.name} - ${prop?.name || ''}`);
    
    let expensesText = '';
    if (res.resExpenses && res.resExpenses.length > 0) {
       expensesText = '\n\nPrestations prévues :\n' + res.resExpenses.map(e => `- ${e.type} (${e.person}) : ${e.amount}€`).join('\n');
    }
    
    const phoneText = res.phone ? `\nContact : ${res.phone}` : '';
    
    const details = encodeURIComponent(`Client : ${res.name}${phoneText}\nLogement : ${prop?.name || ''}\nPlateforme : ${res.platform}\nNotes : ${res.comment || ''}${expensesText}`);
    const dates = `${res.startDate.replace(/-/g, '')}/${res.endDate.replace(/-/g, '')}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
  };

  const getStatusProps = (t) => {
    if (t.platform === 'En direct') {
        if (t.soldeDate) return { label: 'Payé', color: 'bg-emerald-100 text-emerald-700' };
        if (t.acompte1Date || t.acompte2Date) return { label: 'Incomplet', color: 'bg-blue-100 text-blue-700' };
        return { label: 'Attente', color: 'bg-orange-100 text-orange-700' };
    }
    return t.paymentDate ? { label: 'Payé', color: 'bg-emerald-100 text-emerald-700' } : { label: 'Attente', color: 'bg-orange-100 text-orange-700' };
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

  // Par défaut sur "all" pour voir toutes les années et pouvoir trouver la prochaine réservation
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterProp, setFilterProp] = useState('all');
  const [filterPlat, setFilterPlat] = useState('all');
  const [filterProv, setFilterProv] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResId, setEditingResId] = useState(null);
  const [formData, setFormData] = useState({ 
    propertyId: '', name: '', phone: '', startDate: '', endDate: '', paymentDate: '', 
    platform: 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', 
    bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [], comment: '',
    acompte1Amount: '', acompte1Date: '', acompte2Amount: '', acompte2Date: '', soldeAmount: '', soldeDate: ''
  });

  const [inputPlat, setInputPlat] = useState('');
  const [inputProv, setInputProv] = useState('');
  const [inputSvc, setInputSvc] = useState('');
  const [inputProp, setInputProp] = useState({ name: '', address: '' });
  
  const [importSource, setImportSource] = useState('Airbnb');
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [reviewList, setReviewList] = useState([]);

  const [quickPayConfig, setQuickPayConfig] = useState(null); 
  const [statsDetailConfig, setStatsDetailConfig] = useState(null);

  const [hasScrolledToNext, setHasScrolledToNext] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setLoading(false); }
      else signInAnonymously(auth);
    });

    const unsubProps = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), (snap) => {
      setProperties(snap.docs.map(d => {
        const data = d.data();
        delete data.id; 
        return { ...data, id: d.id };
      }));
    });

    const unsubTenants = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), (snap) => {
      setTenants(snap.docs.map(d => {
        const data = d.data();
        delete data.id; 
        const year = data.startDate ? parseInt(data.startDate.split('-')[0], 10) : 0;
        
        if (year >= 2022 && year <= 2025) {
          if (!data.paymentDate && data.platform !== 'En direct') data.paymentDate = data.endDate || `${year}-12-31`;
          if (data.resExpenses) {
            data.resExpenses = data.resExpenses.map(exp => ({ ...exp, paymentDate: exp.paymentDate || data.endDate || `${year}-12-31` }));
          }
        }
        return { ...data, id: d.id };
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

  // Injection 2025 auto
  useEffect(() => {
    if (!user || loading) return;
    
    const isAlreadyInjected = sessionStorage.getItem('cadel_injected_2025_auto');
    if (isAlreadyInjected === 'true') return;

    if (properties.length === 0 && tenants.length === 0) return;

    const runInjection = async () => {
        sessionStorage.setItem('cadel_injected_2025_auto', 'true');
        
        let targetProp = properties.find(p => p.name.toUpperCase().includes('CADELIA'));
        if (!targetProp) {
            try {
                const propRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), { name: 'VILLA CADELIA', address: '' });
                targetProp = { id: propRef.id, name: 'VILLA CADELIA' };
            } catch(e) { console.error(e); return; }
        }

        const hasLola = tenants.some(t => t.name.toUpperCase().includes("LOLA DROIN"));
        if (!hasLola) {
            const dataToImport = [
                { name: "LOLA DROIN", startDate: "2025-03-21", endDate: "2025-03-23", amount: 1450 },
                { name: "NELLY JEAN-MARIE", startDate: "2025-04-30", endDate: "2025-05-04", amount: 3800 },
                { name: "WINDED", startDate: "2025-06-06", endDate: "2025-06-09", amount: 3000 },
                { name: "ANTOINE ET ELODIE", startDate: "2025-07-04", endDate: "2025-07-06", amount: 2700 },
                { name: "Severine BRISSON", startDate: "2025-07-12", endDate: "2025-08-02", amount: 14000 },
                { name: "Anais FLORE", startDate: "2025-08-02", endDate: "2025-08-09", amount: 4500 },
                { name: "MATTHIEU MECHAT", startDate: "2025-08-09", endDate: "2025-08-23", amount: 7500 },
                { name: "BLANDINE DUHAMEL", startDate: "2025-09-19", endDate: "2025-09-21", amount: 1900 },
                { name: "PHILIPPE VINCENT", startDate: "2025-12-27", endDate: "2025-12-29", amount: 1800 },
                { name: "MACIE CLAUDE", startDate: "2025-12-30", endDate: "2026-01-02", amount: 2900 }
            ];
            
            dataToImport.forEach(item => {
                 addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), {
                      propertyId: targetProp.id,
                      name: item.name,
                      phone: '',
                      startDate: item.startDate,
                      endDate: item.endDate,
                      platform: 'En direct',
                      isUrssaf: true,
                      grossAmount: item.amount,
                      netAmount: item.amount,
                      platformFees: 0,
                      bankFees: 0,
                      cityTax: 0,
                      displayedAmount: 0,
                      acompte1Amount: 0,
                      acompte1Date: '',
                      acompte2Amount: 0,
                      acompte2Date: '',
                      soldeAmount: item.amount,
                      soldeDate: item.endDate, 
                      resExpenses: [],
                      comment: 'Import automatique VILLA CADELIA'
                 });
            });
        }
    };
    
    runInjection();
  }, [user, loading, properties, tenants, db]);

  const updateSettings = async (n) => {
    if(!user || user.uid === 'local-test-user') return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), n, { merge: true });
  };

  const saveRes = async (e) => {
    e.preventDefault();
    if (!formData.propertyId) { alert("⚠️ Vous devez sélectionner un Logement."); return; }
    if (!formData.name) { alert("⚠️ Vous devez indiquer le nom du Voyageur ou sa Référence."); return; }
    if (!formData.startDate || !formData.endDate) { alert("⚠️ Les dates de séjour sont obligatoires."); return; }

    const isDirect = formData.platform === 'En direct';
    const isC = formData.platform === 'Booking' || formData.platform === 'Abritel';
    
    const disp = parseFloat(formData.displayedAmount) || 0;
    const city = parseFloat(formData.cityTax) || 0;
    const plat = parseFloat(formData.platformFees) || 0;
    const bank = parseFloat(formData.bankFees) || 0;
    const gross = parseFloat(formData.grossAmount) || 0;

    const a1 = parseFloat(formData.acompte1Amount) || 0;
    const a2 = parseFloat(formData.acompte2Amount) || 0;
    const s = parseFloat(formData.soldeAmount) || 0;

    const g = isDirect ? gross : (isC ? (disp - city) : gross);
    const n = isDirect ? gross : (isC ? (g - plat - bank) : (g - plat));
    
    const d = { 
      ...formData, 
      phone: formData.phone || '',
      isUrssaf: formData.isUrssaf !== false, 
      grossAmount: g, 
      netAmount: n, 
      platformFees: plat,
      bankFees: bank,
      cityTax: city,
      displayedAmount: disp,
      acompte1Amount: a1,
      acompte2Amount: a2,
      soldeAmount: s,
      resExpenses: (formData.resExpenses || []).map(r => ({ ...r, amount: parseFloat(r.amount) || 0 })) 
    };
    
    delete d.id;

    try {
      if (editingResId) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', editingResId), d);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), d);
      }
      setIsModalOpen(false);
    } catch (error) {
      alert("Erreur technique lors de la sauvegarde : " + error.message);
    }
  };

  const deleteRes = async (id) => {
    if(window.confirm("Supprimer définitivement cette réservation ?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', id));
      setIsModalOpen(false);
    }
  };

  const handleQuickPayToggle = async (e, tenant, type, expId = null) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user || user.uid === 'local-test-user') return;

    if (type === 'global' && tenant.platform === 'En direct') {
        setEditingResId(tenant.id);
        setFormData(tenant);
        setIsModalOpen(true);
        return;
    }

    let isPaid = false;
    if (type === 'global') isPaid = !!tenant.paymentDate;
    if (type === 'expense') {
      const exp = (tenant.resExpenses || []).find(x => x.id === expId);
      isPaid = !!(exp && exp.paymentDate);
    }

    if (isPaid) {
      if (window.confirm("Annuler ce paiement et le repasser en attente ?")) {
        try {
          if (type === 'global') {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', tenant.id), { paymentDate: '' }, { merge: true });
          } else {
            const newExpenses = tenant.resExpenses.map(exp => exp.id === expId ? { ...exp, paymentDate: '' } : exp);
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', tenant.id), { resExpenses: newExpenses }, { merge: true });
          }
        } catch (err) { alert("Erreur: " + err.message); }
      }
    } else {
      setQuickPayConfig({ tenant, type, expId, date: new Date().toISOString().split('T')[0] });
    }
  };

  const submitQuickPay = async () => {
    if (!quickPayConfig || !quickPayConfig.date) return;
    try {
      if (quickPayConfig.type === 'global') {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', quickPayConfig.tenant.id), { paymentDate: quickPayConfig.date }, { merge: true });
      } else {
        const newExpenses = quickPayConfig.tenant.resExpenses.map(exp => exp.id === quickPayConfig.expId ? { ...exp, paymentDate: quickPayConfig.date } : exp);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', quickPayConfig.tenant.id), { resExpenses: newExpenses }, { merge: true });
      }
      setQuickPayConfig(null);
    } catch (err) { alert("Erreur d'encaissement: " + err.message); }
  };

  const baseTenants = useMemo(() => {
    return (tenants || []).filter(t => 
       (filterProp === 'all' || t.propertyId === filterProp) &&
       (filterPlat === 'all' || t.platform === filterPlat)
    );
  }, [tenants, filterProp, filterPlat]);

  const filteredData = useMemo(() => {
    return baseTenants.filter(t => {
      const dateRef = t.startDate ? new Date(t.startDate) : new Date();
      return (filterYear === 'all' || dateRef.getFullYear() === parseInt(filterYear)) &&
             (filterMonth === 'all' || dateRef.getMonth() === parseInt(filterMonth)) &&
             (filterProv === 'all' || (t.resExpenses && t.resExpenses.some(e => e.person === filterProv)));
    });
  }, [baseTenants, filterYear, filterMonth, filterProv]);

  const reservationsList = useMemo(() => {
    return filteredData.filter(t => {
      if (filterStatus === 'paid') return (t.platform === 'En direct' ? !!t.soldeDate : !!t.paymentDate);
      if (filterStatus === 'pending') return (t.platform === 'En direct' ? !t.soldeDate : !t.paymentDate);
      return true;
    }).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  }, [filteredData, filterStatus]);

  // LOGIQUE D'AUTO-SCROLL INTELLIGENTE ET ROBUSTE
  useEffect(() => {
    if (activeTab !== 'reservations') {
       setHasScrolledToNext(false);
       return;
    }
    
    // Attendre que Firebase ait chargé au moins quelques données
    if (hasScrolledToNext || reservationsList.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];

    // Cherche la prochaine résa (qui commence ou finit dans le futur/aujourd'hui)
    let targetRes = reservationsList.find(t => t.startDate >= todayStr || (t.endDate && t.endDate >= todayStr));
    
    // Si tout est dans le passé, on cible la toute dernière (la plus récente)
    if (!targetRes) {
        targetRes = reservationsList[reservationsList.length - 1];
    }

    if (targetRes) {
        // Un délai pour s'assurer que React a bien "dessiné" toutes les lignes du tableau
        const timer = setTimeout(() => {
            const els = document.querySelectorAll(`[data-res-id="${targetRes.id}"]`);
            let scrolled = false;
            
            for (let el of els) {
                // offsetParent !== null veut dire que l'élément est bien visible à l'écran
                if (el.offsetParent !== null) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Petit flash bleu pour bien montrer la ligne
                    el.style.backgroundColor = '#EFF6FF';
                    el.style.transition = 'background-color 1s ease';
                    setTimeout(() => { el.style.backgroundColor = ''; }, 3000);
                    
                    scrolled = true;
                    break;
                }
            }
            
            // Si on a réussi à scroller, on bloque la fonction pour ne plus la refaire
            // Sinon (DOM pas encore prêt), elle se relancera au prochain rendu
            if (scrolled) {
                setHasScrolledToNext(true);
            }
        }, 150);

        return () => clearTimeout(timer);
    }
  }, [activeTab, reservationsList, hasScrolledToNext]);


  const checkDateFilter = (dateStr) => {
     if (!dateStr) return false;
     const [y, mo] = dateStr.split('-');
     if (filterYear !== 'all' && y !== filterYear) return false;
     if (filterMonth !== 'all' && parseInt(mo)-1 !== parseInt(filterMonth)) return false;
     return true;
  };

  const monthlyRecapData = useMemo(() => {
    const stats = {};
    
    const initStats = (m) => {
        if(!stats[m]) stats[m] = { totalBank: 0, urssafGross: 0, directNet: 0, charges: 0, taxes: 0, platforms: {} };
    };

    baseTenants.forEach(t => {
      if (t.platform === 'En direct') {
           const a1 = parseFloat(t.acompte1Amount) || 0;
           const a2 = parseFloat(t.acompte2Amount) || 0;
           const s = parseFloat(t.soldeAmount) || 0;

           if (t.acompte1Date && checkDateFilter(t.acompte1Date)) {
               const m = t.acompte1Date.substring(0,7);
               initStats(m);
               stats[m].totalBank += a1;
               if (t.isUrssaf === false) stats[m].directNet += a1;
           }
           if (t.acompte2Date && checkDateFilter(t.acompte2Date)) {
               const m = t.acompte2Date.substring(0,7);
               initStats(m);
               stats[m].totalBank += a2;
               if (t.isUrssaf === false) stats[m].directNet += a2;
           }
           if (t.soldeDate && checkDateFilter(t.soldeDate)) {
               const m = t.soldeDate.substring(0,7);
               initStats(m);
               stats[m].totalBank += s;
               if (t.isUrssaf === false) stats[m].directNet += s;
               
               if (t.isUrssaf !== false) {
                   stats[m].urssafGross += (parseFloat(t.grossAmount) || 0);
                   stats[m].taxes += (parseFloat(t.grossAmount) || 0) * 0.077;
                   stats[m].platforms[t.platform] = (stats[m].platforms[t.platform] || 0) + (parseFloat(t.grossAmount) || 0);
               }
           }
      } else {
          if (t.paymentDate && checkDateFilter(t.paymentDate)) {
              const m = t.paymentDate.substring(0, 7);
              initStats(m);
              stats[m].totalBank += (parseFloat(t.netAmount) || 0);
              if (t.isUrssaf !== false) { 
                stats[m].urssafGross += (parseFloat(t.grossAmount) || 0); 
                stats[m].taxes += (parseFloat(t.grossAmount) || 0) * 0.077; 
                stats[m].platforms[t.platform] = (stats[m].platforms[t.platform] || 0) + (parseFloat(t.grossAmount) || 0);
              }
              else {
                stats[m].directNet += (parseFloat(t.netAmount) || 0);
              }
          }
      }
      
      (t.resExpenses || []).forEach(exp => {
          if (exp.paymentDate && checkDateFilter(exp.paymentDate)) {
             if (filterProv !== 'all' && exp.person !== filterProv) return; 
             const m = exp.paymentDate.substring(0, 7);
             initStats(m);
             stats[m].charges += (parseFloat(exp.amount) || 0);
          }
      });
    });
    return Object.entries(stats).sort((a, b) => b[0].localeCompare(a[0]));
  }, [baseTenants, filterYear, filterMonth, filterProv]);

  const detailedExpenses = useMemo(() => {
    const list = [];
    baseTenants.forEach(t => {
      (t.resExpenses || []).forEach(exp => {
        if (filterProv === 'all' || exp.person === filterProv) {
          const refDate = exp.paymentDate || t.startDate;
          if (checkDateFilter(refDate)) {
            list.push({ id: `${t.id}-${exp.id}`, propertyName: properties.find(p => p.id === t.propertyId)?.name || '--', dateRes: t.startDate, person: exp.person, type: exp.type, amount: parseFloat(exp.amount) || 0, paymentDate: exp.paymentDate || '' });
          }
        }
      });
    });
    return list.sort((a, b) => b.dateRes.localeCompare(a.dateRes));
  }, [baseTenants, properties, filterProv, filterYear, filterMonth]);

  const statsCalculations = useMemo(() => {
    const year = filterYear === 'all' ? new Date().getFullYear() : parseInt(filterYear);
    const prevYear = year - 1;

    let currentYearNights = 0;
    let currentYearGross = 0, prevYearGross = 0;
    let currentYearExp = 0;
    let upcomingGross = 0;

    const currentMonthGross = Array(12).fill(0);
    const prevMonthGross = Array(12).fill(0);
    
    baseTenants.forEach(t => {
       if (!t.startDate) return;
       const resYear = parseInt(t.startDate.split('-')[0], 10);
       const resMonth = parseInt(t.startDate.split('-')[1], 10) - 1;

       const nights = t.endDate ? Math.max(1, Math.round((new Date(t.endDate) - new Date(t.startDate)) / 86400000)) : 1;
       const gross = parseFloat(t.grossAmount) || 0;
       const exp = (t.resExpenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

       let isFullyPaid = false;
       if (t.platform === 'En direct') {
          isFullyPaid = !!t.soldeDate;
       } else {
          isFullyPaid = !!t.paymentDate;
       }
       if (!isFullyPaid) upcomingGross += gross;

       if (resYear === year) {
           currentYearNights += nights;
           currentYearGross += gross;
           currentYearExp += exp;
           if (resMonth >= 0 && resMonth <= 11) currentMonthGross[resMonth] += gross;
       } else if (resYear === prevYear) {
           prevYearGross += gross;
           if (resMonth >= 0 && resMonth <= 11) prevMonthGross[resMonth] += gross;
       }
    });

    const currentBase = baseTenants.filter(t => t.startDate && t.startDate.startsWith(year.toString()));
    const avgStay = currentBase.length > 0 ? (currentYearNights / currentBase.length).toFixed(1) : 0;
    const avgGrossPerRes = currentBase.length > 0 ? (currentYearGross / currentBase.length).toFixed(2) : 0;
    const revPerNight = currentYearNights > 0 ? (currentYearGross / currentYearNights).toFixed(2) : 0;
    
    const calcGrowth = (curr, prev) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0);
    const grossGrowth = calcGrowth(currentYearGross, prevYearGross);

    return { 
        year, prevYear,
        currentYearNights, currentYearGross, currentYearExp, upcomingGross,
        prevYearGross, 
        avgStay, avgGrossPerRes, revPerNight, grossGrowth,
        currentMonthGross, prevMonthGross
    };
  }, [baseTenants, filterYear]);

  const statsDetailList = useMemo(() => {
    if (!statsDetailConfig) return [];
    const { type, monthIndex } = statsDetailConfig;
    const yearNum = filterYear === 'all' ? new Date().getFullYear() : parseInt(filterYear);
    
    return baseTenants.filter(t => {
        if (type === 'upcoming') {
             let isFullyPaid = false;
             if (t.platform === 'En direct') isFullyPaid = !!t.soldeDate;
             else isFullyPaid = !!t.paymentDate;
             return !isFullyPaid;
        }
        
        const sDate = t.startDate || '';
        const [y, m] = sDate.split('-');
        
        if (type === 'month_current') {
             return parseInt(y) === yearNum && parseInt(m)-1 === monthIndex;
        }
        if (type === 'month_prev') {
             return parseInt(y) === yearNum - 1 && parseInt(m)-1 === monthIndex;
        }
        if (type === 'year_current') {
             return parseInt(y) === yearNum;
        }
        if (type === 'expenses') {
             return parseInt(y) === yearNum && (t.resExpenses||[]).length > 0;
        }
        return false;
    }).sort((a,b) => (a.startDate||"").localeCompare(b.startDate||""));
  }, [statsDetailConfig, baseTenants, filterYear]);

  const getTenantProfitForFilters = (t) => {
    let profit = 0;
    if (t.platform === 'En direct') {
        const a1 = parseFloat(t.acompte1Amount) || 0;
        const a2 = parseFloat(t.acompte2Amount) || 0;
        const s = parseFloat(t.soldeAmount) || 0;
        
        if (t.acompte1Date && checkDateFilter(t.acompte1Date)) profit += a1;
        if (t.acompte2Date && checkDateFilter(t.acompte2Date)) profit += a2;
        
        if (t.soldeDate && checkDateFilter(t.soldeDate)) {
            profit += s;
            if (t.isUrssaf !== false) profit -= (parseFloat(t.grossAmount) || 0) * 0.077;
        }
    } else {
        if (t.paymentDate && checkDateFilter(t.paymentDate)) {
            profit += (parseFloat(t.netAmount) || 0);
            if (t.isUrssaf !== false) profit -= (parseFloat(t.grossAmount) || 0) * 0.077;
        }
    }

    (t.resExpenses || []).forEach(exp => {
        if (exp.paymentDate && checkDateFilter(exp.paymentDate)) {
            profit -= (parseFloat(exp.amount) || 0);
        }
    });

    return profit;
  };

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
    const lines = importText.split('\n').filter(l => l.trim() !== ''); 
    if (lines.length < 2) return;

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const voyageurIdx = headers.findIndex(h => h.includes('voyageur') || h.includes('client') || h.includes('nom'));
    
    const newList = [];
    
    lines.forEach((line, index) => {
        if (index === 0) return; 
        const parts = parseCSVLine(line);
        if (parts.length < 5) return;

        let guestName, startDate, endDate, listingName;
        let gross = 0, fees = 0, cityTax = 0, bankFees = 0, dispAmount = 0, net = 0;

        if (importSource === 'Airbnb') {
            const typeIndex = parts.findIndex(p => p.toLowerCase().includes('réservation') || p.toLowerCase().includes('reservation'));
            if (typeIndex === -1) return;
            let rawStart, rawEnd, grossStr, serviceFeeStr;
            if (typeIndex === 2) {
                rawStart = parts[5]?.trim(); rawEnd = parts[6]?.trim(); guestName = parts[8]?.trim(); listingName = parts[9]?.trim();
                grossStr = parts[18]?.trim() || parts[13]?.trim(); serviceFeeStr = parts[15]?.trim();
            } else if (typeIndex === 1) {
                rawStart = parts[4]?.trim(); rawEnd = parts[5]?.trim(); guestName = parts[7]?.trim(); listingName = parts[8]?.trim();
                grossStr = parts[15]?.trim() || parts[12]?.trim(); serviceFeeStr = parts[13]?.trim();
            } else return;

            const formatDateStr = (raw) => { if(!raw) return ''; const [m, d, y] = raw.split('/'); return (m && d && y) ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : ''; };
            startDate = formatDateStr(rawStart); endDate = formatDateStr(rawEnd);
            if (!startDate || !endDate) return;

            gross = parseFloat(grossStr?.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
            fees = Math.abs(parseFloat(serviceFeeStr?.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0);
            dispAmount = gross;
            net = gross - fees;
        } 
        else if (importSource === 'Booking') {
            const typeCol = parts[0]?.toLowerCase() || '';
            if (!typeCol.includes('rã©servation') && !typeCol.includes('réservation') && !typeCol.includes('reservation')) return;

            guestName = voyageurIdx !== -1 && parts[voyageurIdx] ? parts[voyageurIdx].trim() : `Réf: ${parts[2]?.trim()}`; 
            
            startDate = parts[3]?.trim(); 
            endDate = parts[4]?.trim();   
            listingName = parts[10]?.trim();

            if (!startDate || !endDate) return;

            dispAmount = parseFloat(parts[15]?.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
            cityTax = Math.abs(parseFloat(parts[16]?.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0);
            fees = Math.abs(parseFloat(parts[17]?.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0);
            bankFees = Math.abs(parseFloat(parts[19]?.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0);

            gross = dispAmount - cityTax;
            net = gross - fees - bankFees;
        }

        const matchedProp = properties.find(p => listingName && p.name && (listingName.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(listingName.toLowerCase())));
        const isDuplicate = tenants.some(t => t.startDate === startDate && t.propertyId === (matchedProp?.id || 'none'));
        const hasProperty = !!matchedProp;

        newList.push({ 
            id: index, propertyId: matchedProp?.id || '', propertyName: matchedProp?.name || listingName || 'Inconnu', 
            name: guestName || 'Client Inconnu', startDate, endDate, grossAmount: gross, platformFees: fees, 
            displayedAmount: dispAmount, cityTax: cityTax, bankFees: bankFees,
            netAmount: net, isDuplicate, hasProperty, selected: !isDuplicate && hasProperty 
        });
    });
    setReviewList(newList);
  };

  const confirmImport = async () => {
      const toImport = reviewList.filter(i => i.selected && i.hasProperty);
      for (let item of toImport) {
          const { id, selected, isDuplicate, hasProperty, propertyName, ...cleanItem } = item;
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), { ...cleanItem, platform: importSource, isUrssaf: true, comment: `Importé via CSV ${importSource}`, resExpenses: [], paymentDate: '' });
      }
      setReviewList([]); setImportText(''); setImportStatus(`${toImport.length} réservation(s) importée(s) !`);
      setTimeout(() => setImportStatus(''), 5000);
  };

  const RenderFilters = () => (
    <div className="flex flex-wrap items-center gap-2 bg-white/70 backdrop-blur-md p-3 rounded-[28px] border border-white shadow-xl mb-6 md:mb-8">
      <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
        <Filter size={12} className="text-slate-400" />
        <select value={filterYear} onChange={e => {setFilterYear(e.target.value); setHasScrolledToNext(false);}} className="text-[10px] font-black uppercase bg-transparent outline-none cursor-pointer">
          <option value="all">Toutes Années</option>{(yearsAvailable || []).map(y => <option key={y} value={y}>{y}</option>)}
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
  const isDirectFormModale = formData?.platform === 'En direct';
  const isCplxFormModale = formData?.platform === 'Booking' || formData?.platform === 'Abritel';
  
  const nModale = isDirectFormModale 
    ? (parseFloat(formData?.grossAmount) || 0) 
    : isCplxFormModale 
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
          {[{ id: 'reservations', label: 'Réservations', icon: <List size={18}/> }, { id: 'agenda', label: 'Agenda', icon: <CalendarRange size={18}/> }, { id: 'statistiques', label: 'Statistiques', icon: <BarChart2 size={18}/> }, { id: 'finances', label: 'Finances', icon: <Calculator size={18}/> }, { id: 'settings', label: 'Paramètres', icon: <Settings size={18}/> }].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full text-left px-5 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-2xl' : 'text-slate-400 hover:bg-slate-50'}`}>{item.icon} {item.label}</button>
          ))}
        </nav>
      </aside>

      <div className="md:hidden flex justify-between p-5 bg-white border-b sticky top-0 z-40 shadow-sm"><div className="flex items-center gap-2"><div className="bg-blue-600 p-1.5 rounded-lg text-white"><Building2 size={16}/></div><h1 className="font-black text-sm uppercase">CADEL MANAGER</h1></div><button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">{isMobileMenuOpen ? <X /> : <Menu />}</button></div>

      <main className="flex-1 p-4 md:p-12 overflow-y-auto h-screen custom-scrollbar relative">
        
        {/* MODALE DE PAIEMENT RAPIDE */}
        {quickPayConfig && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col gap-6 animate-in zoom-in-95">
                <div className="text-center">
                  <div className="bg-emerald-50 text-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Euro size={32}/></div>
                  <h3 className="font-black text-xl uppercase tracking-tighter">Valider le paiement</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-2">Définit le mois URSSAF</p>
                </div>
                <input type="date" value={quickPayConfig.date} onChange={e => setQuickPayConfig({...quickPayConfig, date: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-center text-lg outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50" />
                <div className="flex gap-3 mt-2">
                  <button onClick={() => setQuickPayConfig(null)} className="flex-1 p-4 rounded-2xl font-black uppercase text-[10px] text-slate-400 bg-slate-50 hover:bg-slate-100 transition-colors">Annuler</button>
                  <button onClick={submitQuickPay} className="flex-1 p-4 rounded-2xl font-black uppercase text-[10px] text-white bg-emerald-500 shadow-xl shadow-emerald-200 hover:bg-emerald-600 transition-all hover:-translate-y-0.5">Encaisser</button>
                </div>
             </div>
          </div>
        )}

        {/* MODALE DES DETAILS DE STATISTIQUES (TIROIR CLIC) */}
        {statsDetailConfig && (
           <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-[#F8FAFC] rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-100 overflow-hidden relative">
                 <div className="p-6 md:p-8 border-b flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3 text-blue-600 font-black uppercase tracking-tighter text-xl">
                        <Search size={24} /> {statsDetailConfig.title}
                    </div>
                    <button onClick={() => setStatsDetailConfig(null)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all"><X size={20}/></button>
                 </div>
                 <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {statsDetailList.length === 0 ? (
                       <div className="text-center text-slate-400 font-black uppercase text-xs py-10 opacity-60">Aucune réservation trouvée pour ce critère</div>
                    ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {statsDetailList.map(t => (
                              <div key={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-lg cursor-pointer transition-all group hover:scale-[1.02]">
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                         <h4 className="font-black uppercase text-sm group-hover:text-blue-600 transition-colors">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}</h4>
                                         <p className="text-[10px] text-slate-400 font-bold mt-0.5">{t.platform} • {t.name}</p>
                                      </div>
                                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase inline-block ${getStatusProps(t).color}`}>
                                          {getStatusProps(t).label}
                                      </span>
                                  </div>
                                  <div className="bg-slate-50 p-2.5 rounded-xl flex justify-between font-black text-[10px] items-center mb-2 text-slate-500">
                                      <span>{formatDateFr(t.startDate)}</span><ArrowRight size={12} className="text-slate-300"/><span>{formatDateFr(t.endDate)}</span>
                                  </div>
                                  <div className="flex justify-between items-end mt-4 border-t border-slate-50 pt-3">
                                      <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Net estimé</div>
                                      <div className="font-black text-lg text-slate-800">{(parseFloat(t.netAmount) || 0).toFixed(2)}€</div>
                                  </div>
                              </div>
                          ))}
                       </div>
                    )}
                 </div>
              </div>
           </div>
        )}

        <div className="max-w-7xl mx-auto pb-32">
          
          <RenderFilters />

          {activeTab === 'reservations' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center"><h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Réservations</h2><button onClick={() => { setEditingResId(null); setFormData({ propertyId: properties[0]?.id || '', name: '', phone: '', startDate: '', endDate: '', paymentDate: '', platform: availablePlatforms[0] || 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [], comment: '', acompte1Amount: '', acompte1Date: '', acompte2Amount: '', acompte2Date: '', soldeAmount: '', soldeDate: '' }); setIsModalOpen(true); }} className="bg-blue-600 text-white px-8 py-4 rounded-[24px] font-black text-[11px] shadow-xl hover:bg-blue-700 transition-all">+ Nouvelle</button></div>
              
              {/* LISTE DÉROULANTE MOBILE */}
              <div className="grid grid-cols-1 gap-4 md:hidden max-h-[65vh] overflow-y-auto custom-scrollbar p-1">
                {(reservationsList || []).map(t => (
                  <div key={t.id} data-res-id={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="bg-white p-6 rounded-[32px] shadow-lg border border-slate-50 cursor-pointer">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-base font-black uppercase">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}</h3>
                        <div className="flex gap-2 text-[10px] text-slate-400"><span>{t.platform}</span><span>{t.name}</span></div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span onClick={(e) => handleQuickPayToggle(e, t, 'global')} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase cursor-pointer hover:scale-105 transition-transform inline-block ${getStatusProps(t).color}`}>
                          {getStatusProps(t).label}
                        </span>
                        {t.paymentDate && t.platform !== 'En direct' && <span className="text-[8px] text-slate-400 mt-1 font-bold">{formatDateFr(t.paymentDate)}</span>}
                        {t.platform === 'En direct' && t.soldeDate && <span className="text-[8px] text-slate-400 mt-1 font-bold">{formatDateFr(t.soldeDate)}</span>}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl flex justify-between font-black text-xs mb-3"><span>{formatDateFr(t.startDate)}</span><ArrowRight size={14} className="text-slate-300"/><span>{formatDateFr(t.endDate)}</span></div>
                    
                    {t.resExpenses && t.resExpenses.length > 0 && (
                      <div className="space-y-1.5 border-t border-slate-50 pt-3 mb-3">
                        {(t.resExpenses || []).map((exp, idx) => (
                          <div key={idx} onClick={(e) => handleQuickPayToggle(e, t, 'expense', exp.id)} className="flex items-center justify-between text-[10px] bg-slate-50 p-2 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                            <span className="uppercase font-black text-slate-500">{exp.type} ({exp.person})</span>
                            <div className="text-right">
                              <span className={`font-black flex items-center justify-end gap-1 ${exp.paymentDate ? 'text-emerald-600' : 'text-orange-500'}`}>{exp.amount}€ {exp.paymentDate ? <CheckCircle size={10}/> : <Clock size={10}/>}</span>
                              {exp.paymentDate && <div className="text-[8px] text-slate-400 mt-0.5">{formatDateFr(exp.paymentDate)}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-right font-black text-lg">{(parseFloat(t.netAmount) || 0).toFixed(2)}€</div>
                  </div>
                ))}
              </div>

              {/* LISTE DÉROULANTE ORDINATEUR */}
              <div className="hidden md:block bg-white rounded-[40px] shadow-2xl overflow-hidden max-h-[65vh] flex flex-col">
                <div className="overflow-y-auto custom-scrollbar flex-1 relative">
                    <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 font-black uppercase border-b text-slate-400 sticky top-0 z-10 shadow-sm">
                        <tr><th className="p-6">Logement</th><th className="p-6">Client</th><th className="p-6 text-center">Dates</th><th className="p-6">Prestations</th><th className="p-6 text-right">Net</th><th className="p-6 text-center">État</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold">
                        {(reservationsList || []).map(t => (
                        <tr key={t.id} data-res-id={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="hover:bg-slate-50 cursor-pointer">
                            <td className="p-6 uppercase">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}<div className="text-blue-600 text-[10px]">{t.platform}</div></td>
                            <td className="p-6">
                            <div>{t.name}</div>
                            {t.phone && <div className="text-slate-400 text-[9px] mt-0.5">{t.phone}</div>}
                            </td>
                            <td className="p-6 text-center text-slate-500">{formatDateFr(t.startDate)} ➔ {formatDateFr(t.endDate)}</td>
                            <td className="p-6">
                            <div className="space-y-1.5">
                                {(t.resExpenses || []).map((exp, idx) => (
                                    <div key={idx} onClick={(e) => handleQuickPayToggle(e, t, 'expense', exp.id)} className="flex items-center justify-between text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-100 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
                                    <span className="uppercase font-black text-slate-500 leading-none">{exp.type} ({exp.person})</span>
                                    <div className="text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <span className={`font-black ${exp.paymentDate ? 'text-emerald-600' : 'text-orange-500'}`}>{exp.amount}€</span>
                                            {exp.paymentDate ? <CheckCircle size={10} className="text-emerald-500" /> : <Clock size={10} className="text-orange-400" />}
                                        </div>
                                        {exp.paymentDate && <div className="text-[8px] text-slate-400 mt-0.5 leading-none">{formatDateFr(exp.paymentDate)}</div>}
                                    </div>
                                    </div>
                                ))}
                            </div>
                            </td>
                            <td className="p-6 text-right font-black">{(parseFloat(t.netAmount) || 0).toFixed(2)}€</td>
                            <td className="p-6 text-center">
                            <div className="flex flex-col items-center">
                                <span onClick={(e) => handleQuickPayToggle(e, t, 'global')} className={`px-4 py-2 rounded-full text-[9px] uppercase cursor-pointer hover:scale-105 transition-transform inline-block ${getStatusProps(t).color}`}>
                                {getStatusProps(t).label}
                                </span>
                                {t.platform !== 'En direct' && t.paymentDate && <span className="text-[8px] text-slate-400 mt-1 font-bold">{formatDateFr(t.paymentDate)}</span>}
                                {t.platform === 'En direct' && t.soldeDate && <span className="text-[8px] text-slate-400 mt-1 font-bold">{formatDateFr(t.soldeDate)}</span>}
                            </div>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'agenda' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center"><div><h2 className="text-2xl font-black uppercase">Agenda</h2></div><div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl shadow-lg"><button onClick={()=>handleMonthChange('prev')}><ChevronLeft/></button><div className="text-center font-black min-w-[120px] uppercase text-xs">{['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][filterMonth==='all'?new Date().getMonth():parseInt(filterMonth)]}</div><button onClick={()=>handleMonthChange('next')}><ChevronRight/></button></div></div>
              <div className="bg-white p-6 rounded-[40px] shadow-2xl overflow-x-auto"><div className="min-w-[700px]"><div className="grid grid-cols-7 text-center font-black text-slate-300 text-[10px] uppercase mb-4">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=><div key={d}>{d}</div>)}</div><div className="grid grid-cols-7 gap-2">{(agendaDays || []).map((item,idx)=>{ if(item.empty) return <div key={idx} className="h-24 bg-slate-50/30 rounded-2xl"></div>; const dayRes = (reservationsList || []).filter(r=>item.dateStr>=r.startDate && item.dateStr<=r.endDate); return (<div key={item.dateStr} className={`h-24 md:h-32 border rounded-2xl p-2 relative flex flex-col ${item.dateStr===todayStr?'border-blue-500 bg-blue-50/10':'border-slate-100'}`}><span className="text-[10px] font-black text-slate-300">{item.day}</span><div className="flex-1 space-y-1 overflow-y-auto no-scrollbar">{dayRes.map(r=>(<div key={r.id} onClick={(e)=>{e.stopPropagation();setEditingResId(r.id);setFormData(r);setIsModalOpen(true)}} className="text-[8px] font-black text-white p-1 rounded truncate cursor-pointer" style={{backgroundColor: CHART_COLORS[(properties || []).findIndex(p=>p.id===r.propertyId)%CHART_COLORS.length]}}>{r.name?.split(' ')[0]}</div>))}</div></div>);})}</div></div></div>
            </div>
          )}
          
          {activeTab === 'statistiques' && (
             <div className="space-y-10 animate-in fade-in">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                   <div>
                      <h2 className="text-3xl md:text-4xl font-black uppercase text-slate-900 tracking-tighter leading-none mb-2">Statistiques</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tableau de bord et croisements dynamiques</p>
                   </div>
                </div>

                {/* Blocs indicateurs clés */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div onClick={() => setStatsDetailConfig({ type: 'year_current', title: `CA Généré Brut (${statsCalculations.year})` })} className="bg-white p-6 rounded-[32px] shadow-xl border border-slate-50 flex flex-col justify-center items-center text-center h-40 relative overflow-hidden group hover:scale-[1.03] transition-transform cursor-pointer hover:ring-2 ring-blue-500 ring-offset-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 z-10">CA Brut ({statsCalculations.year})</p>
                    <p className="text-3xl font-black text-indigo-600 z-10">{Math.round(statsCalculations.currentYearGross).toLocaleString('fr-FR')}€</p>
                    <div className={`mt-2 flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full z-10 ${statsCalculations.grossGrowth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {statsCalculations.grossGrowth >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {statsCalculations.grossGrowth}% vs {statsCalculations.prevYear}
                    </div>
                    <div className="absolute inset-0 bg-blue-50/0 group-hover:bg-blue-50/50 transition-colors pointer-events-none"></div>
                  </div>
                  
                  <div onClick={() => setStatsDetailConfig({ type: 'upcoming', title: `CA à venir (Impayés)` })} className="bg-white p-6 rounded-[32px] shadow-xl border border-slate-50 flex flex-col justify-center items-center text-center h-40 relative group hover:scale-[1.03] transition-transform cursor-pointer hover:ring-2 ring-blue-500 ring-offset-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CA à venir (Impayés)</p>
                    <p className="text-3xl font-black text-blue-600">{Math.round(statsCalculations.upcomingGross).toLocaleString('fr-FR')}€</p>
                    <p className="text-[9px] text-blue-400 mt-2 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">👉 Clic pour voir</p>
                  </div>
                  
                  <div onClick={() => setStatsDetailConfig({ type: 'expenses', title: `Réservations avec Prestations (${statsCalculations.year})` })} className="bg-white p-6 rounded-[32px] shadow-xl border border-slate-50 flex flex-col justify-center items-center text-center h-40 group hover:scale-[1.03] transition-transform cursor-pointer hover:ring-2 ring-blue-500 ring-offset-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Coût des Prestations</p>
                    <p className="text-3xl font-black text-rose-500">-{Math.round(statsCalculations.currentYearExp).toLocaleString('fr-FR')}€</p>
                    <p className="text-[9px] text-blue-400 mt-2 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">👉 Clic pour voir</p>
                  </div>
                  
                  <div onClick={() => setStatsDetailConfig({ type: 'year_current', title: `Toutes les réservations (${statsCalculations.year})` })} className="bg-white p-6 rounded-[32px] shadow-xl border border-slate-50 flex flex-col justify-center items-center text-center h-40 group hover:scale-[1.03] transition-transform cursor-pointer hover:ring-2 ring-blue-500 ring-offset-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Revenu Brut / Nuit</p>
                    <p className="text-3xl font-black text-emerald-600">{statsCalculations.revPerNight}€</p>
                    <p className="text-[9px] text-blue-400 mt-2 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">👉 Clic pour voir</p>
                  </div>

                  <div onClick={() => setStatsDetailConfig({ type: 'year_current', title: `Toutes les réservations (${statsCalculations.year})` })} className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col justify-center items-center text-center h-32 hover:bg-slate-100 cursor-pointer transition-colors group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nuitées Louées</p>
                    <p className="text-2xl font-black text-slate-700">{statsCalculations.currentYearNights}</p>
                  </div>
                  <div onClick={() => setStatsDetailConfig({ type: 'year_current', title: `Toutes les réservations (${statsCalculations.year})` })} className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col justify-center items-center text-center h-32 hover:bg-slate-100 cursor-pointer transition-colors group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Durée Moyenne</p>
                    <p className="text-2xl font-black text-slate-700">{statsCalculations.avgStay} <span className="text-sm">j</span></p>
                  </div>
                  <div onClick={() => setStatsDetailConfig({ type: 'year_current', title: `Toutes les réservations (${statsCalculations.year})` })} className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col justify-center items-center text-center h-32 hover:bg-slate-100 cursor-pointer transition-colors group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Panier Moyen</p>
                    <p className="text-2xl font-black text-slate-700">{statsCalculations.avgGrossPerRes}€</p>
                  </div>
                  <div onClick={() => setStatsDetailConfig({ type: 'year_current', title: `Toutes les réservations (${statsCalculations.year})` })} className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col justify-center items-center text-center h-32 hover:bg-slate-100 cursor-pointer transition-colors group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nb. Réservations</p>
                    <p className="text-2xl font-black text-slate-700">{baseTenants.filter(t => t.startDate && t.startDate.startsWith(statsCalculations.year.toString())).length}</p>
                  </div>
                </div>

                {/* GRAPHIQUE MULTI-COURBES DYNAMIQUE */}
                <ComparisonChart data={baseTenants} properties={properties} platforms={availablePlatforms} yearsAvailable={yearsAvailable} />

                {/* ROSACES DE REPARTITION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <DonutChart title={`Net Reçu (Banque) par Logement (${filterYear === 'all' ? 'Toutes années' : filterYear})`} data={(properties || []).map((p,idx)=>({label:p.name,value:(baseTenants || []).reduce((acc,t) => t.propertyId===p.id ? acc + getTenantProfitForFilters(t) : acc, 0),color:CHART_COLORS[idx%CHART_COLORS.length]}))} />
                   <DonutChart title={`Net Reçu (Banque) par Plateforme (${filterYear === 'all' ? 'Toutes années' : filterYear})`} data={(availablePlatforms || []).map((p,idx)=>({label:p,value:(baseTenants || []).reduce((acc,t) => t.platform===p ? acc + getTenantProfitForFilters(t) : acc, 0),color:CHART_COLORS[(idx+4)%CHART_COLORS.length]}))} />
                </div>
             </div>
          )}

          {activeTab === 'finances' && (
            <div className="space-y-10 animate-in fade-in">
              <h2 className="text-3xl font-black uppercase">Comptabilité</h2>
              <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden text-xs">
                <div className="p-8 bg-slate-900 text-white font-black uppercase flex justify-between items-center"><div>Bilan Global</div></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-50 uppercase text-slate-400 border-b">
                      <tr>
                        <th className="p-6">Période</th>
                        <th className="p-6 text-right">Brut URSSAF</th>
                        <th className="p-6 text-right text-emerald-600">Direct (hors URSSAF)</th>
                        <th className="p-6 text-right text-indigo-600">Virement Reçu</th>
                        <th className="p-6 text-right text-slate-500">Prestations</th>
                        <th className="p-6 text-right text-rose-500">Cotisations (7.7%)</th>
                        <th className="p-6 text-right font-black">Profit Réel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-bold">
                      {(monthlyRecapData || []).map(([m, d]) => (
                        <tr key={m} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="p-6 capitalize text-sm">{formatMonthYear(m)}</td>
                          <td className="p-6 text-right text-slate-500">
                             <div className="text-sm">{d.urssafGross.toLocaleString('fr-FR')}€</div>
                             <div className="mt-1 flex flex-col items-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                               {(availablePlatforms || []).map(p => d.platforms[p] > 0 && <span key={p} className="text-[9px] text-slate-400 font-bold uppercase">{p}: {d.platforms[p].toLocaleString('fr-FR')}€</span>)}
                             </div>
                          </td>
                          <td className="p-6 text-right text-emerald-600 font-black text-sm">{d.directNet > 0 ? `${d.directNet.toLocaleString('fr-FR')}€` : '-'}</td>
                          <td className="p-6 text-right text-indigo-600 font-black text-sm">{d.totalBank.toLocaleString('fr-FR')}€</td>
                          <td className="p-6 text-right text-slate-500 text-sm">-{d.charges.toLocaleString('fr-FR')}€</td>
                          <td className="p-6 text-right text-rose-500 text-sm">-{d.taxes.toFixed(2)}€</td>
                          <td className={`p-6 text-right font-black text-sm ${d.totalBank - d.taxes - d.charges >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{(d.totalBank - d.taxes - d.charges).toLocaleString('fr-FR')}€</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-indigo-600 text-white font-black text-lg">
                      <tr>
                        <td className="p-8 uppercase text-[10px]">TOTAL</td>
                        <td className="p-8 text-right opacity-90">
                           <div>{monthlyRecapData.reduce((acc, [m, d]) => acc + d.urssafGross, 0).toLocaleString('fr-FR')}€</div>
                           <div className="mt-1 flex flex-col items-end gap-0.5">
                               {(availablePlatforms || []).map(p => {
                                 const platTotal = monthlyRecapData.reduce((acc, [m, d]) => acc + (d.platforms[p] || 0), 0);
                                 if(platTotal > 0) return <span key={p} className="text-[9px] text-indigo-200 font-bold uppercase">{p}: {platTotal.toLocaleString('fr-FR')}€</span>;
                                 return null;
                               })}
                           </div>
                        </td>
                        <td className="p-8 text-right text-emerald-300">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.directNet, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-8 text-right">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-8 text-right text-indigo-200">-{monthlyRecapData.reduce((acc, [m, d]) => acc + d.charges, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-8 text-right text-rose-300">-{monthlyRecapData.reduce((acc, [m, d]) => acc + d.taxes, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-8 text-right bg-indigo-700/50">{(monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0) - monthlyRecapData.reduce((acc, [m, d]) => acc + d.taxes + d.charges, 0)).toLocaleString('fr-FR')}€</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden text-xs"><div className="p-8 bg-slate-900 text-white font-black uppercase flex justify-between">Suivi Prestataires</div><div className="overflow-x-auto"><table className="w-full text-left min-w-[700px]"><thead className="bg-slate-50 uppercase text-slate-400 border-b"><tr><th className="p-6">Date</th><th className="p-6">Logement</th><th className="p-6">Prestataire</th><th className="p-6 text-right">Montant</th><th className="p-6 text-center">Statut</th></tr></thead><tbody className="divide-y font-bold">{(detailedExpenses || []).map((exp) => (<tr key={exp.id}><td className="p-6">{formatDateFr(exp.dateRes)}</td><td className="p-6 uppercase">{exp.propertyName}</td><td className="p-6 text-blue-600 uppercase">{exp.person}</td><td className="p-6 text-right">{(exp.amount || 0).toLocaleString('fr-FR')}€</td><td className="p-6 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${exp.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{exp.paymentDate ? 'Payé' : 'Attente'}</span></td></tr>))}</tbody></table></div></div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-10 animate-in fade-in">
              <h2 className="text-3xl font-black uppercase">Paramètres</h2>
              
              <div className="bg-white p-8 rounded-[40px] border-2 border-dashed shadow-xl flex flex-col items-center justify-center text-center">
                <UploadCloud size={40} className="text-blue-600 mb-4"/>
                <h3 className="text-xl font-black uppercase">Importation de Réservations (CSV)</h3>
                <p className="text-xs text-slate-400 mt-2 mb-6">Sélectionnez la plateforme source et collez votre export CSV (gère les colonnes automatiquement).</p>
                
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl shadow-inner border border-slate-100">
                  <label className={`flex-1 py-3 px-6 rounded-xl font-black uppercase text-[10px] cursor-pointer transition-all ${importSource === 'Airbnb' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}>
                    <input type="radio" value="Airbnb" checked={importSource === 'Airbnb'} onChange={e => setImportSource(e.target.value)} className="hidden" /> Airbnb
                  </label>
                  <label className={`flex-1 py-3 px-6 rounded-xl font-black uppercase text-[10px] cursor-pointer transition-all ${importSource === 'Booking' ? 'bg-blue-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}>
                    <input type="radio" value="Booking" checked={importSource === 'Booking'} onChange={e => setImportSource(e.target.value)} className="hidden" /> Booking
                  </label>
                </div>

                <textarea value={importText} onChange={(e)=>setImportText(e.target.value)} placeholder={`Collez les lignes de votre export ${importSource} ici...`} className="w-full mt-6 p-4 bg-slate-50 border rounded-3xl min-h-[150px] font-mono text-[10px] outline-none" />
                
                {importStatus && <p className="mt-4 font-black text-emerald-600 uppercase">{importStatus}</p>}
                
                {(reviewList || []).length > 0 && (
                  <div className="w-full mt-6 overflow-x-auto">
                    <table className="w-full text-left text-[10px] font-bold border-collapse">
                      <thead className="bg-slate-50 border-b text-slate-500"><tr><th className="p-3">Imp.</th><th className="p-3">Client</th><th className="p-3">Logement</th><th className="p-3">Statut</th></tr></thead>
                      <tbody>
                        {reviewList.map(item => (
                          <tr key={item.id} className={`border-b ${!item.hasProperty ? 'bg-rose-50' : item.isDuplicate ? 'bg-orange-50' : ''}`}>
                            <td className="p-3"><input type="checkbox" checked={item.selected} disabled={!item.hasProperty} onChange={()=>setReviewList(reviewList.map(r=>r.id===item.id?{...r,selected:!r.selected}:r))} /></td>
                            <td className="p-3">{item.name}<div className="text-slate-400">{formatDateFr(item.startDate)}</div></td>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-[40px] md:rounded-[60px] shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col border border-slate-100 overflow-hidden relative z-10">
            <div className="p-6 md:p-10 border-b flex justify-between items-center bg-white sticky top-0 z-10">
               <div className="flex items-center gap-4 text-blue-600 font-black uppercase leading-none"><CalendarCheck size={28} /> Détails</div>
               <div className="flex items-center gap-2">
                 <a href={getGoogleCalendarUrl(formData, (properties || []).find(p => p.id === formData.propertyId))} target="_blank" rel="noopener noreferrer" title="Ajouter à Google Agenda" className="p-3 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                    <CalendarIcon size={20} />
                 </a>
                 <button type="button" onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all duration-300"><X size={20} /></button>
               </div>
            </div>
            <form onSubmit={saveRes} className="p-6 md:p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Logement<select value={formData.propertyId || ''} onChange={e => setFormData({ ...formData, propertyId: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900"><option value="">-- Choisir un logement --</option>{(properties || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                 <div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Voyageur<input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" placeholder="Nom du client" /></div>
                 <div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Contact<input value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" placeholder="Tél / Email" /></div>
                 <div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Début<input type="date" value={formData.startDate || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div>
                 <div className="space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">Fin<input type="date" value={formData.endDate || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-black text-slate-900" /></div>
                 
                 <div className="md:col-span-3 space-y-1 uppercase font-black tracking-widest text-slate-400 text-[10px]">
                    Notes / Commentaires
                    <textarea value={formData.comment || ''} onChange={e => setFormData({ ...formData, comment: e.target.value })} placeholder="Nombre de personnes, requêtes spéciales, détails supplémentaires..." className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[24px] font-bold text-slate-700 outline-none min-h-[100px]" />
                 </div>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-8 rounded-[48px] border border-blue-50 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between font-black uppercase text-blue-900 border-b border-blue-100 pb-4 gap-4 text-[11px] tracking-widest">
                   <div className="flex items-center gap-3">
                       Plateforme
                       <select value={formData.platform || ''} onChange={e => setFormData({ ...formData, platform: e.target.value })} className="bg-white border rounded-xl px-4 py-2 shadow-sm text-blue-600 outline-none">
                           {(availablePlatforms || []).map(p => <option key={p} value={p}>{p}</option>)}
                       </select>
                   </div>
                   <label className="flex items-center justify-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border shadow-sm hover:bg-slate-50 transition-colors">
                       <input type="checkbox" checked={formData.isUrssaf !== false} onChange={e => setFormData({ ...formData, isUrssaf: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                       <span className={`${formData.isUrssaf !== false ? 'text-blue-600' : 'text-slate-400'}`}>Déclarer URSSAF</span>
                   </label>
                </div>
            
                {/* CHAMPS DYNAMIQUES SELON LA PLATEFORME */}
                {formData.platform === 'En direct' ? (
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="w-full md:w-1/2">
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Montant Global de la réservation</label>
                            <input type="number" step="0.01" value={formData.grossAmount || ''} onChange={e => setFormData({ ...formData, grossAmount: e.target.value })} placeholder="Montant total €" className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none text-lg" />
                        </div>
                        <div className="w-full md:w-1/2 text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Les acomptes et le solde ci-dessous correspondent au paiement de ce montant global.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                           <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Acompte 1</label>
                           <input type="number" step="0.01" value={formData.acompte1Amount || ''} onChange={e => setFormData({ ...formData, acompte1Amount: e.target.value })} placeholder="Montant €" className="w-full p-3 border border-slate-100 rounded-xl font-black mb-2 text-slate-700 outline-none" />
                           <input type="date" value={formData.acompte1Date || ''} onChange={e => setFormData({ ...formData, acompte1Date: e.target.value })} className="w-full p-3 border border-slate-100 rounded-xl font-black text-slate-500 outline-none cursor-pointer" />
                       </div>
                       <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                           <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Acompte 2</label>
                           <input type="number" step="0.01" value={formData.acompte2Amount || ''} onChange={e => setFormData({ ...formData, acompte2Amount: e.target.value })} placeholder="Montant €" className="w-full p-3 border border-slate-100 rounded-xl font-black mb-2 text-slate-700 outline-none" />
                           <input type="date" value={formData.acompte2Date || ''} onChange={e => setFormData({ ...formData, acompte2Date: e.target.value })} className="w-full p-3 border border-slate-100 rounded-xl font-black text-slate-500 outline-none cursor-pointer" />
                       </div>
                       <div className="bg-emerald-50/50 p-4 rounded-3xl border border-emerald-100 shadow-sm">
                           <label className="text-[10px] font-black uppercase text-emerald-600 mb-2 block">Solde (Validation)</label>
                           <input type="number" step="0.01" value={formData.soldeAmount || ''} onChange={e => setFormData({ ...formData, soldeAmount: e.target.value })} placeholder="Montant €" className="w-full p-3 border border-emerald-200 rounded-xl font-black mb-2 text-emerald-700 outline-none bg-white" />
                           <input type="date" value={formData.soldeDate || ''} onChange={e => setFormData({ ...formData, soldeDate: e.target.value })} className="w-full p-3 border border-emerald-200 rounded-xl font-black text-emerald-700 outline-none cursor-pointer bg-white" />
                       </div>
                    </div>
                  </div>
                ) : isCplxFormModale ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><label className="text-[10px] font-black uppercase text-slate-400">Total affiché appli</label><input type="number" step="0.01" value={formData.displayedAmount || ''} onChange={e => setFormData({ ...formData, displayedAmount: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black outline-none" /></div>
                    <div><label className="text-[10px] font-black uppercase text-rose-400">Taxe Séjour</label><input type="number" step="0.01" value={formData.cityTax || ''} onChange={e => setFormData({ ...formData, cityTax: e.target.value })} className="w-full p-4 border border-rose-100 rounded-2xl font-black bg-rose-50/30 text-rose-500 outline-none" /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400">Commission Plat.</label><input type="number" step="0.01" value={formData.platformFees || ''} onChange={e => setFormData({ ...formData, platformFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black outline-none" /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400">Frais Bancaires</label><input type="number" step="0.01" value={formData.bankFees || ''} onChange={e => setFormData({ ...formData, bankFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black outline-none" /></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-black uppercase text-slate-400">Brut URSSAF</label><input type="number" step="0.01" value={formData.grossAmount || ''} onChange={e => setFormData({ ...formData, grossAmount: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black outline-none" /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400">Commission Plateforme</label><input type="number" step="0.01" value={formData.platformFees || ''} onChange={e => setFormData({ ...formData, platformFees: e.target.value })} className="w-full p-4 border border-slate-200 rounded-2xl font-black outline-none" /></div>
                  </div>
                )}
                
                {/* ENCART BRUT URSSAF BOOKING */}
                {isCplxFormModale && (
                  <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl mt-4 shadow-inner">
                    <span className="font-black uppercase text-[10px] tracking-widest text-slate-300">Brut URSSAF (Total - Taxe Séjour) :</span>
                    <span className="font-black text-lg text-emerald-400">{((parseFloat(formData.displayedAmount) || 0) - (parseFloat(formData.cityTax) || 0)).toFixed(2)}€</span>
                  </div>
                )}

              </div>
              
              <div className="space-y-4">
                  <div className="flex justify-between font-black uppercase tracking-widest text-slate-400 text-[10px]">Prestations<button type="button" onClick={() => setFormData({ ...formData, resExpenses: [...(formData.resExpenses || []), { id: Date.now().toString(), person: availableProviders[0] || '', type: availableServiceTypes[0] || '', amount: 0, paymentDate: '' }] })} className="bg-slate-900 text-white px-4 py-2 rounded-xl">+ Ajouter</button></div>
                  {(formData.resExpenses || []).map(exp => (
                    <div key={exp.id} className="flex gap-2 bg-slate-50 p-4 rounded-[28px] border border-slate-100 items-center">
                      <select value={exp.person || ''} onChange={e => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).map(x => x.id === exp.id ? { ...x, person: e.target.value } : x) })} className="flex-1 p-3 border rounded-xl font-black uppercase text-[10px] outline-none">{(availableProviders || []).map(p => <option key={p} value={p}>{p}</option>)}</select>
                      <select value={exp.type || ''} onChange={e => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 p-3 border rounded-xl font-black uppercase text-[10px] outline-none">{(availableServiceTypes || []).map(p => <option key={p} value={p}>{p}</option>)}</select>
                      <input type="number" value={exp.amount || ''} onChange={e => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).map(x => x.id === exp.id ? { ...x, amount: e.target.value } : x) })} className="w-20 p-3 border rounded-xl font-black text-right outline-none" />
                      <button type="button" onClick={() => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).filter(x => x.id !== exp.id) })} className="text-rose-500 font-black px-2"><Trash2 size={18}/></button>
                    </div>
                  ))}
              </div>
              
              {formData.platform !== 'En direct' && (
                <div className={`p-6 md:p-8 rounded-[32px] md:rounded-[40px] border-2 flex flex-col md:flex-row items-center justify-between transition-all shadow-xl gap-4 ${formData.paymentDate ? 'bg-emerald-50/50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
                    <div className="text-center md:text-left">
                        <h4 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-900 leading-none">Paiement Global Reçu</h4>
                        <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase mt-1.5">Définit le mois URSSAF</p>
                    </div>
                    <input type="date" value={formData.paymentDate || ''} onChange={e => setFormData({ ...formData, paymentDate: e.target.value })} className="w-full md:w-auto p-3 border border-slate-200 rounded-[15px] font-black bg-white shadow-lg outline-none cursor-pointer" />
                </div>
              )}

              <div className="bg-slate-900 p-8 rounded-[48px] text-white flex flex-col md:flex-row justify-between items-center gap-6">
                 <div className="text-center md:text-left leading-none">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Net Estimé</p>
                    <p className="text-4xl font-black text-blue-400 tracking-tighter">
                      {formData.platform === 'En direct' 
                        ? (parseFloat(formData?.grossAmount) || 0).toFixed(2)
                        : (nModale - curChargesModale).toFixed(2)}€
                    </p>
                 </div>
                 <div className="flex items-center gap-4 w-full md:w-auto">
                   {editingResId && <button type="button" onClick={() => deleteRes(editingResId)} className="p-4 text-rose-500 bg-rose-50 rounded-[24px] hover:bg-rose-500 hover:text-white transition-colors"><Trash2 size={24}/></button>}
                   <button type="submit" className="w-full md:w-auto bg-blue-600 px-12 py-5 rounded-[24px] font-black uppercase tracking-[2px] shadow-xl hover:-translate-y-1 transition-all">Enregistrer</button>
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
