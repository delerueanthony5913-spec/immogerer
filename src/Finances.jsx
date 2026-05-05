import React from 'react';
import { TrendingUp, TrendingDown, Euro } from 'lucide-react';

const Finances = ({ baseTenants, properties }) => {
  // On reprend tes calculs exacts
  const stats = baseTenants.reduce((acc, t) => {
    const g = parseFloat(t.grossAmount) || 0;
    const n = parseFloat(t.netAmount) || 0;
    const tax = t.isUrssaf !== false ? g * 0.077 : 0;
    const exp = (t.resExpenses || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    
    acc.gross += g;
    acc.net += n - tax - exp;
    acc.tax += tax;
    acc.expenses += exp;
    return acc;
  }, { gross: 0, net: 0, tax: 0, expenses: 0 });

  return (
    <div className="space-y-6">
      {/* Tes 4 cartes de résumé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Brut', val: stats.gross, icon: <Euro />, col: 'text-blue-600' },
          { label: 'Net Réel', val: stats.net, icon: <TrendingUp />, col: 'text-emerald-600' },
          { label: 'Charges', val: stats.tax, icon: <TrendingDown />, col: 'text-orange-600' },
          { label: 'Prestataires', val: stats.expenses, icon: <TrendingDown />, col: 'text-red-600' }
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] shadow-xl border border-slate-50">
            <div className={`${s.col} mb-2`}>{s.icon}</div>
            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">{s.label}</div>
            <div className="text-xl font-black">{Math.round(s.val)}€</div>
          </div>
        ))}
      </div>

      {/* Ton grand tableau de compta */}
      <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-white uppercase text-[10px] font-black">
            <tr>
              <th className="p-5">Logement / Client</th>
              <th className="p-5">Brut</th>
              <th className="p-5">URSSAF</th>
              <th className="p-5">Presta</th>
              <th className="p-5 text-right">Profit Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {baseTenants.map(t => {
              const g = parseFloat(t.grossAmount) || 0;
              const tax = t.isUrssaf !== false ? g * 0.077 : 0;
              const exp = (t.resExpenses || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
              const profit = (parseFloat(t.netAmount) || 0) - tax - exp;
              
              return (
                <tr key={t.id} className="hover:bg-slate-50 font-bold">
                  <td className="p-5">
                    <div className="font-black uppercase">{properties.find(p => p.id === t.propertyId)?.name}</div>
                    <div className="text-slate-400">{t.name}</div>
                  </td>
                  <td className="p-5 font-black">{g}€</td>
                  <td className="p-5 text-orange-500">-{tax.toFixed(2)}€</td>
                  <td className="p-5 text-red-500">-{exp}€</td>
                  <td className="p-5 text-right font-black text-emerald-600">{profit.toFixed(2)}€</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Finances;
