import React from 'react';

const getPropertyColor = (propertyId, properties) => {
  const prop = (properties || []).find(p => p.id === propertyId);
  if (!prop?.name) return '#94A3B8';
  const name = prop.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (name.includes('cocon') || name.includes('kadelia')) return '#10B981';
  if (name.includes('signes') || name.includes('cadelio')) return '#3B82F6';
  if (name.includes('villa') || name.includes('cadelia')) return '#EAB308';
  return '#94A3B8';
};

const Agenda = ({ agendaDays, reservationsList, todayStr, properties, onEdit }) => {
  return (
    <div className="bg-white p-4 md:p-6 rounded-[32px] md:rounded-[40px] shadow-2xl overflow-x-auto mx-2 md:mx-0">
      <div className="min-w-[320px] md:min-w-[700px]">
        <div className="grid grid-cols-7 text-center font-black text-slate-300 text-[8px] md:text-[10px] uppercase mb-4">
          {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {(agendaDays || []).map((item, idx) => {
            const dayRes = (reservationsList || []).filter(r => item.dateStr >= r.startDate && item.dateStr <= r.endDate);
            const isToday = item.dateStr === todayStr;
            const isOther = item.otherMonth;
            return (
              <div key={item.dateStr || idx} className={`h-16 md:h-32 border rounded-xl md:rounded-2xl p-1 md:p-2 flex flex-col transition-colors ${isToday ? 'border-blue-400 bg-blue-50/30' : isOther ? 'border-slate-100 bg-slate-50/60' : 'border-slate-100 bg-white'}`}>
                <span className={`text-[8px] md:text-[10px] font-black ${isToday ? 'text-blue-500' : isOther ? 'text-slate-300' : 'text-slate-400'}`}>{item.day}</span>
                <div className="flex-1 space-y-0.5 overflow-y-auto no-scrollbar">
                  {dayRes.map(r => {
                    const color = getPropertyColor(r.propertyId, properties);
                    return (
                      <div
                        key={r.id}
                        onClick={() => onEdit(r)}
                        className="text-[6px] md:text-[8px] font-black text-white p-0.5 rounded truncate cursor-pointer"
                        style={{ backgroundColor: color, opacity: isOther ? 0.55 : 1 }}
                      >
                        {r.name?.split(' ')[0]}
                      </div>
                    );
                  })}
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
