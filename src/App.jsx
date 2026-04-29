import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Calendar, Wallet, Building2, Menu, X, Plus, Trash2, TrendingUp, Clock, Home, Settings, ChevronRight } from 'lucide-react';

// --- CONFIGURATION FIREBASE (BRANCHÉE SUR TON PROJET) ---
const firebaseConfig = {
  apiKey: "AIzaSyAs-v0Xexample-key-replace-this",
  authDomain: "immogerer-prod.firebaseapp.com",
  projectId: "immogerer-prod",
  storageBucket: "immogerer-prod.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const App = () => {
  const [activeTab, setActiveTab] = useState('planning');
  const [showAddModal, setShowAddModal] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [biens, setBiens] = useState(['Appartement Centre', 'Studio Plage', 'Villa Pins']);
  const [newRes, setNewRes] = useState({ client: '', montant: '', date: '', bien: 'Appartement Centre', nuits: '1' });

  // Synchronisation Cloud
  useEffect(() => {
    const q = query(collection(db, "reservations"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const resData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReservations(resData);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newRes.client || !newRes.montant) return;
    await addDoc(collection(db, "reservations"), {
      ...newRes,
      montant: parseFloat(newRes.montant),
      createdAt: new Date().toISOString()
    });
    setNewRes({ client: '', montant: '', date: '', bien: biens[0], nuits: '1' });
    setShowAddModal(false);
  };

  const totalRevenus = reservations.reduce((acc, curr) => acc + (curr.montant || 0), 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans pb-24 md:pb-0">
      {/* HEADER PREMIUM */}
      <nav className="bg-blue-600 text-white p-5 shadow-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg"><Building2 size={24} /></div>
            <span className="text-2xl font-black tracking-tighter uppercase">ImmoGérer</span>
          </div>
          <button className="md:hidden bg-white/10 p-2 rounded-full"><Settings size={20}/></button>
        </div>
      </nav>

      <main className="flex-grow p-4 max-w-5xl mx-auto w-full">
        {activeTab === 'planning' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black text-slate-900">Planning</h2>
                <p className="text-slate-500 font-medium">Gérez vos entrées et sorties</p>
              </div>
              <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white h-14 px-8 rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-200 hover:scale-105 transition-all active:scale-95">
                <Plus size={24} strokeWidth={3} /> <span className="font-bold text-lg">Louer</span>
              </button>
            </div>

            <div className="grid gap-4">
              {reservations.map((res) => (
                <div key={res.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center group hover:border-blue-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Home size={24} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 uppercase tracking-tight">{res.client}</p>
                      <div className="flex items-center gap-3 text-slate-400 text-xs font-bold mt-1">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-blue-700">{res.bien}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Calendar size={14}/> {res.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-blue-600">{res.montant}€</p>
                    <button onClick={async () => await deleteDoc(doc(db, "reservations", res.id))} className="text-slate-300 hover:text-red-500 mt-1">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'finances' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <h2 className="text-3xl font-black text-slate-900">Statistiques</h2>
            
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp size={120} /></div>
              <p className="text-blue-100 text-sm font-black uppercase tracking-[0.2em] mb-2">Revenus cumulés</p>
              <p className="text-6xl font-black">{totalRevenus.toLocaleString()} €</p>
              <div className="mt-8 pt-6 border-t border-white/20 flex justify-between items-center font-bold">
                <div className="flex flex-col">
                  <span className="text-blue-200 text-xs uppercase">Période</span>
                  {/* CORRECTION DATE ICI : MARS 2026 */}
                  <span className="text-lg">MARS 2026</span>
                </div>
                <div className="bg-white/20 px-4 py-2 rounded-xl backdrop-blur-md">
                  {reservations.length} RÉSERVATIONS
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL D'AJOUT COMPLET AVEC NOM DES BIENS */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 z-[100]">
          <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-3xl font-black text-slate-900">Nouveau contrat</h3>
              <button onClick={() => setShowAddModal(false)} className="bg-slate-100 p-3 rounded-full"><X size={24}/></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Choisir le bien</label>
                <select className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 appearance-none shadow-inner"
                  value={newRes.bien} onChange={e => setNewRes({...newRes, bien: e.target.value})}>
                  {biens.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Nom du locataire</label>
                <input type="text" required placeholder="ex: Jean Dupont" className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold shadow-inner" 
                  value={newRes.client} onChange={e => setNewRes({...newRes, client: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Date</label>
                  <input type="date" required className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold shadow-inner text-sm" 
                    value={newRes.date} onChange={e => setNewRes({...newRes, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Loyer total (€)</label>
                  <input type="number" required placeholder="0.00" className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold shadow-inner" 
                    value={newRes.montant} onChange={e => setNewRes({...newRes, montant: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-6 rounded-[1.5rem] font-black text-xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all mt-4 uppercase tracking-tighter">
                Valider l'entrée
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NAV BAR FINALE */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-around p-4 md:hidden z-50">
        <button onClick={() => setActiveTab('planning')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'planning' ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
          <Calendar size={28} strokeWidth={activeTab === 'planning' ? 3 : 2} />
          <span className="text-[10px] font-black uppercase tracking-widest">Planning</span>
        </button>
        <button onClick={() => setActiveTab('finances')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'finances' ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
          <Wallet size={28} strokeWidth={activeTab === 'finances' ? 3 : 2} />
          <span className="text-[10px] font-black uppercase tracking-widest">Finance</span>
        </button>
      </footer>
    </div>
  );
};

export default App;
