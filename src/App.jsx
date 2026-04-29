import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Calendar, Wallet, Building2, Menu, X, Plus, Trash2, TrendingUp, Clock } from 'lucide-react';

// --- CONFIGURATION FIREBASE ---
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
  const [newRes, setNewRes] = useState({ client: '', montant: '', date: '', nuits: '1' });

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
    if (!newRes.client || !newRes.montant || !newRes.date) return;
    try {
      await addDoc(collection(db, "reservations"), {
        client: newRes.client,
        montant: parseFloat(newRes.montant),
        date: newRes.date,
        nuits: parseInt(newRes.nuits),
        createdAt: new Date().toISOString()
      });
      setNewRes({ client: '', montant: '', date: '', nuits: '1' });
      setShowAddModal(false);
    } catch (err) {
      alert("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm("Supprimer cette réservation ?")) {
      await deleteDoc(doc(db, "reservations", id));
    }
  };

  const totalRevenus = reservations.reduce((acc, curr) => acc + (curr.montant || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-20 md:pb-0">
      <nav className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Building2 size={24} className="text-blue-200" />
            <span className="text-xl font-black tracking-tighter">IMMOGÉRER</span>
          </div>
          <div className="hidden md:flex space-x-8 font-bold text-sm">
            <button onClick={() => setActiveTab('planning')} className={activeTab === 'planning' ? 'text-white underline underline-offset-8' : 'text-blue-200'}>PLANNING</button>
            <button onClick={() => setActiveTab('finances')} className={activeTab === 'finances' ? 'text-white underline underline-offset-8' : 'text-blue-200'}>FINANCES</button>
          </div>
        </div>
      </nav>

      <main className="flex-grow p-4 max-w-4xl mx-auto w-full mb-20">
        {activeTab === 'planning' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-800">Planning</h2>
              <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white h-12 px-6 rounded-2xl flex items-center gap-2 shadow-lg active:scale-95 transition-transform">
                <Plus size={20} /> <span className="font-bold">Ajouter</span>
              </button>
            </div>
            {reservations.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-4">
                <p className="text-slate-400 font-medium">Aucune réservation pour le moment.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reservations.map((res) => (
                  <div key={res.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="font-black text-slate-800 uppercase text-sm tracking-tight">{res.client}</p>
                      <div className="flex items-center gap-3 text-slate-500 text-xs font-bold">
                         <span className="flex items-center gap-1"><Calendar size={14}/> {res.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-5">
                      <span className="text-xl font-black text-blue-600">{res.montant}€</span>
                      <button onClick={() => handleDelete(res.id)} className="text-slate-200 hover:text-red-500">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-slate-800">Finances</h2>
            <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-blue-100">
              <p className="text-blue-100 text-xs font-black uppercase mb-2 tracking-widest">Revenus Totaux</p>
              <p className="text-5xl font-black">{totalRevenus.toLocaleString()} €</p>
              <div className="mt-6 pt-6 border-t border-blue-500/50 font-bold flex items-center gap-2">
                <TrendingUp size={18}/> {reservations.length} Locations
              </div>
            </div>
          </div>
        )}
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[100]">
          <div className="bg-white rounded-t-3xl md:rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-800">Nouveau Dossier</h3>
              <button onClick={() => setShowAddModal(false)} className="bg-slate-100 p-2 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <input type="text" required placeholder="Nom du locataire" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" 
                value={newRes.client} onChange={e => setNewRes({...newRes, client: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" required className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm" 
                  value={newRes.date} onChange={e => setNewRes({...newRes, date: e.target.value})} />
                <input type="number" required placeholder="Prix (€)" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" 
                  value={newRes.montant} onChange={e => setNewRes({...newRes, montant: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg mt-4 active:scale-95 transition-transform">
                ENREGISTRER
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 flex justify-around p-3 md:hidden z-40">
        <button onClick={() => setActiveTab('planning')} className={`flex flex-col items-center p-2 ${activeTab === 'planning' ? 'text-blue-600' : 'text-slate-300'}`}>
          <Calendar size={26} strokeWidth={3} />
          <span className="text-[10px] font-black mt-1 uppercase">Planning</span>
        </button>
        <button onClick={() => setActiveTab('finances')} className={`flex flex-col items-center p-2 ${activeTab === 'finances' ? 'text-blue-600' : 'text-slate-300'}`}>
          <Wallet size={26} strokeWidth={3} />
          <span className="text-[10px] font-black mt-1 uppercase">Finances</span>
        </button>
      </footer>
    </div>
  );
};

export default App;
