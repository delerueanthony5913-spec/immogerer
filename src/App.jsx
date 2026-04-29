import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Calendar, Wallet, Building2, Menu, X, Plus, Trash2, ChevronRight, TrendingUp } from 'lucide-react';

// --- TA CONFIGURATION FIREBASE ---
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [newRes, setNewRes] = useState({ client: '', montant: '', date: '' });

  // Lecture des données en temps réel
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
      createdAt: new Date()
    });
    setNewRes({ client: '', montant: '', date: '' });
    setShowAddModal(false);
  };

  const handleDelete = async (id) => {
    if(window.confirm("Supprimer cette réservation ?")) {
      await deleteDoc(doc(db, "reservations", id));
    }
  };

  const totalRevenus = reservations.reduce((acc, curr) => acc + curr.montant, 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-blue-600 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Building2 size={24} />
            <span className="text-xl font-bold tracking-tight">IMMOGÉRER</span>
          </div>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden">
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      <main className="flex-grow p-4 max-w-6xl mx-auto w-full mb-20">
        {activeTab === 'planning' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Planning</h2>
              <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-md">
                <Plus size={20} /> <span className="hidden sm:inline">Ajouter</span>
              </button>
            </div>

            {reservations.length === 0 ? (
              <div className="bg-white p-10 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                <Calendar size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">Aucune location prévue</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {reservations.map((res) => (
                  <div key={res.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800">{res.client}</p>
                      <p className="text-sm text-slate-500">{res.date}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-green-600">{res.montant}€</span>
                      <button onClick={() => handleDelete(res.id)} className="text-slate-300 hover:text-red-500">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Finances</h2>
            <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-blue-200 shadow-2xl">
              <p className="text-blue-100 text-sm mb-1 uppercase tracking-wider font-semibold">Revenus Totaux</p>
              <p className="text-4xl font-black">{totalRevenus.toLocaleString()} €</p>
              <div className="mt-4 pt-4 border-t border-blue-500 flex items-center gap-2 text-sm">
                <TrendingUp size={16} /> <span>{reservations.length} réservations au total</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL D'AJOUT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Nouvelle Réservation</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <input type="text" placeholder="Nom du client" className="w-full p-3 rounded-xl border border-slate-200" 
                value={newRes.client} onChange={e => setNewRes({...newRes, client: e.target.value})} />
              <input type="date" className="w-full p-3 rounded-xl border border-slate-200" 
                value={newRes.date} onChange={e => setNewRes({...newRes, date: e.target.value})} />
              <input type="number" placeholder="Montant (€)" className="w-full p-3 rounded-xl border border-slate-200" 
                value={newRes.montant} onChange={e => setNewRes({...newRes, montant: e.target.value})} />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-slate-500 font-bold">Annuler</button>
                <button type="submit" className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NAVIGATION BAS DE PAGE */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 md:hidden z-50">
        <button onClick={() => setActiveTab('planning')} className={`flex flex-col items-center p-2 ${activeTab === 'planning' ? 'text-blue-600' : 'text-slate-400'}`}>
          <Calendar size={24} /><span className="text-[10px] font-bold mt-1">PLANNING</span>
        </button>
        <button onClick={() => setActiveTab('finances')} className={`flex flex-col items-center p-2 ${activeTab === 'finances' ? 'text-blue-600' : 'text-slate-400'}`}>
          <Wallet size={24} /><span className="text-[10px] font-bold mt-1">FINANCES</span>
        </button>
      </footer>
    </div>
  );
};

export default App;
