import React from 'react';
import { ArrowRight, Mail, CheckCircle, Clock } from 'lucide-react';
import { formatDateFr } from './utils';

const ReservationList = ({ groupedList, properties, getRowColors, getStatusProps, onEdit, onQuickPay, providerEmails }) => {
  return (
    <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100">
      <div className="max-h-[70vh] overflow-y-auto custom-scrollbar relative">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 font-black uppercase border-b text-slate-400 sticky top-0 z-20 shadow-sm">
            <tr>
              <th className="p-4 w-[15%]">Logement</th>
              <th className="p-4 w-[15%]">Client</th>
              <th className="p-4 w-[12%] text-center">Dates</th>
              <th className="p-4 w-[25%]">Notes</th>
              <th className="p-4 w-[18%]">Prestations</th>
              <th className="p-4 text-right">Net</th>
              <th className="p-4 text-center">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 font-bold">
            {groupedList.map(item => {
              if (item.isSeparator) {
                return (
                  <tr key={item.id} className="bg-slate-100/50">
                    <td colSpan="7" className="p-3 text-center">
                      <span className="bg-slate-800 text-white px-5 py-2 rounded-[14px] text-[10px] font-black uppercase tracking-[0.2em] shadow-md inline-block">
                        {item.label}
                      </span>
                    </td>
                  </tr>
                );
              }

              const t = item;
              const colors = getRowColors(t.propertyId);
              const status = getStatusProps(t);

              return (
                <tr key={t.id} data-res-id={t.id} onClick={() => onEdit(t)} className={`${colors.bg} cursor-pointer hover:bg-slate-50 transition-colors`}>
                  <td className="p-4 uppercase">
                    <div className="font-black flex items-center gap-1.5">
                      {(properties || []).find(p => p.id === t.propertyId)?.name || '--'}
                      {(properties || []).find(p => p.id === t.propertyId)?.calendarId && !t.googleEventId && <span title="Non synchronisé Google Agenda"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400 inline"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>}
                    </div>
                    <div className="text-blue-600 text-xs font-black mt-0.5">{t.platform}</div>
                  </td>
                  <td className="p-4"><div className="text-sm font-black">{t.name}</div></td>
                  <td className="p-4 text-center text-slate-500 whitespace-nowrap">
                    {formatDateFr(t.startDate)} <ArrowRight size={10} className="inline text-slate-300" /> {formatDateFr(t.endDate)}
                  </td>
                  <td className="p-4 text-[11px] text-slate-600 font-medium italic">
                    {t.comment ? `📝 ${t.comment}` : ''}
                  </td>
                  <td className="p-4">
                    <div className="space-y-1.5">
                      {(t.resExpenses || []).map((exp, idx) => {
                        const hasEmail = exp.sendEmail !== false && providerEmails[exp.person] && !exp.person.toLowerCase().includes('dias');
                        return (
                        <div key={idx} onClick={(e) => onQuickPay(e, t, 'expense', exp.id)} className="flex items-center justify-between text-[10px] bg-white/50 p-1.5 rounded-lg border border-slate-100/50">
                          <span className="uppercase font-black text-slate-500 flex items-center gap-1">
                            {exp.type} ({exp.person})
                            {hasEmail && (t.googleEventId ? <CheckCircle size={10} className="text-emerald-500 flex-shrink-0" title="Invitation envoyée"/> : <Mail size={10} className="text-orange-400 flex-shrink-0" title="Invitation non encore synchronisée"/>)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={exp.paymentDate ? 'text-emerald-600' : 'text-orange-500'}>{exp.amount}€</span>
                            {exp.paymentDate ? <CheckCircle size={10} className="text-emerald-500" /> : <Clock size={10} className="text-orange-400" />}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="p-4 text-right font-black">{(parseFloat(t.netAmount) || 0).toFixed(2)}€</td>
                  <td className="p-4 text-center">
                    <span onClick={(e) => onQuickPay(e, t, 'global')} className={`px-4 py-2 rounded-full text-[9px] uppercase inline-block ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReservationList;
