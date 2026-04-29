import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Layout, Calendar, Wallet, Building2, Menu, X, Plus, Trash2, ChevronRight } from 'lucide-react';

// --- CONFIGURATION FIREBASE DIRECTE ---
const firebaseConfig = {
  apiKey: "AIzaSyAs-v0Xexample-key-replace-this",
  authDomain: "immogerer-prod.firebaseapp.com",
  projectId: "immogerer-prod",
  storageBucket: "immogerer-prod.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const App = () => {
  const [activeTab, setActiveTab] = useState('planning');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Barre de navigation supérieure */}
      <nav className="bg-blue-600 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Building2 size={24} />
            <span className="text-xl font-bold tracking-tight">IMMOGÉRER</span>
          </div>
          
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden">
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className="hidden md:flex space-x-6">
            <button onClick={() => setActiveTab('planning')} className={`flex items-center space-x-1 ${activeTab === 'planning' ? 'text-white border-b-2' : 'text-blue-100'}`}>
              <Calendar size={18} /><span>Planning</span>
            </button>
            <button onClick={() => setActiveTab('finances')} className={`flex items-center space-x-1 ${activeTab === 'finances' ? 'text-white border-b-2' : 'text-blue-100'}`}>
              <Wallet size={18} /><span>Finances</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Menu Mobile */}
      {isMenuOpen && (
        <div className="md:hidden bg-blue-700 text-white p-4 space-y-4 shadow-xl">
          <button onClick={() => {setActiveTab('planning'); setIsMenuOpen(false)}} className="flex items-center space-x-3 w-full p-2 border-b border-blue-500">
            <Calendar size={20} /><span>Planning des locations</span>
          </button>
          <button onClick={() => {setActiveTab('finances'); setIsMenuOpen(false)}} className="flex items-center space-x-3 w-full p-2">
            <Wallet size={20} /><span>Suivi des Finances</span>
          </button>
        </div>
      )}

      {/* Contenu Principal */}
      <main className="flex-grow p-4 max-w-6xl mx-auto w-full">
        {activeTab === 'planning' ? (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="text-blue-600" /> Planning
              </h2>
              <div className="bg-blue-50 p-4 rounded-xl text-blue-700 text-sm">
                Aucune réservation enregistrée pour le moment.
              </div>
              <button className="mt-4 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
                <Plus size={20} /> Ajouter une réservation
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center">
            <Wallet size={48} className="mx-auto text-blue-200 mb-4" />
            <h2 className="text-xl font-bold text-slate-800">Section Finances</h2>
            <p className="text-slate-500 mt-2">Le suivi de vos revenus sera disponible ici.</p>
          </div>
        )}
      </main>

      {/* Footer Mobile Rapide */}
      <footer className="md:hidden bg-white border-t border-slate-200 p-2 flex justify-around sticky bottom-0 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('planning')} className={`flex flex-col items-center p-2 ${activeTab === 'planning' ? 'text-blue-600' : 'text-slate-400'}`}>
          <Calendar size={20} />
          <span className="text-xs mt-1">Planning</span>
        </button>
        <button onClick={() => setActiveTab('finances')} className={`flex flex-col items-center p-2 ${activeTab === 'finances' ? 'text-blue-600' : 'text-slate-400'}`}>
          <Wallet size={20} />
          <span className="text-xs mt-1">Finances</span>
        </button>
      </footer>
    </div>
  );
};

export default App;
