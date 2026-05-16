import React, { useState, useMemo, useEffect, useRef } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, doc, onSnapshot, addDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import {
  Key, Lock, Loader2, Filter, List, CalendarRange, BarChart2, Calculator, Settings,
  Menu, X, Euro, Search, ArrowRight, LocateFixed, ChevronLeft, ChevronRight,
  Mail, CheckCircle, Clock, TrendingUp, TrendingDown, UploadCloud, AlertTriangle,
  Check, Trash2, CalendarCheck, Calendar as CalendarIcon
} from 'lucide-react';

import { auth, db, appId } from './firebaseConfig';
import { CHART_COLORS, TIME_SLOTS, isSundayOrHoliday } from './utils';
import DonutChart from './DonutChart';
import ComparisonChart from './ComparisonChart';
import { getAccessToken, setAccessToken, clearAccessToken, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, createDiasEvent, updateDiasEvent, deleteDiasEvent, getEventAttendees } from './googleCalendar';
import Statistiques from './Statistiques';
// --- COMPOSANT PRINCIPAL ---
const App = () => {
  // 1. ETATS GLOBAUX & HOOKS
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
    propertyId: '', name: '', phone: '', startDate: '', endDate: '', paymentDate: '', 
    platform: 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', 
    bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [], comment: '',
    acompte1Amount: '', acompte1Date: '', acompte2Amount: '', acompte2Date: '', soldeAmount: '', soldeDate: ''
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

  const [googleConnected, setGoogleConnected] = useState(() => {
    const token   = localStorage.getItem('gcal_token');
    const expiry  = parseInt(localStorage.getItem('gcal_token_expiry') || '0', 10);
    if (token && expiry && Date.now() < expiry) return true;
    if (token) { localStorage.removeItem('gcal_token'); localStorage.removeItem('gcal_token_expiry'); }
    return false;
  });
  const [diasCalendarId, setDiasCalendarId] = useState('8f2fa53e3d419a4a2be45ea9c4f1e19a4fa6ad09ce1f73e80d7960374a6a7767@group.calendar.google.com');
  const [diasColorId, setDiasColorId] = useState('11');
  const [diasMigrationDone, setDiasMigrationDone] = useState(null);
  const [syncWarning, setSyncWarning] = useState(false);
  const [attendeeStatuses, setAttendeeStatuses] = useState({});
  const tokenClientRef = useRef(null);
  const renewTimerRef  = useRef(null);
  const tenantsRef = useRef([]);
  const propertiesRef = useRef([]);
  const providerEmailsRef = useRef({});
  const diasCalendarIdRef = useRef(diasCalendarId);

  const todayStr = new Date().toISOString().split('T')[0];

  // --- REFS POUR LE CARROUSEL NATIF ---
  const scrollContainerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const TABS_ORDER = ['reservations', 'agenda', 'statistiques', 'finances', 'settings'];
 
  // 2. EFFETS FIREBASE
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setLoading(false); }
      else signInAnonymously(auth);
    });
 
    const unsubProps = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), (snap) => {
      setProperties(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });
 
    const unsubTenants = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), (snap) => {
      setTenants(snap.docs.map(d => {
        const data = d.data();
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
        if (d.providerEmails) setProviderEmails(d.providerEmails);
        if (d.diasCalendarId) setDiasCalendarId(d.diasCalendarId);
        if (d.diasColorId) setDiasColorId(d.diasColorId);
        setDiasMigrationDone(!!d.diasMigrationDone);
      }
    });
 
    return () => { unsubAuth(); unsubProps(); unsubTenants(); unsubSettings(); };
  }, []);

  useEffect(() => {
    const initGIS = () => {
      if (!window.google?.accounts?.oauth2) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: (response) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            setGoogleConnected(true);
            syncMissingEvents();
            syncDiasStatuses();
            // renouvellement proactif 55 min après réception du token
            clearTimeout(renewTimerRef.current);
            renewTimerRef.current = setTimeout(() => {
              tokenClientRef.current?.requestAccessToken({ prompt: '' });
            }, 55 * 60 * 1000);
          } else {
            // Ne déconnecter que si le token actuel est vraiment expiré
            const currentExpiry = parseInt(localStorage.getItem('gcal_token_expiry') || '0', 10);
            if (!currentExpiry || Date.now() > currentExpiry) {
              clearAccessToken();
              setGoogleConnected(false);
            }
          }
        },
        prompt: '',
      });
    };
    const scheduleRenew = () => {
      const expiry = parseInt(localStorage.getItem('gcal_token_expiry') || '0', 10);
      if (!expiry) return;
      const msLeft = expiry - Date.now() - 4 * 60 * 1000; // renouvelle 4 min avant expiry
      clearTimeout(renewTimerRef.current);
      renewTimerRef.current = setTimeout(() => {
        tokenClientRef.current?.requestAccessToken({ prompt: '' });
      }, Math.max(msLeft, 0));
    };

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const expiry = parseInt(localStorage.getItem('gcal_token_expiry') || '0', 10);
      if (!expiry) return;
      if (Date.now() > expiry) {
        // Token déjà expiré — afficher la bannière sans popup (popup bloquée sur mobile)
        clearAccessToken();
        setGoogleConnected(false);
      } else if (Date.now() > expiry - 5 * 60 * 1000) {
        // Token expire bientôt — renouvellement silencieux
        tokenClientRef.current?.requestAccessToken({ prompt: '' });
      }
    };

    const script = document.getElementById('gis-script');
    if (window.google?.accounts?.oauth2) { initGIS(); scheduleRenew(); }
    else if (script) script.addEventListener('load', () => { initGIS(); scheduleRenew(); });

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => { tenantsRef.current = tenants; }, [tenants]);
  useEffect(() => { propertiesRef.current = properties; }, [properties]);
  useEffect(() => { providerEmailsRef.current = providerEmails; }, [providerEmails]);
  useEffect(() => { diasCalendarIdRef.current = diasCalendarId; }, [diasCalendarId]);

  useEffect(() => {
    if (!user || user.uid === 'local-test-user' || diasMigrationDone !== false) return;
    const runMigration = async () => {
      const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'));
      for (const d of snap.docs) {
        const data = d.data();
        const expenses = data.resExpenses || [];
        const hasOld = expenses.some(e => e.person === 'Dias nettoyage');
        if (hasOld) {
          const updated = expenses.map(e => e.person === 'Dias nettoyage' ? { ...e, person: 'nettoyages dias' } : e);
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', d.id), { resExpenses: updated }, { merge: true });
        }
      }
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), { diasMigrationDone: true }, { merge: true });
      setDiasMigrationDone(true);
    };
    runMigration();
  }, [user, diasMigrationDone]);

  const syncMissingEvents = async () => {
    const missing = tenantsRef.current.filter(t => !t.googleEventId && t.startDate && t.endDate);
    for (const t of missing) {
      const prop = propertiesRef.current.find(p => p.id === t.propertyId);
      if (!prop?.calendarId) continue;
      try {
        const evt = await createCalendarEvent(prop.calendarId, t, prop.name, providerEmailsRef.current, prop.colorId || null);
        if (evt?.id) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', t.id), { googleEventId: evt.id }, { merge: true });
      } catch (e) {}
    }
  };

  const syncDiasStatuses = async () => {
    const calId = diasCalendarIdRef.current;
    if (!calId) return;
    for (const t of tenantsRef.current) {
      const diasExps = (t.resExpenses || []).filter(x => x.person?.toLowerCase().includes('dias'));
      if (!diasExps.length) continue;
      const updates = diasExps.map(e => ({ ...e }));
      let changed = false;
      for (const exp of updates) {
        if (exp.googleDiasEntryId && exp.googleDiasEntryStatus !== 'accepted') {
          try {
            const evt = await getEventAttendees(calId, exp.googleDiasEntryId);
            const att = (evt?.attendees || []).find(a => !a.self);
            if (att && att.responseStatus !== exp.googleDiasEntryStatus) { exp.googleDiasEntryStatus = att.responseStatus; changed = true; }
          } catch (e) {}
        }
        if (exp.googleDiasExitId && exp.googleDiasExitStatus !== 'accepted') {
          try {
            const evt = await getEventAttendees(calId, exp.googleDiasExitId);
            const att = (evt?.attendees || []).find(a => !a.self);
            if (att && att.responseStatus !== exp.googleDiasExitStatus) { exp.googleDiasExitStatus = att.responseStatus; changed = true; }
          } catch (e) {}
        }
      }
      if (!changed) continue;
      const newExpenses = (t.resExpenses || []).map(e => updates.find(u => u.id === e.id) || e);
      try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', t.id), { resExpenses: newExpenses }, { merge: true }); } catch (e) {}
    }
  };

  const signInGoogle = () => tokenClientRef.current?.requestAccessToken();
  const signOutGoogle = () => { clearAccessToken(); setGoogleConnected(false); };
  const silentRenew = () => tokenClientRef.current?.requestAccessToken({ prompt: '' });

  const openReservation = async (t) => {
    setEditingResId(t.id);
    setFormData(t);
    setAttendeeStatuses({});
    setIsModalOpen(true);
    if (!getAccessToken()) return;
    const prop = (properties || []).find(p => p.id === t.propertyId);
    const statuses = {};

    if (t.googleEventId && prop?.calendarId) {
      try {
        const evt = await getEventAttendees(prop.calendarId, t.googleEventId);
        const attendee = (evt?.attendees || []).find(a => !a.self);
        if (attendee) statuses[t.googleEventId] = attendee.responseStatus;
      } catch (e) {}
    }

    const updatedExpenses = (t.resExpenses || []).map(exp => ({ ...exp }));
    let needsFirebaseUpdate = false;

    for (const exp of updatedExpenses.filter(x => x.person?.toLowerCase().includes('dias'))) {
      if (exp.googleDiasEntryId && diasCalendarId) {
        try {
          const evt = await getEventAttendees(diasCalendarId, exp.googleDiasEntryId);
          const attendee = (evt?.attendees || []).find(a => !a.self);
          if (attendee) {
            statuses[exp.googleDiasEntryId] = attendee.responseStatus;
            if (attendee.responseStatus !== exp.googleDiasEntryStatus) { exp.googleDiasEntryStatus = attendee.responseStatus; needsFirebaseUpdate = true; }
          }
        } catch (e) {}
      }
      if (exp.googleDiasExitId && diasCalendarId) {
        try {
          const evt = await getEventAttendees(diasCalendarId, exp.googleDiasExitId);
          const attendee = (evt?.attendees || []).find(a => !a.self);
          if (attendee) {
            statuses[exp.googleDiasExitId] = attendee.responseStatus;
            if (attendee.responseStatus !== exp.googleDiasExitStatus) { exp.googleDiasExitStatus = attendee.responseStatus; needsFirebaseUpdate = true; }
          }
        } catch (e) {}
      }
    }

    // Sauvegarder statut principal et Dias dans Firebase pour affichage dans la liste
    const fbUpdate = {};
    if (t.googleEventId && statuses[t.googleEventId] && statuses[t.googleEventId] !== t.googleEventStatus) {
      fbUpdate.googleEventStatus = statuses[t.googleEventId];
    }
    if (needsFirebaseUpdate) fbUpdate.resExpenses = updatedExpenses;
    if (Object.keys(fbUpdate).length > 0) {
      try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', t.id), fbUpdate, { merge: true }); } catch (e) {}
    }

    setAttendeeStatuses(statuses);
  };

  const getStatusIcon = (eventId, storedStatus, size = 14) => {
    if (!eventId) return null;
    const live = attendeeStatuses[eventId];
    const status = live || storedStatus;
    if (status === 'accepted') return <CheckCircle size={size} className="text-emerald-500 flex-shrink-0" title="Acceptée"/>;
    if (status === 'declined') return <X size={size} className="text-red-500 flex-shrink-0" title="Refusée"/>;
    return <Mail size={size} className="text-orange-400 flex-shrink-0" title="En attente de réponse"/>;
  };
  const updatePropCalendar = async (propId, data) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'properties', propId), data, { merge: true });
  };
 
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
                { name: "NELLY JEAN-MARIE", startDate: "2025-04-30", endDate: "2025-05-04", amount: 3800 }
            ];
            
            dataToImport.forEach(item => {
                 addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), {
                      propertyId: targetProp.id,
                      name: item.name, phone: '', startDate: item.startDate, endDate: item.endDate,
                      platform: 'En direct', isUrssaf: true, grossAmount: item.amount, netAmount: item.amount,
                      platformFees: 0, bankFees: 0, cityTax: 0, displayedAmount: 0, acompte1Amount: 0, acompte1Date: '',
                      acompte2Amount: 0, acompte2Date: '', soldeAmount: item.amount, soldeDate: item.endDate, 
                      resExpenses: [], comment: 'Import automatique VILLA CADELIA'
                 });
            });
        }
    };
    runInjection();
  }, [user, loading, properties, tenants, db]);
 
  // 3. MEMOIZATION (CALCULS) 
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
 
  const groupedReservationsList = useMemo(() => {
      const groups = [];
      let currentMonthYear = '';
      
      reservationsList.forEach(t => {
          const start = t.startDate || '';
          if (start) {
              const [year, month] = start.split('-');
              const dateObj = new Date(parseInt(year), parseInt(month) - 1);
              const monthYearString = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
              const formattedLabel = monthYearString.charAt(0).toUpperCase() + monthYearString.slice(1);
              
              if (formattedLabel !== currentMonthYear) {
                  groups.push({ isSeparator: true, label: formattedLabel, id: `sep-${year}-${month}` });
                  currentMonthYear = formattedLabel;
              }
          }
          groups.push(t);
      });
      return groups;
  }, [reservationsList]);
 
  const checkDateFilter = (dateStr) => {
     if (!dateStr) return false;
     const [y, mo] = dateStr.split('-');
     if (filterYear !== 'all' && y !== filterYear) return false;
     if (filterMonth !== 'all' && parseInt(mo)-1 !== parseInt(filterMonth)) return false;
     return true;
  };
 
  const getTenantProfitForFilters = (t) => {
    let profit = 0;
    if (t.platform === 'En direct') {
        const a1 = parseFloat(t.acompte1Amount) || 0, a2 = parseFloat(t.acompte2Amount) || 0, s = parseFloat(t.soldeAmount) || 0;
        if (t.acompte1Date && checkDateFilter(t.acompte1Date)) profit += a1;
        if (t.acompte2Date && checkDateFilter(t.acompte2Date)) profit += a2;
        if (t.soldeDate && checkDateFilter(t.soldeDate)) { profit += s; if (t.isUrssaf !== false) profit -= (parseFloat(t.grossAmount) || 0) * 0.077; }
    } else {
        if (t.paymentDate && checkDateFilter(t.paymentDate)) { profit += (parseFloat(t.netAmount) || 0); if (t.isUrssaf !== false) profit -= (parseFloat(t.grossAmount) || 0) * 0.077; }
    }
    (t.resExpenses || []).forEach(exp => { if (exp.paymentDate && checkDateFilter(exp.paymentDate)) { profit -= (parseFloat(exp.amount) || 0); } });
    return profit;
  };
 
  const monthlyRecapData = useMemo(() => {
    const stats = {};
    const initStats = (m) => { if(!stats[m]) stats[m] = { totalBank: 0, urssafGross: 0, directNet: 0, charges: 0, taxes: 0, platforms: {} }; };
 
    baseTenants.forEach(t => {
      if (t.platform === 'En direct') {
           const a1 = parseFloat(t.acompte1Amount) || 0;
           const a2 = parseFloat(t.acompte2Amount) || 0;
           const s = parseFloat(t.soldeAmount) || 0;
 
           if (t.acompte1Date && checkDateFilter(t.acompte1Date)) { const m = t.acompte1Date.substring(0,7); initStats(m); stats[m].totalBank += a1; if (t.isUrssaf === false) stats[m].directNet += a1; }
           if (t.acompte2Date && checkDateFilter(t.acompte2Date)) { const m = t.acompte2Date.substring(0,7); initStats(m); stats[m].totalBank += a2; if (t.isUrssaf === false) stats[m].directNet += a2; }
           if (t.soldeDate && checkDateFilter(t.soldeDate)) {
               const m = t.soldeDate.substring(0,7); initStats(m); stats[m].totalBank += s; if (t.isUrssaf === false) stats[m].directNet += s;
               if (t.isUrssaf !== false) { stats[m].urssafGross += (parseFloat(t.grossAmount) || 0); stats[m].taxes += (parseFloat(t.grossAmount) || 0) * 0.077; stats[m].platforms[t.platform] = (stats[m].platforms[t.platform] || 0) + (parseFloat(t.grossAmount) || 0); }
           }
      } else {
          if (t.paymentDate && checkDateFilter(t.paymentDate)) {
              const m = t.paymentDate.substring(0, 7); initStats(m); stats[m].totalBank += (parseFloat(t.netAmount) || 0);
              if (t.isUrssaf !== false) { stats[m].urssafGross += (parseFloat(t.grossAmount) || 0); stats[m].taxes += (parseFloat(t.grossAmount) || 0) * 0.077; stats[m].platforms[t.platform] = (stats[m].platforms[t.platform] || 0) + (parseFloat(t.grossAmount) || 0); }
              else { stats[m].directNet += (parseFloat(t.netAmount) || 0); }
          }
      }
      (t.resExpenses || []).forEach(exp => {
          if (exp.paymentDate && checkDateFilter(exp.paymentDate)) {
             if (filterProv !== 'all' && exp.person !== filterProv) return; 
             const m = exp.paymentDate.substring(0, 7); initStats(m); stats[m].charges += (parseFloat(exp.amount) || 0);
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
    let currentYearNights = 0, currentYearGross = 0, prevYearGross = 0, currentYearExp = 0, upcomingGross = 0;
    const currentMonthGross = Array(12).fill(0), prevMonthGross = Array(12).fill(0);
    
    baseTenants.forEach(t => {
       if (!t.startDate) return;
       const resYear = parseInt(t.startDate.split('-')[0], 10), resMonth = parseInt(t.startDate.split('-')[1], 10) - 1;
       const nights = t.endDate ? Math.max(1, Math.round((new Date(t.endDate) - new Date(t.startDate)) / 86400000)) : 1;
       const gross = parseFloat(t.grossAmount) || 0, exp = (t.resExpenses || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
 
       let isFullyPaid = false;
       if (t.platform === 'En direct') isFullyPaid = !!t.soldeDate; else isFullyPaid = !!t.paymentDate;
       if (!isFullyPaid) upcomingGross += gross;
 
       if (resYear === year) { currentYearNights += nights; currentYearGross += gross; currentYearExp += exp; if (resMonth >= 0 && resMonth <= 11) currentMonthGross[resMonth] += gross; } 
       else if (resYear === prevYear) { prevYearGross += gross; if (resMonth >= 0 && resMonth <= 11) prevMonthGross[resMonth] += gross; }
    });
 
    const currentBase = baseTenants.filter(t => t.startDate && t.startDate.startsWith(year.toString()));
    const avgStay = currentBase.length > 0 ? (currentYearNights / currentBase.length).toFixed(1) : 0;
    const avgGrossPerRes = currentBase.length > 0 ? (currentYearGross / currentBase.length).toFixed(2) : 0;
    const revPerNight = currentYearNights > 0 ? (currentYearGross / currentYearNights).toFixed(2) : 0;
    const calcGrowth = (curr, prev) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0);
    
    return { 
        year, prevYear, currentYearNights, currentYearGross, currentYearExp, upcomingGross, prevYearGross, 
        avgStay, avgGrossPerRes, revPerNight, grossGrowth: calcGrowth(currentYearGross, prevYearGross), currentMonthGross, prevMonthGross
    };
  }, [baseTenants, filterYear]);
 
  const statsDetailList = useMemo(() => {
    if (!statsDetailConfig) return [];
    const { type, monthIndex } = statsDetailConfig;
    const yearNum = filterYear === 'all' ? new Date().getFullYear() : parseInt(filterYear);
    
    return baseTenants.filter(t => {
        if (type === 'upcoming') { let isFullyPaid = false; if (t.platform === 'En direct') isFullyPaid = !!t.soldeDate; else isFullyPaid = !!t.paymentDate; return !isFullyPaid; }
        const sDate = t.startDate || '';
        const [y, m] = sDate.split('-');
        if (type === 'month_current') return parseInt(y) === yearNum && parseInt(m)-1 === monthIndex;
        if (type === 'month_prev') return parseInt(y) === yearNum - 1 && parseInt(m)-1 === monthIndex;
        if (type === 'year_current') return parseInt(y) === yearNum;
        if (type === 'expenses') return parseInt(y) === yearNum && (t.resExpenses||[]).length > 0;
        return false;
    }).sort((a,b) => (a.startDate||"").localeCompare(b.startDate||""));
  }, [statsDetailConfig, baseTenants, filterYear]);
 
  const agendaDays = useMemo(() => {
    const y = filterYear === 'all' ? new Date().getFullYear() : parseInt(filterYear);
    const m = filterMonth === 'all' ? new Date().getMonth() : parseInt(filterMonth);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const firstDay = new Date(y, m, 1), lastDay = new Date(y, m + 1, 0);
    const offset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days = [];
    for (let i = offset - 1; i >= 0; i--) { const d = new Date(y, m, 0 - i); days.push({ day: d.getDate(), dateStr: fmt(d), otherMonth: true }); }
    for (let i = 1; i <= lastDay.getDate(); i++) days.push({ day: i, dateStr: `${y}-${(m+1).toString().padStart(2,'0')}-${i.toString().padStart(2,'0')}` });
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) { const d = new Date(y, m + 1, i); days.push({ day: d.getDate(), dateStr: fmt(d), otherMonth: true }); }
    return days;
  }, [filterYear, filterMonth]);
 
  const yearsAvailable = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    tenants.forEach(t => {
      if (t.startDate) years.add(parseInt(t.startDate.split('-')[0], 10));
      if (t.endDate) years.add(parseInt(t.endDate.split('-')[0], 10));
      if (t.soldeDate) years.add(parseInt(t.soldeDate.split('-')[0], 10));
      if (t.paymentDate) years.add(parseInt(t.paymentDate.split('-')[0], 10));
    });
    return Array.from(years).filter(y => !isNaN(y)).sort((a, b) => b - a).map(String);
  }, [tenants]);
 
  // 4. GESTION DU CARROUSEL NATIF ET SCROLL
  const handleScroll = () => {
    if (!scrollContainerRef.current || isScrollingRef.current) return;
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const width = scrollContainerRef.current.clientWidth;
    const newIndex = Math.round(scrollLeft / width);
 
    if (TABS_ORDER[newIndex] && TABS_ORDER[newIndex] !== activeTab) {
      setActiveTab(TABS_ORDER[newIndex]);
    }
  };
 
  const changeTab = (tabId) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
    const index = TABS_ORDER.indexOf(tabId);
    if (scrollContainerRef.current) {
      isScrollingRef.current = true;
      scrollContainerRef.current.scrollTo({
        left: index * scrollContainerRef.current.clientWidth,
        behavior: 'smooth'
      });
      setTimeout(() => { isScrollingRef.current = false; }, 600);
    }
  };
 
  const scrollToCurrentRes = (withFlash = false) => {
    if (reservationsList.length === 0) return;
    
    let targetRes = reservationsList.find(t => t.startDate >= todayStr || (t.endDate && t.endDate >= todayStr));
    if (!targetRes) targetRes = reservationsList[reservationsList.length - 1];
 
    if (targetRes) {
        const els = document.querySelectorAll(`[data-res-id="${targetRes.id}"]`);
        els.forEach(el => {
            const container = el.closest('.overflow-y-auto');
            if (container && window.getComputedStyle(el).display !== 'none') {
                const elTop = el.offsetTop;
                const containerHalf = container.clientHeight / 2;
                const elHalf = el.clientHeight / 2;
                
                container.scrollTo({ top: elTop - containerHalf + elHalf, behavior: 'smooth' });
 
                if (withFlash) {
                    const originalBg = el.style.backgroundColor;
                    el.style.backgroundColor = '#FEF9C3';
                    el.style.transition = 'background-color 0.8s ease';
                    setTimeout(() => { el.style.backgroundColor = originalBg; }, 2500);
                }
            }
        });
    }
  };
 
  useEffect(() => {
    if (!isUnlocked) return;
    if (activeTab !== 'reservations') { setHasScrolledToNext(false); return; }
    if (hasScrolledToNext || reservationsList.length === 0) return;
    const timer = setTimeout(() => { scrollToCurrentRes(false); setHasScrolledToNext(true); }, 500);
    return () => clearTimeout(timer);
  }, [activeTab, reservationsList, hasScrolledToNext, todayStr, isUnlocked]);
 
 
  // 5. FONCTIONS OUTILS ET LOGIQUE METIER
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
    let guestEmails = [];
 
    if (res.resExpenses && res.resExpenses.length > 0) {
       expensesText = '\n\nPrestations prévues :\n' + res.resExpenses.map(e => {
           const isDias = e.person && e.person.toLowerCase().includes('dias');
           
           if (e.sendEmail !== false && providerEmails[e.person] && !isDias) {
               guestEmails.push(providerEmails[e.person]);
           }
 
           if (isDias) {
               let diasDetails = `- ${e.type} (${e.person}) : ${e.amount}€`;
               if (e.hoursEntry > 0) diasDetails += `\n   ↳ Entrée le ${formatDateFr(e.dateEntry || res.startDate)} : ${e.hoursEntry}h (à ${e.rateEntry}€/h)`;
               if (e.hoursExit > 0) diasDetails += `\n   ↳ Sortie le ${formatDateFr(e.dateExit || res.endDate)} : ${e.hoursExit}h (à ${e.rateExit}€/h)`;
               return diasDetails;
           }
           return `- ${e.type} (${e.person}) : ${e.amount}€`;
       }).join('\n');
    }
    
    const phoneText = res.phone ? `\nContact : ${res.phone}` : '';
    const details = encodeURIComponent(`Client : ${res.name}${phoneText}\nLogement : ${prop?.name || ''}\nPlateforme : ${res.platform}\nNotes : ${res.comment || ''}${expensesText}`);
    
    const endDateObj = new Date(res.endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const formattedEnd = `${endDateObj.getFullYear()}${String(endDateObj.getMonth() + 1).padStart(2, '0')}${String(endDateObj.getDate()).padStart(2, '0')}`;
    const dates = `${res.startDate.replace(/-/g, '')}/${formattedEnd}`;
    
    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
    
    if (guestEmails.length > 0) {
        const uniqueEmails = [...new Set(guestEmails)];
        const emailsParam = uniqueEmails.map(email => `add=${encodeURIComponent(email)}`).join('&');
        url += `&${emailsParam}`;
    }
    
    return url;
  };
 
  const getProviderCalendarUrl = (exp, prop, type) => {
    const isEntry = type === 'ENTREE';
    const dateStr = isEntry ? exp.dateEntry : exp.dateExit;
    const timeStr = isEntry ? exp.timeEntry : exp.timeExit;
    const hours = isEntry ? parseFloat(exp.hoursEntry) || 0 : parseFloat(exp.hoursExit) || 0;
 
    if (!dateStr) return '#'; 
 
    const title = encodeURIComponent(`MENAGE ${prop?.name ? prop.name.toUpperCase() : ''} ${type}`);
    const details = encodeURIComponent((isEntry ? exp.providerNoteEntry : exp.providerNoteExit) || exp.providerNote || '');
 
    let dates = '';
    if (timeStr && hours > 0) {
        const [y, m, d] = dateStr.split('-');
        const [hh, mm] = timeStr.split(':');
        const startObj = new Date(y, m - 1, d, hh, mm);
        const endObj = new Date(startObj.getTime() + hours * 60 * 60 * 1000);
        
        const formatGCalDate = (dt) => {
            return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}00`;
        };
        dates = `${formatGCalDate(startObj)}/${formatGCalDate(endObj)}`;
    } else {
        const [y, m, d] = dateStr.split('-');
        const startObj = new Date(y, m - 1, d);
        const endObj = new Date(startObj);
        endObj.setDate(endObj.getDate() + 1);
        const formatGCalAllDay = (dt) => `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
        dates = `${formatGCalAllDay(startObj)}/${formatGCalAllDay(endObj)}`;
    }
 
    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
    
    if (providerEmails[exp.person]) {
        url += `&add=${encodeURIComponent(providerEmails[exp.person])}`;
    }
    return url;
  };
 
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
      resExpenses: (formData.resExpenses || []).map(r => ({ 
          ...r, 
          amount: parseFloat(r.amount) || 0,
          hoursEntry: parseFloat(r.hoursEntry) || 0,
          rateEntry: parseFloat(r.rateEntry) || 0,
          hoursExit: parseFloat(r.hoursExit) || 0,
          rateExit: parseFloat(r.rateExit) || 0,
          timeEntry: r.timeEntry || '09:30',
          timeExit: r.timeExit || '10:30',
          providerNoteEntry: r.providerNoteEntry || r.providerNote || '',
          providerNoteExit: r.providerNoteExit || r.providerNote || ''
      })) 
    };
    
    delete d.id;
 
    try {
      let savedId = editingResId;
      if (editingResId) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', editingResId), d);
      } else {
        const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), d);
        savedId = ref.id;
      }
      const prop = (properties || []).find(p => p.id === d.propertyId);
      if (prop?.calendarId && getAccessToken()) {
        try {
          if (editingResId && formData.googleEventId) {
            await updateCalendarEvent(prop.calendarId, formData.googleEventId, d, prop.name, providerEmails, prop.colorId || null);
          } else {
            const evt = await createCalendarEvent(prop.calendarId, d, prop.name, providerEmails, prop.colorId || null);
            if (evt?.id && savedId) {
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', savedId), { googleEventId: evt.id }, { merge: true });
            }
          }
        } catch (calErr) {
          if (calErr.message === 'TOKEN_EXPIRED') { setGoogleConnected(false); silentRenew(); }
        }
      }
      if (diasCalendarId && getAccessToken() && prop) {
        let updatedExpenses = [...(d.resExpenses || [])];
        let needsExpUpdate = false;
        for (const exp of (d.resExpenses || []).filter(x => x.person?.toLowerCase().includes('dias'))) {
          const diasEmail = providerEmails[exp.person] || null;
          try {
            if (exp.dateEntry && parseFloat(exp.hoursEntry) > 0) {
              if (exp.googleDiasEntryId) {
                await updateDiasEvent(diasCalendarId, exp.googleDiasEntryId, exp, prop.name, 'ENTREE', diasEmail, diasColorId);
              } else {
                const evt = await createDiasEvent(diasCalendarId, exp, prop.name, 'ENTREE', diasEmail, diasColorId);
                if (evt?.id) { updatedExpenses = updatedExpenses.map(x => x.id === exp.id ? { ...x, googleDiasEntryId: evt.id } : x); needsExpUpdate = true; }
              }
            }
            if (exp.dateExit && parseFloat(exp.hoursExit) > 0) {
              if (exp.googleDiasExitId) {
                await updateDiasEvent(diasCalendarId, exp.googleDiasExitId, exp, prop.name, 'SORTIE', diasEmail, diasColorId);
              } else {
                const evt = await createDiasEvent(diasCalendarId, exp, prop.name, 'SORTIE', diasEmail, diasColorId);
                if (evt?.id) { updatedExpenses = updatedExpenses.map(x => x.id === exp.id ? { ...x, googleDiasExitId: evt.id } : x); needsExpUpdate = true; }
              }
            }
          } catch (diasErr) { if (diasErr.message === 'TOKEN_EXPIRED') { setGoogleConnected(false); silentRenew(); } }
        }
        if (needsExpUpdate && savedId) {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', savedId), { resExpenses: updatedExpenses }, { merge: true });
        }
      }
      setIsModalOpen(false);
    } catch (error) { alert("Erreur technique : " + error.message); }
  };
 
  const deleteRes = async (id) => {
    if (window.confirm("Supprimer définitivement ?")) {
      const tenant = (tenants || []).find(t => t.id === id);
      if (tenant?.googleEventId) {
        const prop = (properties || []).find(p => p.id === tenant.propertyId);
        if (prop?.calendarId && getAccessToken()) {
          try { await deleteCalendarEvent(prop.calendarId, tenant.googleEventId); } catch (e) {}
        }
      }
      if (diasCalendarId && getAccessToken()) {
        for (const exp of (tenant?.resExpenses || []).filter(x => x.person?.toLowerCase().includes('dias'))) {
          if (exp.googleDiasEntryId) try { await deleteDiasEvent(diasCalendarId, exp.googleDiasEntryId); } catch (e) {}
          if (exp.googleDiasExitId) try { await deleteDiasEvent(diasCalendarId, exp.googleDiasExitId); } catch (e) {}
        }
      }
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', id));
      setIsModalOpen(false);
    }
  };
 
  const handleQuickPayToggle = async (e, tenant, type, expId = null) => {
    e.stopPropagation(); e.preventDefault();
    if (!user || user.uid === 'local-test-user') return;
 
    if (type === 'global' && tenant.platform === 'En direct') {
        openReservation(tenant); return;
    }
 
    let isPaid = false;
    if (type === 'global') isPaid = !!tenant.paymentDate;
    if (type === 'expense') { const exp = (tenant.resExpenses || []).find(x => x.id === expId); isPaid = !!(exp && exp.paymentDate); }
 
    if (isPaid) {
      if (window.confirm("Annuler ce paiement ?")) {
        try {
          if (type === 'global') { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', tenant.id), { paymentDate: '' }, { merge: true }); } 
          else {
            const newExpenses = tenant.resExpenses.map(exp => exp.id === expId ? { ...exp, paymentDate: '' } : exp);
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', tenant.id), { resExpenses: newExpenses }, { merge: true });
          }
        } catch (err) {}
      }
    } else { setQuickPayConfig({ tenant, type, expId, date: new Date().toISOString().split('T')[0] }); }
  };
 
  const submitQuickPay = async () => {
    if (!quickPayConfig || !quickPayConfig.date) return;
    try {
      if (quickPayConfig.type === 'global') { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', quickPayConfig.tenant.id), { paymentDate: quickPayConfig.date }, { merge: true }); } 
      else {
        const newExpenses = quickPayConfig.tenant.resExpenses.map(exp => exp.id === quickPayConfig.expId ? { ...exp, paymentDate: quickPayConfig.date } : exp);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', quickPayConfig.tenant.id), { resExpenses: newExpenses }, { merge: true });
      }
      setQuickPayConfig(null);
    } catch (err) {}
  };
 
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
 
  const getPropertyColor = (propertyId) => {
    const prop = (properties || []).find(p => p.id === propertyId);
    if (!prop?.name) return '#94A3B8';
    const name = prop.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (name.includes('cocon') || name.includes('kadelia')) return '#10B981';
    if (name.includes('signes') || name.includes('cadelio')) return '#3B82F6';
    if (name.includes('villa') || name.includes('cadelia')) return '#EAB308';
    return '#94A3B8';
  };

  const getRowColors = (propertyId) => {
    const prop = (properties || []).find(p => p.id === propertyId);
    if (!prop || !prop.name) return { bg: 'bg-white', hover: 'hover:bg-slate-50' };
    const name = prop.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (name.includes('cocon') || name.includes('kadelia')) return { bg: 'bg-emerald-200', hover: 'hover:bg-emerald-300' };
    if (name.includes('signes') || name.includes('cadelio')) return { bg: 'bg-blue-200', hover: 'hover:bg-blue-300' };
    if (name.includes('villa') || name.includes('cadelia')) return { bg: 'bg-yellow-200', hover: 'hover:bg-yellow-300' };
    return { bg: 'bg-white', hover: 'hover:bg-slate-50' };
  };
 
  const getStatusProps = (t) => {
    if (t.platform === 'En direct') {
        if (t.soldeDate) return { label: 'Payé', color: 'bg-emerald-100 text-emerald-700' };
        if (t.acompte1Date || t.acompte2Date) return { label: 'Incomplet', color: 'bg-blue-100 text-blue-700' };
        return { label: 'Attente', color: 'bg-orange-100 text-orange-700' };
    }
    return t.paymentDate ? { label: 'Payé', color: 'bg-emerald-100 text-emerald-700' } : { label: 'Attente', color: 'bg-orange-100 text-orange-700' };
  };
 
  const handleMonthChange = (direction) => {
    let m = filterMonth === 'all' ? new Date().getMonth() : parseInt(filterMonth);
    let y = filterYear === 'all' ? new Date().getFullYear() : parseInt(filterYear);
    if (direction === 'next') { if (m === 11) { m = 0; y += 1; } else m += 1; }
    else { if (m === 0) { m = 11; y -= 1; } else m -= 1; }
    setFilterMonth(m.toString()); setFilterYear(y.toString());
  };
 
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
            dispAmount = gross; net = gross - fees;
        } 
        else if (importSource === 'Booking') {
            const typeCol = parts[0]?.toLowerCase() || '';
            if (!typeCol.includes('rã©servation') && !typeCol.includes('réservation') && !typeCol.includes('reservation')) return;
 
            guestName = voyageurIdx !== -1 && parts[voyageurIdx] ? parts[voyageurIdx].trim() : `Réf: ${parts[2]?.trim()}`; 
            startDate = parts[3]?.trim(); endDate = parts[4]?.trim(); listingName = parts[10]?.trim();
            if (!startDate || !endDate) return;
 
            dispAmount = parseFloat(parts[15]?.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
            cityTax = Math.abs(parseFloat(parts[16]?.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0);
            fees = Math.abs(parseFloat(parts[17]?.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0);
            bankFees = Math.abs(parseFloat(parts[19]?.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0);
 
            gross = dispAmount - cityTax; net = gross - fees - bankFees;
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
 
  // --- ECRAN DE VERROUILLAGE ---
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === 'Cadel2026') { 
      localStorage.setItem('cadel_unlocked', 'true');
      setIsUnlocked(true);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };
 
  const RenderFilters = () => (
    <div className="sticky top-0 z-30 bg-[#F8FAFC]/95 backdrop-blur-md pt-2 pb-4 mb-2 px-2 md:px-0">
      <div className="flex flex-wrap items-center gap-2 bg-white/80 p-3 rounded-[28px] border border-white shadow-lg mx-auto max-w-7xl">
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
    </div>
  );
 
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
        <div className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col items-center text-center animate-in zoom-in-95 relative z-10">
          <div className="bg-slate-50 p-4 rounded-3xl mb-6 shadow-inner border border-slate-100"><Key size={48} className="text-blue-600" /></div>
          <h1 className="font-black text-2xl uppercase tracking-tighter text-slate-900 mb-1">Cadel Manager</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-8 font-bold">Espace Sécurisé</p>
          <form onSubmit={handlePinSubmit} className="w-full flex flex-col gap-4">
            <div>
              <input type="password" value={pinInput} onChange={(e) => { setPinInput(e.target.value); setPinError(false); }} placeholder="Votre mot de passe" className={`w-full p-4 bg-slate-50 border rounded-2xl font-black text-center text-lg tracking-widest outline-none transition-all ${pinError ? 'border-rose-500 bg-rose-50/50 text-rose-500 placeholder-rose-300' : 'border-slate-200 focus:border-blue-500 focus:bg-white focus:shadow-md'}`} autoFocus />
              {pinError && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest mt-2 animate-pulse">Mot de passe incorrect</p>}
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase text-sm shadow-xl shadow-blue-200 hover:bg-indigo-600 transition-all hover:-translate-y-0.5 active:translate-y-0">Déverrouiller</button>
          </form>
        </div>
      </div>
    );
  }
 
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-black uppercase text-xs"><Loader2 className="animate-spin text-blue-600 mr-2" /> CADEL MANAGER...</div>;
 
  const curChargesModale = (formData?.resExpenses || []).reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const isDirectFormModale = formData?.platform === 'En direct';
  const isCplxFormModale = formData?.platform === 'Booking' || formData?.platform === 'Abritel';
  const nModale = isDirectFormModale ? (parseFloat(formData?.grossAmount) || 0) : isCplxFormModale ? (parseFloat(formData?.displayedAmount || 0) - parseFloat(formData?.cityTax || 0)) - (parseFloat(formData?.platformFees || 0) + parseFloat(formData?.bankFees || 0)) : (parseFloat(formData?.grossAmount || 0) - parseFloat(formData?.platformFees || 0));
 
  // --- RENDU PRINCIPAL DE L'APPLICATION ---
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900">
      
      <style>{`
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .snap-always { scroll-snap-stop: always; }
      `}</style>
 
      <aside className={`fixed md:sticky top-0 left-0 z-50 w-72 h-[100dvh] bg-white border-r transform md:translate-x-0 transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 border-b flex flex-col items-center relative">
          <img src="/icon.svg" alt="Cadel Manager Logo" className="w-24 h-24 rounded-3xl shadow-xl mb-2 object-contain" />
          <button onClick={() => { localStorage.removeItem('cadel_unlocked'); setIsUnlocked(false); }} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-slate-900 transition-colors" title="Verrouiller l'application"><Lock size={16} /></button>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {[{ id: 'reservations', label: 'Réservations', icon: <List size={18}/> }, { id: 'agenda', label: 'Agenda', icon: <CalendarRange size={18}/> }, { id: 'statistiques', label: 'Statistiques', icon: <BarChart2 size={18}/> }, { id: 'finances', label: 'Finances', icon: <Calculator size={18}/> }, { id: 'settings', label: 'Paramètres', icon: <Settings size={18}/> }].map(item => (
            <button key={item.id} onClick={() => changeTab(item.id)} className={`w-full text-left px-5 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-2xl' : 'text-slate-400 hover:bg-slate-50'}`}>{item.icon} {item.label}</button>
          ))}
        </nav>
      </aside>
 
      <div className="md:hidden flex justify-between p-5 bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="Logo" className="w-10 h-10 rounded-[12px] shadow-sm object-contain" />
            <h1 className="font-black text-sm uppercase">CADEL MANAGER</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">{isMobileMenuOpen ? <X /> : <Menu />}</button>
      </div>
 
      <main className="flex-1 w-full min-w-0 min-h-screen relative flex flex-col overflow-x-hidden">
        
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
 
        {statsDetailConfig && (
           <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-[#F8FAFC] rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-100 overflow-hidden relative">
                 <div className="p-6 md:p-8 border-b flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3 text-blue-600 font-black uppercase tracking-tighter text-xl"><Search size={24} /> {statsDetailConfig.title}</div>
                    <button onClick={() => setStatsDetailConfig(null)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all"><X size={20}/></button>
                 </div>
                 <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {statsDetailList.length === 0 ? (
                       <div className="text-center text-slate-400 font-black uppercase text-xs py-10 opacity-60">Aucune réservation trouvée pour ce critère</div>
                    ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {statsDetailList.map(t => (
                              <div key={t.id} onClick={() => openReservation(t)} className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-lg cursor-pointer transition-all group hover:scale-[1.02]">
                                  <div className="flex justify-between items-start mb-2">
                                      <div><h4 className="font-black uppercase text-sm group-hover:text-blue-600 transition-colors">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}</h4><p className="text-[10px] text-slate-400 font-bold mt-0.5">{t.platform} • {t.name}</p></div>
                                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase inline-block ${getStatusProps(t).color}`}>{getStatusProps(t).label}</span>
                                  </div>
                                  <div className="bg-slate-50 p-2.5 rounded-xl flex justify-between font-black text-[10px] items-center mb-2 text-slate-500"><span>{formatDateFr(t.startDate)}</span><ArrowRight size={12} className="text-slate-300"/><span>{formatDateFr(t.endDate)}</span></div>
                                  <div className="flex justify-between items-end mt-4 border-t border-slate-50 pt-3"><div className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Net estimé</div><div className="font-black text-lg text-slate-800">{(parseFloat(t.netAmount) || 0).toFixed(2)}€</div></div>
                              </div>
                          ))}
                       </div>
                    )}
                 </div>
              </div>
           </div>
        )}
 
        <RenderFilters />
        
        <div 
          ref={scrollContainerRef} 
          onScroll={handleScroll} 
          className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory hide-scroll"
        >
 
          {/* 1. ONGLETS RESERVATIONS */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border">
            <div className="max-w-7xl mx-auto pb-32">
                {!googleConnected && (properties || []).some(p => p.calendarId) && (
                  <div className="mx-2 md:mx-0 mb-4 bg-orange-50 border border-orange-200 text-orange-700 rounded-[16px] px-4 py-3 text-xs font-black uppercase tracking-wide flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="flex-shrink-0" />
                      Google Agenda déconnecté — les réservations ne seront pas synchronisées.
                    </div>
                    <button onClick={signInGoogle} className="bg-orange-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap hover:bg-orange-700 transition-colors flex-shrink-0">
                      Reconnecter
                    </button>
                  </div>
                )}
                <div className="flex justify-between items-center mx-2 md:mx-0 mb-6">
                   <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Réservations</h2>
                   <div className="flex items-center gap-2 md:gap-4">
                      <button onClick={() => scrollToCurrentRes(true)} className="p-3 md:px-4 md:py-3 bg-white text-blue-600 rounded-full md:rounded-[20px] shadow-lg border border-slate-100 hover:bg-blue-50 transition-all flex items-center justify-center gap-2" title="Aller à aujourd'hui">
                         <LocateFixed size={18} /><span className="hidden md:inline font-black text-[10px] uppercase">Aujourd'hui</span>
                      </button>
                      <button onClick={() => { setEditingResId(null); setFormData({ propertyId: properties[0]?.id || '', name: '', phone: '', startDate: '', endDate: '', paymentDate: '', platform: availablePlatforms[0] || 'Airbnb', isUrssaf: true, displayedAmount: '', cityTax: '', bankFees: '', grossAmount: '', platformFees: '', deposit: '', resExpenses: [], comment: '', acompte1Amount: '', acompte1Date: '', acompte2Amount: '', acompte2Date: '', soldeAmount: '', soldeDate: '' }); setIsModalOpen(true); }} className="bg-blue-600 text-white px-6 py-3 md:px-8 md:py-4 rounded-[20px] md:rounded-[24px] font-black text-[11px] shadow-xl hover:bg-blue-700 transition-all">+ Nouvelle</button>
                   </div>
                </div>
                
                <div className="md:hidden max-h-[70vh] overflow-y-auto custom-scrollbar p-1 rounded-[20px] border border-slate-100 bg-slate-50/50 shadow-inner mx-2 relative">
                  <div className="grid grid-cols-1 gap-2.5">
                    {(groupedReservationsList || []).map(item => {
                      if (item.isSeparator) return (<div key={item.id} className="flex items-center justify-center mt-2 mb-0.5"><span className="bg-slate-800 text-white px-4 py-1.5 rounded-[10px] text-[8px] font-black uppercase tracking-[0.2em] shadow-sm">{item.label}</span></div>);
                      
                      const t = item;
                      const colors = getRowColors(t.propertyId);
                      return (
                      <div key={t.id} data-res-id={t.id} onClick={() => openReservation(t)} className={`${colors.bg} p-3 rounded-[16px] shadow-sm border border-slate-50 cursor-pointer transition-colors`}>
                        <div className="flex justify-between items-start mb-1.5">
                          <div>
                            <h3 className="text-sm font-black uppercase leading-tight">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}</h3>
                            <div className="flex items-center gap-1.5 mt-1 leading-tight"><span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{t.platform}</span><span className="text-[11px] font-black text-slate-700">{t.name}</span></div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span onClick={(e) => handleQuickPayToggle(e, t, 'global')} className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase cursor-pointer hover:scale-105 transition-transform inline-block ${getStatusProps(t).color}`}>{getStatusProps(t).label}</span>
                            {t.paymentDate && t.platform !== 'En direct' && <span className="text-[7px] text-slate-400 font-bold">{formatDateFr(t.paymentDate)}</span>}
                            {t.platform === 'En direct' && t.soldeDate && <span className="text-[7px] text-slate-400 font-bold">{formatDateFr(t.soldeDate)}</span>}
                          </div>
                        </div>
                        
                        <div className="bg-white/60 p-2 rounded-[12px] flex justify-between font-black text-[9px] mb-1.5 items-center"><span>{formatDateFr(t.startDate)}</span><ArrowRight size={10} className="text-slate-300"/><span>{formatDateFr(t.endDate)}</span></div>
                        
                        {t.comment && (<div className="text-[9px] italic text-slate-600 mb-1.5 px-1 leading-tight whitespace-pre-wrap">📝 {t.comment}</div>)}
 
                        {t.resExpenses && t.resExpenses.length > 0 && (
                          <div className="space-y-1 border-t border-slate-100 pt-1.5 mb-1.5">
                            {(t.resExpenses || []).map((exp, idx) => (
                              <div key={idx} onClick={(e) => handleQuickPayToggle(e, t, 'expense', exp.id)} className="flex items-center justify-between text-[8px] bg-white/60 p-1.5 rounded-xl cursor-pointer hover:bg-white transition-colors leading-tight">
                                <span className="uppercase font-black text-slate-500 min-w-0 truncate pr-2 flex items-center gap-1">{exp.type} ({exp.person}) {exp.person.toLowerCase().includes('dias') ? (<>{getStatusIcon(exp.googleDiasEntryId, exp.googleDiasEntryStatus, 14)}{getStatusIcon(exp.googleDiasExitId, exp.googleDiasExitStatus, 14)}</>) : (exp.sendEmail !== false && providerEmails[exp.person] && getStatusIcon(t.googleEventId, t.googleEventStatus, 14))}</span>
                                <div className="text-right flex-shrink-0">
                                  <span className={`font-black flex items-center justify-end gap-1 ${exp.paymentDate ? 'text-emerald-600' : 'text-orange-500'}`}>{exp.amount}€ {exp.paymentDate ? <CheckCircle size={8}/> : <Clock size={8}/>}</span>
                                  {exp.paymentDate && <div className="text-[7px] text-slate-400 mt-0.5">{formatDateFr(exp.paymentDate)}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-right font-black text-sm">{(parseFloat(t.netAmount) || 0).toFixed(2)}€</div>
                      </div>
                    )})}
                  </div>
                </div>
 
                <div className="hidden md:block bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100">
                  <div className="max-h-[70vh] overflow-y-auto custom-scrollbar relative">
                      <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 font-black uppercase border-b text-slate-400 sticky top-0 z-20 shadow-sm">
                          <tr><th className="p-4 w-[15%]">Logement</th><th className="p-4 w-[15%]">Client</th><th className="p-4 w-[12%] text-center">Dates</th><th className="p-4 w-[25%]">Notes</th><th className="p-4 w-[18%]">Prestations</th><th className="p-4 text-right">Net</th><th className="p-4 text-center">État</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-bold">
                          {(groupedReservationsList || []).map(item => {
                          if (item.isSeparator) return (<tr key={item.id} className="bg-slate-100/50"><td colSpan="7" className="p-3 text-center"><span className="bg-slate-800 text-white px-5 py-2 rounded-[14px] text-[10px] font-black uppercase tracking-[0.2em] shadow-md inline-block">{item.label}</span></td></tr>);
 
                          const t = item;
                          const colors = getRowColors(t.propertyId);
                          
                          return (
                          <tr key={t.id} data-res-id={t.id} onClick={() => openReservation(t)} className={`${colors.bg} ${colors.hover} cursor-pointer transition-colors`}>
                              <td className="p-4 uppercase"><div className="font-black">{(properties || []).find(p => p.id === t.propertyId)?.name || '--'}</div><div className="text-blue-600 text-xs font-black tracking-widest mt-0.5">{t.platform}</div></td>

                              <td className="p-4"><div className="text-sm font-black">{t.name}</div>{t.phone && <div className="text-slate-400 text-[10px] mt-0.5">{t.phone}</div>}</td>
                              <td className="p-4 text-center text-slate-500 whitespace-nowrap">{formatDateFr(t.startDate)} <ArrowRight size={10} className="inline text-slate-300" /> {formatDateFr(t.endDate)}</td>
                              <td className="p-4 text-[11px] text-slate-600 font-medium">{t.comment ? (<div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100/50 italic whitespace-pre-wrap" title={t.comment}>📝 {t.comment}</div>) : ''}</td>
                              <td className="p-4">
                              <div className="space-y-1.5">
                                  {(t.resExpenses || []).map((exp, idx) => (
                                      <div key={idx} onClick={(e) => handleQuickPayToggle(e, t, 'expense', exp.id)} className="flex items-center justify-between text-[10px] bg-white/50 p-1.5 rounded-lg border border-slate-100/50 cursor-pointer hover:border-blue-300 hover:bg-white hover:shadow-sm transition-all">
                                      <span className="uppercase font-black text-slate-500 leading-none flex items-center gap-1">{exp.type} ({exp.person}) {exp.person.toLowerCase().includes('dias') ? (<>{getStatusIcon(exp.googleDiasEntryId, exp.googleDiasEntryStatus, 14)}{getStatusIcon(exp.googleDiasExitId, exp.googleDiasExitStatus, 14)}</>) : (exp.sendEmail !== false && providerEmails[exp.person] && getStatusIcon(t.googleEventId, t.googleEventStatus, 14))}</span>
                                      <div className="text-right">
                                          <div className="flex items-center justify-end gap-1.5"><span className={`font-black ${exp.paymentDate ? 'text-emerald-600' : 'text-orange-500'}`}>{exp.amount}€</span>{exp.paymentDate ? <CheckCircle size={10} className="text-emerald-500" /> : <Clock size={10} className="text-orange-400" />}</div>
                                          {exp.paymentDate && <div className="text-[8px] text-slate-400 mt-0.5 leading-none">{formatDateFr(exp.paymentDate)}</div>}
                                      </div>
                                      </div>
                                  ))}
                              </div>
                              </td>
                              <td className="p-4 text-right font-black">{(parseFloat(t.netAmount) || 0).toFixed(2)}€</td>
                              <td className="p-4 text-center">
                              <div className="flex flex-col items-center">
                                  <span onClick={(e) => handleQuickPayToggle(e, t, 'global')} className={`px-4 py-2 rounded-full text-[9px] uppercase cursor-pointer hover:scale-105 transition-transform inline-block ${getStatusProps(t).color}`}>{getStatusProps(t).label}</span>
                                  {t.platform !== 'En direct' && t.paymentDate && <span className="text-[8px] text-slate-400 mt-1 font-bold">{formatDateFr(t.paymentDate)}</span>}
                                  {t.platform === 'En direct' && t.soldeDate && <span className="text-[8px] text-slate-400 mt-1 font-bold">{formatDateFr(t.soldeDate)}</span>}
                              </div>
                              </td>
                          </tr>
                          )})}
                      </tbody>
                      </table>
                  </div>
              </div>
            </div>
          </div>
 
          {/* 2. ONGLET AGENDA */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border">
            <div className="max-w-7xl mx-auto pb-32">
              <div className="flex justify-between items-center mx-2 md:mx-0 mb-6"><div><h2 className="text-2xl md:text-3xl font-black uppercase">Agenda</h2></div><div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl shadow-lg"><button onClick={()=>handleMonthChange('prev')}><ChevronLeft/></button><div className="text-center font-black min-w-[120px] uppercase text-xs">{['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][filterMonth==='all'?new Date().getMonth():parseInt(filterMonth)]}</div><button onClick={()=>handleMonthChange('next')}><ChevronRight/></button></div></div>
              <div className="bg-white p-4 md:p-6 rounded-[32px] md:rounded-[40px] shadow-2xl overflow-x-auto mx-2 md:mx-0">
                <div className="min-w-[320px] md:min-w-[700px]">
                  <div className="grid grid-cols-7 text-center font-black text-slate-300 text-[8px] md:text-[10px] uppercase mb-2 md:mb-4">
                    {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => <div key={d}>{d}</div>)}
                  </div>
                  {Array.from({ length: Math.ceil((agendaDays||[]).length / 7) }, (_, wi) => {
                    const week = (agendaDays||[]).slice(wi*7, wi*7+7);
                    const weekStart = week[0]?.dateStr;
                    const weekEnd = week[6]?.dateStr;
                    const weekRes = (reservationsList||[])
                      .filter(r => r.startDate <= weekEnd && r.endDate >= weekStart)
                      .map(r => {
                        const si = week.findIndex(d => d.dateStr === r.startDate);
                        const ei = week.findIndex(d => d.dateStr === r.endDate);
                        const startCol = r.startDate <= weekStart ? 1 : (si === -1 ? 1 : si + 1);
                        const endCol   = r.endDate   >= weekEnd   ? 7 : (ei === -1 ? 7 : ei + 1);
                        return { ...r, startCol, endCol };
                      })
                      .sort((a,b) => a.startCol - b.startCol);
                    const rowEnds = [];
                    const bars = weekRes.map(bar => {
                      let row = 0;
                      while (rowEnds[row] !== undefined && rowEnds[row] >= bar.startCol) row++;
                      rowEnds[row] = bar.endCol;
                      return { ...bar, row: row + 1 };
                    });
                    const nRows = bars.length ? Math.max(...bars.map(b => b.row)) : 0;
                    return (
                      <div key={wi} className="mb-1 md:mb-2">
                        <div className="grid grid-cols-7 gap-1 md:gap-2">
                          {week.map((item, di) => {
                            const isOther = !!item.otherMonth;
                            const isToday = item.dateStr === todayStr;
                            return (
                              <div key={item.dateStr||di} className={`h-7 md:h-9 border rounded-lg md:rounded-xl px-1 flex items-center ${isToday ? 'border-blue-400 bg-blue-50/20' : isOther ? 'border-slate-100 bg-slate-50/70' : 'border-slate-100 bg-white'}`}>
                                <span className={`text-[8px] md:text-[10px] font-black ${isToday ? 'text-blue-500' : isOther ? 'text-slate-300' : 'text-slate-400'}`}>{item.day}</span>
                              </div>
                            );
                          })}
                        </div>
                        {nRows > 0 && (
                          <div className="grid grid-cols-7 gap-x-1 md:gap-x-2 mt-0.5" style={{gridTemplateRows:`repeat(${nRows},auto)`}}>
                            {bars.map(bar => (
                              <div
                                key={bar.id}
                                onClick={e=>{e.stopPropagation();openReservation(bar)}}
                                className="text-white text-[6px] md:text-[9px] font-black px-1 md:px-2 py-0.5 md:py-1 rounded-md truncate cursor-pointer mb-0.5"
                                style={{gridColumn:`${bar.startCol}/${bar.endCol+1}`,gridRow:bar.row,backgroundColor:getPropertyColor(bar.propertyId)}}
                              >
                                {bar.name?.split(' ')[0]||'Résa'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
 
          {/* 3. ONGLET STATISTIQUES */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border">
             <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mx-2 md:mx-0 mb-6">
                   <div><h2 className="text-3xl md:text-4xl font-black uppercase text-slate-900 tracking-tighter leading-none mb-2">Statistiques</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tableau de bord interactif</p></div>
                </div>
                <Statistiques tenants={tenants} properties={properties} availablePlatforms={availablePlatforms}/>
             </div>
          </div>
 
          {/* 4. ONGLET FINANCES */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border">
             <div className="max-w-7xl mx-auto pb-32 space-y-10">
              <h2 className="text-3xl font-black uppercase mx-2 md:mx-0">Comptabilité</h2>
              <div className="bg-white rounded-[24px] md:rounded-[40px] shadow-2xl overflow-hidden text-xs border border-slate-100 mx-2 md:mx-0">
                <div className="p-3 md:p-8 bg-slate-900 text-white font-black uppercase flex justify-between items-center text-[10px] md:text-xs"><div>Bilan Global</div></div>
                <div className="max-h-[60vh] overflow-y-auto overflow-x-auto custom-scrollbar relative">
                  <table className="w-full text-left min-w-[280px] md:min-w-[700px]">
                    <thead className="bg-slate-50 uppercase text-slate-400 border-b sticky top-0 z-10 shadow-sm text-[6px] md:text-xs tracking-tighter md:tracking-normal">
                      <tr><th className="p-1 md:p-6">Période</th><th className="p-1 md:p-6 text-right">Brut URSSAF</th><th className="p-1 md:p-6 text-right text-emerald-600">Direct (hors URSSAF)</th><th className="p-1 md:p-6 text-right text-indigo-600">Virement</th><th className="p-1 md:p-6 text-right text-slate-500">Prest.</th><th className="p-1 md:p-6 text-right text-rose-500">Cotis.</th><th className="p-1 md:p-6 text-right font-black">Profit</th></tr>
                    </thead>
                    <tbody className="divide-y font-bold">
                      {(monthlyRecapData || []).map(([m, d]) => (
                        <tr key={m} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="p-1 md:p-6 capitalize text-[8px] md:text-sm leading-tight tracking-tighter md:tracking-normal">{formatMonthYear(m)}</td>
                          <td className="p-1 md:p-6 text-right text-slate-500"><div className="text-[8px] md:text-sm leading-tight tracking-tighter md:tracking-normal">{d.urssafGross.toLocaleString('fr-FR')}€</div></td>
                          <td className="p-1 md:p-6 text-right text-emerald-600 font-black text-[8px] md:text-sm leading-tight tracking-tighter md:tracking-normal">{d.directNet > 0 ? `${d.directNet.toLocaleString('fr-FR')}€` : '-'}</td>
                          <td className="p-1 md:p-6 text-right text-indigo-600 font-black text-[8px] md:text-sm leading-tight tracking-tighter md:tracking-normal">{d.totalBank.toLocaleString('fr-FR')}€</td>
                          <td className="p-1 md:p-6 text-right text-slate-500 text-[8px] md:text-sm leading-tight tracking-tighter md:tracking-normal">-{d.charges.toLocaleString('fr-FR')}€</td>
                          <td className="p-1 md:p-6 text-right text-rose-500 text-[8px] md:text-sm leading-tight tracking-tighter md:tracking-normal">-{d.taxes.toFixed(2)}€</td>
                          <td className={`p-1 md:p-6 text-right font-black text-[8px] md:text-sm leading-tight tracking-tighter md:tracking-normal ${d.totalBank - d.taxes - d.charges >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{(d.totalBank - d.taxes - d.charges).toLocaleString('fr-FR')}€</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-indigo-600 text-white font-black text-[10px] md:text-lg sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                      <tr>
                        <td className="p-1.5 md:p-8 uppercase text-[6px] md:text-[10px] leading-tight tracking-tighter md:tracking-normal">TOTAL</td>
                        <td className="p-1.5 md:p-8 text-right opacity-90"><div className="leading-tight text-[8px] md:text-lg tracking-tighter md:tracking-normal">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.urssafGross, 0).toLocaleString('fr-FR')}€</div></td>
                        <td className="p-1.5 md:p-8 text-right text-emerald-300 leading-tight text-[8px] md:text-lg tracking-tighter md:tracking-normal">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.directNet, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-1.5 md:p-8 text-right leading-tight text-[8px] md:text-lg tracking-tighter md:tracking-normal">{monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-1.5 md:p-8 text-right text-indigo-200 leading-tight text-[8px] md:text-lg tracking-tighter md:tracking-normal">-{monthlyRecapData.reduce((acc, [m, d]) => acc + d.charges, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-1.5 md:p-8 text-right text-rose-300 leading-tight text-[8px] md:text-lg tracking-tighter md:tracking-normal">-{monthlyRecapData.reduce((acc, [m, d]) => acc + d.taxes, 0).toLocaleString('fr-FR')}€</td>
                        <td className="p-1.5 md:p-8 text-right bg-indigo-700/50 leading-tight text-[8px] md:text-lg tracking-tighter md:tracking-normal">{(monthlyRecapData.reduce((acc, [m, d]) => acc + d.totalBank, 0) - monthlyRecapData.reduce((acc, [m, d]) => acc + d.taxes + d.charges, 0)).toLocaleString('fr-FR')}€</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
 
              <div className="bg-white rounded-[24px] md:rounded-[40px] shadow-2xl overflow-hidden text-xs border border-slate-100 mx-2 md:mx-0">
                <div className="p-3 md:p-8 bg-slate-900 text-white font-black uppercase flex justify-between text-[10px] md:text-xs">Suivi Prestataires</div>
                <div className="max-h-[60vh] overflow-y-auto overflow-x-auto custom-scrollbar relative">
                    <table className="w-full text-left min-w-[280px] md:min-w-[700px]">
                        <thead className="bg-slate-50 uppercase text-slate-400 border-b sticky top-0 z-10 shadow-sm text-[6px] md:text-xs tracking-tighter md:tracking-normal">
                            <tr><th className="p-1 md:p-6">Date</th><th className="p-1 md:p-6">Logement</th><th className="p-1 md:p-6">Prestataire</th><th className="p-1 md:p-6 text-right">Montant</th><th className="p-1 md:p-6 text-center">Statut</th></tr>
                        </thead>
                        <tbody className="divide-y font-bold">
                            {(detailedExpenses || []).map((exp) => (
                                <tr key={exp.id}>
                                    <td className="p-1 md:p-6 text-[8px] md:text-sm tracking-tighter md:tracking-normal">{formatDateFr(exp.dateRes)}</td>
                                    <td className="p-1 md:p-6 uppercase text-[8px] md:text-xs tracking-tighter md:tracking-normal">{exp.propertyName}</td>
                                    <td className="p-1 md:p-6 text-blue-600 uppercase text-[8px] md:text-xs tracking-tighter md:tracking-normal">{exp.person}</td>
                                    <td className="p-1 md:p-6 text-right text-[8px] md:text-sm tracking-tighter md:tracking-normal">{(exp.amount || 0).toLocaleString('fr-FR')}€</td>
                                    <td className="p-1 md:p-6 text-center"><span className={`px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[6px] md:text-[9px] font-black uppercase tracking-tighter md:tracking-normal ${exp.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{exp.paymentDate ? 'Payé' : 'Attente'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>
          </div>
 
          {/* 5. ONGLET SETTINGS */}
          <div className="flex-none w-full max-w-full snap-center snap-always px-0 md:px-12 py-6 md:py-12 box-border">
            <div className="max-w-7xl mx-auto pb-32 space-y-10">
              <h2 className="text-3xl font-black uppercase mx-2 md:mx-0">Paramètres</h2>
              <div className="bg-white p-8 rounded-[40px] border-2 border-dashed shadow-xl flex flex-col items-center justify-center text-center mx-2 md:mx-0">
                <UploadCloud size={40} className="text-blue-600 mb-4"/>
                <h3 className="text-xl font-black uppercase">Importation de Réservations (CSV)</h3>
                <p className="text-xs text-slate-400 mt-2 mb-6">Sélectionnez la plateforme source et collez votre export CSV.</p>
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl shadow-inner border border-slate-100">
                  <label className={`flex-1 py-3 px-6 rounded-xl font-black uppercase text-[10px] cursor-pointer transition-all ${importSource === 'Airbnb' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}><input type="radio" value="Airbnb" checked={importSource === 'Airbnb'} onChange={e => setImportSource(e.target.value)} className="hidden" /> Airbnb</label>
                  <label className={`flex-1 py-3 px-6 rounded-xl font-black uppercase text-[10px] cursor-pointer transition-all ${importSource === 'Booking' ? 'bg-blue-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}><input type="radio" value="Booking" checked={importSource === 'Booking'} onChange={e => setImportSource(e.target.value)} className="hidden" /> Booking</label>
                </div>
                <textarea value={importText} onChange={(e)=>setImportText(e.target.value)} placeholder={`Collez les lignes de votre export ${importSource} ici...`} className="w-full mt-6 p-4 bg-slate-50 border rounded-3xl min-h-[150px] font-mono text-[10px] outline-none" />
                {importStatus && <p className="mt-4 font-black text-emerald-600 uppercase">{importStatus}</p>}
                
                {(reviewList || []).length > 0 && (
                  <div className="w-full mt-6 overflow-x-auto no-swipe">
                    <table className="w-full text-left text-[8px] md:text-[10px] font-bold border-collapse">
                      <thead className="bg-slate-50 border-b text-slate-500"><tr><th className="p-1.5 md:p-3">Imp.</th><th className="p-1.5 md:p-3">Client</th><th className="p-1.5 md:p-3">Logement</th><th className="p-1.5 md:p-3">Statut</th></tr></thead>
                      <tbody>
                        {reviewList.map(item => (
                          <tr key={item.id} className={`border-b ${!item.hasProperty ? 'bg-rose-50' : item.isDuplicate ? 'bg-orange-50' : ''}`}>
                            <td className="p-1.5 md:p-3"><input type="checkbox" checked={item.selected} disabled={!item.hasProperty} onChange={()=>setReviewList(reviewList.map(r=>r.id===item.id?{...r,selected:!r.selected}:r))} /></td>
                            <td className="p-1.5 md:p-3">{item.name}<div className="text-slate-400">{formatDateFr(item.startDate)}</div></td>
                            <td className="p-1.5 md:p-3 uppercase">{item.propertyName}</td>
                            <td className="p-1.5 md:p-3 uppercase">{!item.hasProperty ? <span className="text-rose-600 flex items-center gap-1"><AlertTriangle size={10}/> Logement Inconnu</span> : item.isDuplicate ? <span className="text-orange-600 flex items-center gap-1"><AlertTriangle size={10}/> Doublon</span> : <span className="text-emerald-600 flex items-center gap-1"><Check size={10}/> Nouveau</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <div className="flex gap-4 w-full mt-8">
                  {reviewList.length === 0 ? (<button onClick={startReview} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase shadow-xl hover:bg-blue-600 transition-colors">Analyser le texte</button>) : (<button onClick={confirmImport} disabled={reviewList.filter(r=>r.selected).length === 0} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase shadow-xl hover:bg-emerald-600 transition-colors disabled:opacity-50">Importer ({reviewList.filter(r=>r.selected).length})</button>)}
                </div>
              </div>
              
              {/* GOOGLE AGENDA */}
              <div className="bg-white p-6 rounded-[32px] shadow-lg mx-2 md:mx-0 mt-4 border-2 border-blue-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-[10px] font-black uppercase text-blue-600 mb-1">Google Agenda</h3>
                    <p className="text-[9px] text-slate-400 font-bold">{googleConnected ? "✅ Connecté — synchronisation automatique active" : "❌ Non connecté — cliquez pour autoriser"}</p>
                  </div>
                  <button onClick={googleConnected ? signOutGoogle : signInGoogle} className={"px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-md transition-colors " + (googleConnected ? "bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600" : "bg-blue-600 text-white hover:bg-blue-700")}>
                    {googleConnected ? "Déconnecter" : "Connecter Google"}
                  </button>
                </div>
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase text-slate-400">ID Calendrier par logement</p>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 bg-blue-50 p-3 rounded-2xl border border-blue-200">
                    <span className="text-[10px] font-black uppercase text-blue-700 min-w-[140px]">Ménage Dias</span>
                    <input defaultValue={diasCalendarId} onBlur={e => { const v = e.target.value.trim(); if (v !== diasCalendarId) { setDiasCalendarId(v); updateSettings({ diasCalendarId: v }); } }} placeholder="Collez l ID du calendrier Dias" className="flex-1 p-2 bg-white border border-blue-200 rounded-xl text-[9px] font-mono outline-none focus:border-blue-400" />
                    <select defaultValue={diasColorId} onChange={e => { const v = e.target.value; setDiasColorId(v); updateSettings({ diasColorId: v }); }} className="p-2 bg-white border border-blue-200 rounded-xl text-[9px] font-black outline-none focus:border-blue-400">
                      <option value="">Couleur défaut</option>
                      <option value="11">🍅 Rouge foncé (Tomate)</option>
                      <option value="4">🔴 Rouge clair (Flamingo)</option>
                      <option value="2">🟢 Vert clair (Sauge)</option>
                      <option value="7">🔵 Bleu clair (Paon)</option>
                      <option value="1">🩵 Bleu lavande</option>
                      <option value="3">🟣 Mauve (Raisin)</option>
                      <option value="5">🍌 Banane (Jaune)</option>
                      <option value="6">🟠 Orange (Mandarine)</option>
                      <option value="8">🩶 Graphite</option>
                      <option value="9">🫐 Myrtille</option>
                      <option value="10">🌿 Basilic (Vert foncé)</option>
                    </select>
                  </div>
                  {(properties || []).map(p => (
                    <div key={p.id} className="flex flex-col md:flex-row md:items-center gap-2 bg-slate-50 p-3 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-slate-700 min-w-[140px]">{p.name}</span>
                      <input defaultValue={p.calendarId || ""} onBlur={e => { if (e.target.value !== (p.calendarId || "")) updatePropCalendar(p.id, { calendarId: e.target.value.trim() }); }} placeholder="Collez l ID du calendrier Google" className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-[9px] font-mono outline-none focus:border-blue-400" />
                      <select defaultValue={p.colorId || ""} onChange={e => updatePropCalendar(p.id, { colorId: e.target.value || null })} className="p-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black outline-none focus:border-blue-400">
                        <option value="">Couleur défaut</option>
                        <option value="4">🔴 Rouge clair (Flamingo)</option>
                        <option value="2">🟢 Vert clair (Sauge)</option>
                        <option value="7">🔵 Bleu clair (Paon)</option>
                        <option value="1">🩵 Bleu lavande</option>
                        <option value="3">🟣 Mauve (Raisin)</option>
                        <option value="5">🍌 Banane (Jaune)</option>
                        <option value="6">🟠 Orange (Mandarine)</option>
                        <option value="8">🩶 Graphite</option>
                        <option value="9">🫐 Myrtille</option>
                        <option value="10">🌿 Basilic (Vert foncé)</option>
                        <option value="11">🦚 Paon foncé</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 mx-2 md:mx-0">
                <div className="bg-white p-6 rounded-[32px] shadow-lg flex flex-col h-full">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4">Plateformes</h3>
                  <div className="space-y-2 mb-6 flex-1 overflow-y-auto max-h-[200px] text-[10px] font-black uppercase">
                     {(availablePlatforms || []).map(p=>(<div key={p} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl"><span>{p}</span><button onClick={()=>{const n = availablePlatforms.filter(x=>x!==p); setAvailablePlatforms(n); updateSettings({platforms:n})}} className="text-slate-300 hover:text-rose-500"><X size={14}/></button></div>))}
                  </div>
                  <form onSubmit={(e)=>{e.preventDefault(); if(inputPlat.trim()){const n = [...availablePlatforms, inputPlat.trim()]; setAvailablePlatforms(n); updateSettings({platforms:n}); setInputPlat('')}}} className="flex gap-2">
                     <input value={inputPlat} onChange={e=>setInputPlat(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-xl text-[10px]" /><button className="bg-slate-900 text-white p-2 rounded-xl">+</button>
                  </form>
                </div>
                
                {/* --- NOUVEAU BLOC : PRESTATAIRES AVEC EMAIL --- */}
                <div className="bg-white p-6 rounded-[32px] shadow-lg flex flex-col h-full border-2 border-blue-50">
                  <h3 className="text-[10px] font-black uppercase text-blue-600 mb-4">Prestataires (Emails)</h3>
                  <div className="space-y-2 mb-6 flex-1 overflow-y-auto max-h-[200px] text-[10px] font-black uppercase">
                     {(availableProviders || []).map(p=>(
                         <div key={p} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                             <div>
                                <span className="block">{p}</span>
                                {providerEmails[p] && <span className="text-[8px] normal-case text-slate-400 block mt-0.5"><Mail size={8} className="inline mr-1"/>{providerEmails[p]}</span>}
                             </div>
                             <button onClick={()=>{
                                 const n = availableProviders.filter(x=>x!==p);
                                 setAvailableProviders(n);
                                 const newEmails = {...providerEmails};
                                 delete newEmails[p];
                                 setProviderEmails(newEmails);
                                 updateSettings({providers:n, providerEmails: newEmails});
                             }} className="text-slate-300 hover:text-rose-500"><Trash2 size={14}/></button>
                         </div>
                     ))}
                  </div>
                  <form onSubmit={(e)=>{
                      e.preventDefault(); 
                      if(inputProv.trim()){
                         const n = [...availableProviders, inputProv.trim()]; 
                         setAvailableProviders(n); 
                         const newEmails = {...providerEmails};
                         if (inputProvEmail.trim()) newEmails[inputProv.trim()] = inputProvEmail.trim();
                         setProviderEmails(newEmails);
                         updateSettings({providers:n, providerEmails: newEmails}); 
                         setInputProv(''); setInputProvEmail('');
                      }
                  }} className="flex flex-col gap-2">
                     <input value={inputProv} onChange={e=>setInputProv(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-[10px]" placeholder="Nom (ex: Dias)" />
                     <input type="email" value={inputProvEmail} onChange={e=>setInputProvEmail(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-[10px]" placeholder="Email (facultatif)" />
                     <button type="submit" className="bg-blue-600 text-white p-2.5 rounded-xl font-black text-[10px] uppercase">+ Ajouter</button>
                  </form>
                </div>
 
                <div className="bg-white p-6 rounded-[32px] shadow-lg flex flex-col h-full">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4">Services</h3>
                  <div className="space-y-2 mb-6 flex-1 overflow-y-auto max-h-[200px] text-[10px] font-black uppercase">
                     {(availableServiceTypes || []).map(p=>(<div key={p} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl"><span>{p}</span><button onClick={()=>{const n = availableServiceTypes.filter(x=>x!==p); setAvailableServiceTypes(n); updateSettings({services:n})}} className="text-slate-300 hover:text-rose-500"><X size={14}/></button></div>))}
                  </div>
                  <form onSubmit={(e)=>{e.preventDefault(); if(inputSvc.trim()){const n = [...availableServiceTypes, inputSvc.trim()]; setAvailableServiceTypes(n); updateSettings({services:n}); setInputSvc('')}}} className="flex gap-2">
                     <input value={inputSvc} onChange={e=>setInputSvc(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-xl text-[10px]" /><button className="bg-slate-900 text-white p-2 rounded-xl">+</button>
                  </form>
                </div>
                
                <div className="bg-white p-6 rounded-[32px] shadow-lg flex flex-col h-full border-2 border-blue-50"><h3 className="text-[10px] font-black uppercase text-blue-600 mb-4">Logements</h3><div className="space-y-2 mb-6 flex-1 overflow-y-auto max-h-[200px] text-[10px] font-black uppercase">{(properties || []).map(p=>(<div key={p.id} className="flex justify-between items-center p-3 bg-blue-50 rounded-xl"><span>{p.name}</span><button onClick={async()=>{if(window.confirm('Supprimer ?'))await deleteDoc(doc(db,'artifacts',appId,'public', 'data', 'properties', p.id))}} className="text-slate-300 hover:text-rose-500"><Trash2 size={14}/></button></div>))}</div><form onSubmit={async(e)=>{e.preventDefault(); if(inputProp.name.trim()){await addDoc(collection(db,'artifacts',appId,'public','data','properties'),{name:inputProp.name.trim(),address:inputProp.address.trim()}); setInputProp({name:'',address:''})}}} className="flex flex-col gap-2"><input required value={inputProp.name} onChange={e=>setInputProp({...inputProp,name:e.target.value})} className="p-3 bg-slate-50 rounded-xl text-[10px] outline-none" placeholder="Nom du bien" /><button type="submit" className="bg-slate-900 text-white p-3 rounded-xl font-black text-[10px] uppercase shadow-md">+ Ajouter</button></form></div>
              </div>
            </div>
          </div>
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
            <form onSubmit={saveRes} className="p-6 md:p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar text-xs touch-manipulation" style={{ touchAction: 'manipulation' }}>
              
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
                  <div className="flex justify-between font-black uppercase tracking-widest text-slate-400 text-[10px]">
                      Prestations
                      <button type="button" onClick={() => {
                          const newExp = { id: Date.now().toString(), person: availableProviders[0] || '', type: availableServiceTypes[0] || '', amount: 0, paymentDate: '', hoursEntry: '', rateEntry: '', hoursExit: '', rateExit: '', dateEntry: formData.startDate || '', dateExit: formData.endDate || '', timeEntry: '09:30', timeExit: '10:30', providerNoteEntry: '', providerNoteExit: '', sendEmail: true };
                          if (newExp.person.toLowerCase().includes('dias')) {
                              newExp.rateEntry = isSundayOrHoliday(newExp.dateEntry) ? 25 : 15;
                              newExp.rateExit = isSundayOrHoliday(newExp.dateExit) ? 25 : 15;
                          }
                          setFormData({ ...formData, resExpenses: [...(formData.resExpenses || []), newExp] })
                      }} className="bg-slate-900 text-white px-4 py-2 rounded-xl">+ Ajouter</button>
                  </div>
                  
                  {(formData.resExpenses || []).map(exp => {
                      const isDias = exp.person && exp.person.toLowerCase().includes('dias');
 
                      if (isDias) {
                          return (
                              <div key={exp.id} className="flex flex-col gap-3 bg-blue-50/50 p-4 rounded-[28px] border border-blue-100 shadow-sm relative overflow-hidden">
                                  {/* Haut : Sélecteurs de base */}
                                  <div className="flex gap-1.5 md:gap-2 items-center relative z-10">
                                      <select value={exp.person || ''} onChange={e => {
                                          const val = e.target.value;
                                          setFormData({ ...formData, resExpenses: (formData.resExpenses || []).map(x => {
                                              if (x.id === exp.id) {
                                                  const isDiasNow = val.toLowerCase().includes('dias');
                                                  if (isDiasNow) {
                                                      const rE = isSundayOrHoliday(x.dateEntry) ? 25 : 15;
                                                      const rX = isSundayOrHoliday(x.dateExit) ? 25 : 15;
                                                      const he = parseFloat(x.hoursEntry) || 0;
                                                      const hs = parseFloat(x.hoursExit) || 0;
                                                      return { ...x, person: val, rateEntry: rE, rateExit: rX, amount: (he * rE) + (hs * rX) };
                                                  }
                                                  return { ...x, person: val };
                                              }
                                              return x;
                                          })});
                                      }} className="flex-1 min-w-0 p-2 md:p-3 border border-blue-200 rounded-xl font-black uppercase text-[9px] md:text-[10px] outline-none bg-white">{(availableProviders || []).map(p => <option key={p} value={p}>{p}</option>)}</select>
                                      
                                      <select value={exp.type || ''} onChange={e => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 min-w-0 p-2 md:p-3 border border-blue-200 rounded-xl font-black uppercase text-[9px] md:text-[10px] outline-none bg-white">{(availableServiceTypes || []).map(p => <option key={p} value={p}>{p}</option>)}</select>
                                      
                                      <button type="button" onClick={() => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).filter(x => x.id !== exp.id) })} className="flex-shrink-0 text-rose-500 font-black px-1 md:px-2 hover:scale-110 transition-transform"><Trash2 size={18}/></button>
                                  </div>
 
                                  {/* Milieu : Dates et Heures (Spécial DIAS) */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10 mt-1">
                                      {/* Bloc Entrée */}
                                      <div className="bg-white p-3 rounded-[20px] border border-blue-100 shadow-sm space-y-2">
                                          <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-1.5">Entrée {getStatusIcon(exp.googleDiasEntryId, exp.googleDiasEntryStatus, 14)}</span>{isSundayOrHoliday(exp.dateEntry) && <span className="text-[8px] font-black text-white bg-rose-500 px-2 py-0.5 rounded-full shadow-sm">Férié / Dim</span>}</div>
                                          <input type="date" value={exp.dateEntry || ''} onChange={e => updateDiasField(exp.id, 'dateEntry', e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none cursor-pointer" />
                                          <div className="flex gap-2">
                                              <div className="w-1/3 min-w-0">
                                                  <label className="text-[7px] uppercase text-slate-400 font-bold block mb-1">Heure</label>
                                                  <select value={exp.timeEntry || '09:30'} onChange={e => updateDiasField(exp.id, 'timeEntry', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-black text-center text-[10px] outline-none focus:border-blue-400 bg-white">
                                                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                                  </select>
                                              </div>
                                              <div className="w-1/3 min-w-0"><label className="text-[7px] uppercase text-slate-400 font-bold block mb-1">Durée (h)</label><input type="number" step="0.5" value={exp.hoursEntry || ''} onChange={e => updateDiasField(exp.id, 'hoursEntry', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-black text-center text-[10px] outline-none focus:border-blue-400" placeholder="0" /></div>
                                              <div className="w-1/3 min-w-0"><label className="text-[7px] uppercase text-slate-400 font-bold block mb-1">Tarif (€)</label><input type="number" step="0.5" value={exp.rateEntry || ''} onChange={e => updateDiasField(exp.id, 'rateEntry', e.target.value)} className={`w-full p-2 border rounded-lg font-black text-center text-[10px] outline-none focus:border-blue-400 transition-colors ${isSundayOrHoliday(exp.dateEntry) ? 'bg-rose-50 border-rose-200 text-rose-700' : 'border-slate-200 text-slate-900'}`} placeholder="0" /></div>
                                          </div>
                                      </div>
                                      {/* Bloc Sortie */}
                                      <div className="bg-white p-3 rounded-[20px] border border-blue-100 shadow-sm space-y-2">
                                          <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-1.5">Sortie {getStatusIcon(exp.googleDiasExitId, exp.googleDiasExitStatus, 14)}</span>{isSundayOrHoliday(exp.dateExit) && <span className="text-[8px] font-black text-white bg-rose-500 px-2 py-0.5 rounded-full shadow-sm">Férié / Dim</span>}</div>
                                          <input type="date" value={exp.dateExit || ''} onChange={e => updateDiasField(exp.id, 'dateExit', e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none cursor-pointer" />
                                          <div className="flex gap-2">
                                              <div className="w-1/3 min-w-0">
                                                  <label className="text-[7px] uppercase text-slate-400 font-bold block mb-1">Heure</label>
                                                  <select value={exp.timeExit || '10:30'} onChange={e => updateDiasField(exp.id, 'timeExit', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-black text-center text-[10px] outline-none focus:border-blue-400 bg-white">
                                                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                                  </select>
                                              </div>
                                              <div className="w-1/3 min-w-0"><label className="text-[7px] uppercase text-slate-400 font-bold block mb-1">Durée (h)</label><input type="number" step="0.5" value={exp.hoursExit || ''} onChange={e => updateDiasField(exp.id, 'hoursExit', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg font-black text-center text-[10px] outline-none focus:border-blue-400" placeholder="0" /></div>
                                              <div className="w-1/3 min-w-0"><label className="text-[7px] uppercase text-slate-400 font-bold block mb-1">Tarif (€)</label><input type="number" step="0.5" value={exp.rateExit || ''} onChange={e => updateDiasField(exp.id, 'rateExit', e.target.value)} className={`w-full p-2 border rounded-lg font-black text-center text-[10px] outline-none focus:border-blue-400 transition-colors ${isSundayOrHoliday(exp.dateExit) ? 'bg-rose-50 border-rose-200 text-rose-700' : 'border-slate-200 text-slate-900'}`} placeholder="0" /></div>
                                          </div>
                                      </div>
                                  </div>
 
                                  <div className="mt-2 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                          <label className="text-[8px] uppercase text-blue-500 font-black tracking-widest block mb-1">Note Entrée</label>
                                          <textarea value={exp.providerNoteEntry || ''} onChange={e => updateDiasField(exp.id, 'providerNoteEntry', e.target.value)} placeholder="Infos pour l'entrée (code, consignes...)" className="w-full p-3 border border-blue-200 rounded-[16px] text-xs font-medium text-slate-700 outline-none bg-white min-h-[60px]" />
                                      </div>
                                      <div>
                                          <label className="text-[8px] uppercase text-blue-500 font-black tracking-widest block mb-1">Note Sortie</label>
                                          <textarea value={exp.providerNoteExit || ''} onChange={e => updateDiasField(exp.id, 'providerNoteExit', e.target.value)} placeholder="Infos pour la sortie (code, consignes...)" className="w-full p-3 border border-blue-200 rounded-[16px] text-xs font-medium text-slate-700 outline-none bg-white min-h-[60px]" />
                                      </div>
                                  </div>
 

 
                                  <div className="flex justify-between items-center bg-blue-600 text-white p-4 rounded-[18px] shadow-sm relative z-10 mt-2">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Total Automatique Bloqué</span>
                                      <span className="font-black text-xl">{(parseFloat(exp.amount) || 0).toFixed(2)} €</span>
                                  </div>
                              </div>
                          );
                      }
 
                      // LIGNE CLASSIQUE POUR LES AUTRES PRESTATAIRES
                      return (
                          <div key={exp.id} className="flex flex-col gap-2 bg-slate-50 p-4 rounded-[28px] border border-slate-100">
                              <div className="flex gap-1.5 md:gap-2 items-center">
                                  <select value={exp.person || ''} onChange={e => {
                                      const val = e.target.value;
                                      setFormData({ ...formData, resExpenses: (formData.resExpenses || []).map(x => {
                                          if (x.id === exp.id) {
                                              const isDiasNow = val.toLowerCase().includes('dias');
                                              if (isDiasNow) {
                                                  const rE = isSundayOrHoliday(x.dateEntry) ? 25 : 15;
                                                  const rX = isSundayOrHoliday(x.dateExit) ? 25 : 15;
                                                  const he = parseFloat(x.hoursEntry) || 0;
                                                  const hs = parseFloat(x.hoursExit) || 0;
                                                  return { ...x, person: val, rateEntry: rE, rateExit: rX, amount: (he * rE) + (hs * rX) };
                                              }
                                              return { ...x, person: val };
                                          }
                                          return x;
                                      })});
                                  }} className="flex-1 min-w-0 p-2 md:p-3 border rounded-xl font-black uppercase text-[9px] md:text-[10px] outline-none">{(availableProviders || []).map(p => <option key={p} value={p}>{p}</option>)}</select>
                                  <select value={exp.type || ''} onChange={e => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 min-w-0 p-2 md:p-3 border rounded-xl font-black uppercase text-[9px] md:text-[10px] outline-none">{(availableServiceTypes || []).map(p => <option key={p} value={p}>{p}</option>)}</select>
                                  <input type="number" value={exp.amount || ''} onChange={e => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).map(x => x.id === exp.id ? { ...x, amount: e.target.value } : x) })} className="w-14 md:w-20 min-w-0 p-2 md:p-3 border rounded-xl font-black text-right outline-none text-[9px] md:text-[10px]" />
                                  <button type="button" onClick={() => setFormData({ ...formData, resExpenses: (formData.resExpenses || []).filter(x => x.id !== exp.id) })} className="flex-shrink-0 text-rose-500 font-black px-1 md:px-2"><Trash2 size={18}/></button>
                              </div>
                              {/* --- OPTION EMAIL AGENDA POUR LES AUTRES --- */}
                              {providerEmails[exp.person] && (
                                  <label className="flex items-center gap-2 cursor-pointer pl-1 mt-1">
                                      <input type="checkbox" checked={exp.sendEmail !== false} onChange={e => {
                                          setFormData(prev => ({
                                              ...prev,
                                              resExpenses: prev.resExpenses.map(x => x.id === exp.id ? { ...x, sendEmail: e.target.checked } : x)
                                          }));
                                      }} className="w-3.5 h-3.5 flex-shrink-0 accent-slate-600" />
                                      <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 min-w-0 break-words">
                                        <Mail size={12} className="flex-shrink-0"/> Inviter à l'agenda ({providerEmails[exp.person]})
                                        {exp.sendEmail !== false && getStatusIcon(formData.googleEventId, formData.googleEventStatus, 14)}
                                      </span>
                                  </label>
                              )}
                          </div>
                      );
                  })}
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
                       {formData.platform === 'En direct' ? (parseFloat(formData?.grossAmount) || 0).toFixed(2) : (nModale - curChargesModale).toFixed(2)}€
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