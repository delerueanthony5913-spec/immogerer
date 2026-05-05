import React from 'react';
import { CHART_COLORS } from './dateUtils';

const Agenda = ({ agendaDays, reservationsList, todayStr, properties, onEdit }) => {
  return (
    <div className="bg-white p-4 md:p-6 rounded-[32px] md:rounded-[40px] shadow-2xl overflow-x-auto mx-2 md:mx-0">
      <div className="min-w-[320px] md:min-w-[700px]">
        <div className="grid grid-cols-7 text-center font-black text-slate-300 text-[8px] md:text-[10px] uppercase mb-4">
          {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {(agendaDays || []).map((item, idx) => {
            if (item.empty) return <div key={idx} className="h-16 md:h-32 bg-slate-50/30 rounded-xl md:rounded-2xl"></div>;
            const dayRes = (reservationsList || []).filter(r => item.dateStr >= r.startDate && item.dateStr <= r.endDate);
            return (
              <div key={item.dateStr} className={`h-16 md:h-32 border rounded-xl md:rounded-2xl p-1 md:p-2 flex flex-col ${item.dateStr === todayStr ? 'border-blue-500 bg-blue-50/10' : 'border-slate-100'}`}>
                <span className="text-[8px] md:text-[10px] font-black text-slate-300">{item.day}</span>
                <div className="flex-1 space-y-0.5 overflow-y-auto no-scrollbar">
                  {dayRes.map(r => (
                    <div key={r.id} onClick={() => onEdit(r)} className="text-[6px] md:text-[8px] font-black text-white p-0.5 rounded truncate cursor-pointer" style={{ backgroundColor: CHART_COLORS[(properties || []).findIndex(p => p.id === r.propertyId) % CHART_COLORS.length] }}>
                      {r.name?.split(' ')[0]}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Agenda;
