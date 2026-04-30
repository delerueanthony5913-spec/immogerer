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
  const visibleData = (data || []).filter(d => d.value > 0);
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
    <div className="bg-white p-10 rounded-[48px] border border-gray-50 flex flex-col md:flex-row items-center gap-10 animate-in fade-in shadow-xl">
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
          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Net</span>
          <span className="text-xl font-black text-slate-900">{Math.round(displayTotal).toLocaleString('fr-FR')}€</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{title}</h3>
        <div className="space-y-2">
          {visibleData.map((slice, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] group">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }}></div>
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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reservations');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [availablePlatforms, setAvailablePlatforms] = useState(['Airbnb', 'Booking', 'Abritel', 'En direct', 'Autre']);
  const [availableProviders, setAvailableProviders] = useState(['Justine', 'Marc', 'Stéphanie']);
  const [availableServiceTypes, setAvailableServiceTypes] = useState(['Ménage', 'Entrée/Sortie', 'Piscine', 'Divers']);

  // FILTRES
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

  // AUTH & FIREBASE
  useEffect(() => {
    onAuthStateChanged(auth, (u) => { if (u) { setUser(u); setLoading(false); } else { signInAnonymously(auth); } });
    
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'properties'), (snap) => setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tenants'), (snap) => setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), (snap) => {
        if (snap.exists()) {
            const d = snap.data();
            if (d.platforms) setAvailablePlatforms(d.platforms);
            if (d.providers) setAvailableProviders(d.providers);
            if (d.services) setAvailableServiceTypes(d.services);
        }
    });
  }, []);

  const saveRes = async (e) => {
    e.preventDefault();
    const d = { ...formData, resExpenses: (formData.resExpenses || []).map(r => ({ ...r, amount: parseFloat(r.amount) || 0 })) };
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

  // LOGIQUE DE FILTRAGE UNIFIÉE
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

  const yearsAvailable = useMemo(() => {
    const years = (tenants || []).map(t => t.startDate ? new Date(t.startDate).getFullYear() : null).filter(Boolean);
    return [...new Set([...years, new Date().getFullYear()])].sort((a, b) => b - a);
  }, [tenants]);

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-black uppercase text-xs"><Loader2 className="animate-spin text-blue-600 mr-2" /> Chargement CADEL MANAGER...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`fixed md:sticky top-0 left-0 z-50 w-72 h-full md:h-screen bg-white border-r border-slate-100 flex flex-col transform md:translate-x-0 transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-10 border-b border-slate-50 flex flex-col items-center">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-4 rounded-2xl text-white shadow-xl mb-2"><Building2 size={28} /></div>
          <h1 className="font-black uppercase tracking-tighter text-2xl">CADEL</h1><h2 className="font-black uppercase tracking-[0.3em] text-[10px] text-blue-600">MANAGER</h2>
        </div>
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {[{ id: 'reservations', label: 'Réservations', icon: <List size={18}/> }, { id: 'agenda', label: 'Agenda', icon: <CalendarRange size={18}/> }, { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={18}/> }, { id: 'finances', label: 'Finances', icon: <Calculator size={18}/> }, { id: 'settings', label: 'Paramètres', icon: <Settings size={18}/> }].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full text-left px-5 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-4 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-2xl translate-x-2' : 'text-slate-400 hover:bg-slate-50'}`}>{item.icon} {item.label}</button>
          ))}
        </nav>
      </aside>

      {/* HEADER MOBILE */}
      <div className="md:hidden flex items-center justify-between p-5 bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2"><div className="bg-blue-600 p-1.5 rounded-lg text-white"><Building2 size={16}/></div><h1 className="font-black uppercase text-sm">CADEL MANAGER</h1></div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">{isMobileMenuOpen ? <X /> : <Menu />}</button>
      </div>

      <main className="flex-1 p-4 md:p-12 overflow-y-auto h-screen custom-scrollbar">
        <div className="max-w-7xl mx-auto pb-32">
          {/* BARRE DE FILTRES UNIFIÉE AVEC SÉCURITÉ */}
          <div className="flex flex-wrap items-center gap-2 bg-white/70 backdrop-blur-md p-3 rounded-[28px] border border-white shadow-xl mb-6 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <Filter size={12} className="text-slate-400" />
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none">
                    <option value="all">Années</option>
                    {yearsAvailable?.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            {/* Autres filtres avec sécurité map */}
            <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <select value={filterProp} onChange={e => setFilterProp(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none max-w-[130px]">
                    <option value="all">Logements</option>
                    {properties?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <select value={filterPlat} onChange={e => setFilterPlat(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none">
                    <option value="all">Plateformes</option>
                    {availablePlatforms?.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <select value={filterProv} onChange={e => setFilterProv(e.target.value)} className="text-[10px] font-black uppercase bg-transparent outline-none">
                    <option value="all">Prestataires</option>
                    {availableProviders?.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
          </div>

          {/* TAB RESERVATIONS */}
          {activeTab === 'reservations' && (
            <div className="space-y-6 md:space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center"><h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Réservations</h2><button onClick={() => { setEditingResId(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-6 md:px-8 py-3 rounded-[20px] font-black text-[10px] uppercase shadow-xl hover:bg-blue-700 transition-all">+ Nouvelle</button></div>
              <div className="hidden md:block bg-white rounded-[40px] shadow-2xl overflow-hidden text-xs"><table className="w-full text-left min-w-[900px]"><thead className="bg-slate-50 font-black uppercase border-b text-slate-400"><tr><th className="p-6">Bien</th><th className="p-6">Client</th><th className="p-6 text-center">Dates</th><th className="p-6">Services</th><th className="p-6 text-right">Net</th><th className="p-6 text-center">État</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold">
                {reservationsList?.map(t => (
                  <tr key={t.id} onClick={() => { setEditingResId(t.id); setFormData(t); setIsModalOpen(true); }} className="hover:bg-slate-50 cursor-pointer">
                    <td className="p-6"><div><div className="font-black uppercase">{properties.find(p => p.id === t.propertyId)?.name || '--'}</div><div className="text-blue-600 text-[9px] uppercase tracking-widest">{t.platform}</div></div></td>
                    <td className="p-6 text-sm">{t.name}</td>
                    <td className="p-6 text-center text-slate-500">{t.startDate} ➔ {t.endDate}</td>
                    <td className="p-6">{(t.resExpenses || []).map((e,i)=>(<div key={i} className="text-[9px] bg-slate-50 p-1 mb-1 rounded flex justify-between uppercase"><span>{e.type}</span><span className={e.paymentDate ? 'text-emerald-600' : 'text-orange-500'}>{e.amount}€</span></div>))}</td>
                    <td className="p-6 text-right font-black text-base">{(t.netAmount || 0).toFixed(2)}€</td>
                    <td className="p-6 text-center"><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${t.paymentDate ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{t.paymentDate ? 'Payé' : 'Dû'}</span></td>
                  </tr>
                ))}
              </tbody></table></div>
            </div>
          )}
        </div>
      </main>

      {/* MODALE RÉSERVATION AVEC SÉCURITÉ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-[40px] md:rounded-[60px] shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col border border-slate-100">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4 text-blue-600"><div className="bg-blue-50 p-2 rounded-2xl"><CalendarCheck size={24} /></div><h3 className="font-black text-xl uppercase">Détail Réservation</h3></div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-900"><X size={24} /></button>
            </div>
            <form onSubmit={saveRes} className="p-6 md:p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1"><label className="text-[10px] font-black uppercase ml-3 text-slate-400">Logement</label><select required value={formData.propertyId} onChange={e => setFormData({ ...formData, propertyId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[20px] font-black">{properties?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="space-y-1"><label className="text-[10px] font-black uppercase ml-3 text-slate-400">Client</label><input required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[20px] font-black" /></div>
              </div>
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3"><span className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><UserCheck size={16}/> Prestations</span><button type="button" onClick={() => setFormData({ ...formData, resExpenses: [...(formData.resExpenses || []), { id: Date.now().toString(), person: (availableProviders && availableProviders[0]) || '', type: (availableServiceTypes && availableServiceTypes[0]) || '', amount: 0, paymentDate: '' }] })} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">+ Ajouter</button></div>
                <div className="space-y-3">
                   {(formData.resExpenses || []).map(exp => (
                    <div key={exp.id} className="flex flex-col bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-3">
                      <div className="flex gap-3 items-center">
                        <select value={exp.person} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, person: e.target.value } : x) })} className="flex-1 p-2 border border-slate-200 rounded-xl text-[10px] font-black bg-white">{availableProviders?.map(p => <option key={p} value={p}>{p}</option>)}</select>
                        <select value={exp.type} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, type: e.target.value } : x) })} className="flex-1 p-2 border border-slate-200 rounded-xl text-[10px] font-black bg-white">{availableServiceTypes?.map(p => <option key={p} value={p}>{p}</option>)}</select>
                        <input type="number" value={exp.amount || ''} onChange={e => setFormData({ ...formData, resExpenses: formData.resExpenses.map(x => x.id === exp.id ? { ...x, amount: e.target.value } : x) })} className="w-16 p-2 border rounded-xl font-black text-right outline-none" />
                        <button type="button" onClick={() => setFormData({ ...formData, resExpenses: formData.resExpenses.filter(x => x.id !== exp.id) })} className="text-slate-300 hover:text-rose-500"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pt-8 border-t border-slate-100 gap-6">
                <button type="submit" className="w-full bg-slate-900 text-white px-10 py-4 rounded-[20px] font-black shadow-2xl hover:bg-blue-600 uppercase tracking-widest text-[10px] transition-all">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
