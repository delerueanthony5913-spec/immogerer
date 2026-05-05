import React from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';

const DonutChart = ({ data, title }) => {
  const visibleData = (data || []).filter(d => d && d.value > 0);
  const displayTotal = visibleData.reduce((acc, curr) => acc + curr.value, 0);
  let cumulativePercent = 0;

  if (!displayTotal) {
    return (
      <div className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[40px] border border-gray-100 flex flex-col items-center justify-center min-h-[150px] md:min-h-[300px] shadow-sm">
        <PieChartIcon size={24} className="text-gray-200 mb-2" />
        <p className="text-gray-400 font-black text-[8px] md:text-[10px] uppercase tracking-widest text-center">{title}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 md:p-10 rounded-[24px] md:rounded-[48px] border border-gray-50 flex flex-col md:flex-row items-center gap-4 md:gap-10 animate-in fade-in shadow-xl shadow-slate-200/50 mx-2 md:mx-0">
      <div className="relative w-24 h-24 md:w-48 md:h-48 flex-shrink-0">
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
          <span className="text-[7px] md:text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-0.5 md:mb-1">Total Net</span>
          <span className="text-sm md:text-xl font-black text-slate-900">{Math.round(displayTotal).toLocaleString('fr-FR')}€</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-1.5 md:space-y-3">
        <h3 className="text-[9px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-2 md:mb-4 text-center md:text-left">{title}</h3>
        <div className="space-y-1 md:space-y-2">
          {visibleData.map((slice, i) => (
            <div key={i} className="flex items-center justify-between text-[9px] md:text-[11px] group">
              <div className="flex items-center gap-1.5 md:gap-3">
                <div className="w-1.5 h-1.5 md:w-3 md:h-3 rounded-full shadow-sm" style={{ backgroundColor: slice.color }}></div>
                <span className="font-bold text-slate-600 truncate max-w-[120px] md:max-w-[140px]">{slice.label}</span>
              </div>
              <span className="font-black text-slate-900 tabular-nums">{Math.round(slice.value).toLocaleString('fr-FR')} €</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DonutChart;
