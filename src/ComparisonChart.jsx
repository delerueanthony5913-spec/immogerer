import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { CHART_COLORS } from './utils';

const ComparisonChart = ({ data, properties, platforms, yearsAvailable = [] }) => {
  const currentYear = new Date().getFullYear().toString();
  const [mode, setMode] = useState('years'); 
  const [metric, setMetric] = useState('net'); 
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [contextYear, setContextYear] = useState(currentYear);
  const [contextProp, setContextProp] = useState('all');
  const [contextPlat, setContextPlat] = useState('all');

  const safeData = Array.isArray(data) ? data : [];
  const safeYears = yearsAvailable.length > 0 ? yearsAvailable : [currentYear];

  useEffect(() => {
    if (mode === 'years') setSelectedKeys(safeYears.slice(0, 3)); 
    if (mode === 'properties') setSelectedKeys(properties.map(p => p.id).slice(0, 4)); 
    if (mode === 'platforms') setSelectedKeys(platforms.slice(0, 4)); 
  }, [mode, properties, platforms, safeYears]);

  const toggleKey = (key) => {
    setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const buildSeriesFor = (targetYear, targetProp, targetPlat) => {
      const res = Array(12).fill(0);
      const prov = Array(12).fill(false);
      const processItem = (dateStr, amount, isProv) => {
          if (!dateStr || !dateStr.startsWith(targetYear)) return;
          const m = parseInt(dateStr.split('-')[1], 10) - 1;
          if (m >= 0 && m <= 11) {
              res[m] += amount;
              if (isProv) prov[m] = true;
          }
      };

      safeData.forEach(t => {
          if (targetProp !== 'all' && t.propertyId !== targetProp) return;
          if (targetPlat !== 'all' && t.platform !== targetPlat) return;
          const isDirect = t.platform === 'En direct';
          const expectedDate = t.endDate || t.startDate || `${targetYear}-12-31`;
          const g = parseFloat(t.grossAmount) || 0;
          const n = parseFloat(t.netAmount) || 0;
          const tax = t.isUrssaf !== false ? g * 0.077 : 0;
          let totalPaidGross = 0;

          if (metric === 'net' || metric === 'gross') {
              if (isDirect) {
                  const a1 = parseFloat(t.acompte1Amount) || 0;
                  const a2 = parseFloat(t.acompte2Amount) || 0;
                  const s = parseFloat(t.soldeAmount) || 0;
                  if (t.acompte1Date) { processItem(t.acompte1Date, a1, false); totalPaidGross += a1; }
                  if (t.acompte2Date) { processItem(t.acompte2Date, a2, false); totalPaidGross += a2; }
                  if (t.soldeDate) { processItem(t.soldeDate, s, false); if (metric === 'net' && tax > 0) processItem(t.soldeDate, -tax, false); totalPaidGross += s; }
                  if (!t.soldeDate) {
                      const remaining = g - totalPaidGross;
                      if (remaining > 0) processItem(expectedDate, remaining, true);
                      if (metric === 'net' && tax > 0) processItem(expectedDate, -tax, true);
                  }
              } else {
                  if (t.paymentDate) { processItem(t.paymentDate, metric === 'gross' ? g : n, false); if (metric === 'net' && tax > 0) processItem(t.paymentDate, -tax, false); }
                  else { processItem(expectedDate, metric === 'gross' ? g : n, true); if (metric === 'net' && tax > 0) processItem(expectedDate, -tax, true); }
              }
          }
          if (metric === 'net' || metric === 'expenses') {
              (t.resExpenses || []).forEach(exp => {
                  const amt = parseFloat(exp.amount) || 0;
                  if (exp.paymentDate) processItem(exp.paymentDate, metric === 'expenses' ? amt : -amt, false);
                  else processItem(expectedDate, metric === 'expenses' ? amt : -amt, true);
              });
          }
      });

      let splitIndex = 11; 
      for (let i = 0; i < 12; i++) { if (prov[i]) { splitIndex = i - 1; break; } }
      return { data: res.map(val => isNaN(val) ? 0 : val), splitIndex };
  };

  const series = selectedKeys.map((key, index) => {
      let result; let label = '';
      if (mode === 'years') { result = buildSeriesFor(key, contextProp, contextPlat); label = key; }
      else if (mode === 'properties') { result = buildSeriesFor(contextYear, key, contextPlat); label = properties.find(p=>p.id===key)?.name || 'Inconnu'; }
      else if (mode === 'platforms') { result = buildSeriesFor(contextYear, contextProp, key); label = key; }

      return {
          id: key, label, data: result.data, color: CHART_COLORS[index % CHART_COLORS.length],
          total: result.data.reduce((acc, val) => acc + val, 0), splitIndex: result.splitIndex
      };
  });

  const [hoveredMonth, setHoveredMonth] = useState(null);
  const months = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  const allDataValues = series.reduce((acc, currentSeries) => acc.concat(currentSeries.data), []);
  const maxValRaw = Math.max(...allDataValues, 100);
  const maxVal = (!isFinite(maxValRaw) || maxValRaw <= 0) ? 100 : maxValRaw * 1.15;

  const w = 900, h = 300, padX = 60, padY = 30; 
  const getX = (i) => padX + (i * (w - 2 * padX) / 11);
  const getY = (val) => isNaN(val) || !maxVal || maxVal === 0 ? h - padY : h - padY - ((val / maxVal) * (h - 2 * padY));

  const buildPath = (dArr, start, end) => {
    if (start > end || start < 0) return '';
    const points = [];
    for (let i = start; i <= end; i++) {
        const x = getX(i); const y = getY(dArr[i]);
        if (!isNaN(x) && !isNaN(y)) points.push(`${x},${y}`);
    }
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0]} L ${points[0]}`;
    return `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(' ');
  };

  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];
  const availableOptions = mode === 'years' ? safeYears.map(y => ({ id: y, label: y })) : mode === 'properties' ? properties.map(p => ({ id: p.id, label: p.name })) : platforms.map(p => ({ id: p, label: p }));

  return (
    <div className="w-auto mx-2 md:mx-0 bg-white p-4 md:p-8 rounded-[32px] md:rounded-[48px] shadow-2xl border border-slate-50 animate-in fade-in relative mt-8">
      <div className="flex bg-slate-100 p-1.5 rounded-[20px] w-max mb-6">
         <button onClick={()=>{setMode('years'); setContextProp('all'); setContextPlat('all');}} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'years' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>📅 Années</button>
         <button onClick={()=>{setMode('properties'); setContextYear(currentYear); setContextPlat('all');}} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'properties' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>🏠 Logements</button>
         <button onClick={()=>{setMode('platforms'); setContextYear(currentYear); setContextProp('all');}} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'platforms' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>💻 Platefs.</button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6 bg-slate-50 p-3 rounded-[24px] border border-slate-100">
         <div className="flex-1">
            <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 mb-2 block">Cochez :</span>
            <div className="flex flex-wrap gap-1.5">
               {availableOptions.map((opt) => {
                  const isSelected = selectedKeys.includes(opt.id);
                  const color = isSelected ? CHART_COLORS[selectedKeys.indexOf(opt.id) % CHART_COLORS.length] : '#CBD5E1';
                  return <button key={opt.id} onClick={() => toggleKey(opt.id)} className={`px-2.5 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border ${isSelected ? 'bg-white shadow-sm border-transparent' : 'bg-transparent border-slate-200 text-slate-400'}`} style={{ color: isSelected ? color : undefined }}><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>{opt.label}</button>;
               })}
            </div>
         </div>
         <div className="flex flex-col gap-2 min-w-full md:min-w-[200px]">
             <select value={metric} onChange={e=>setMetric(e.target.value)} className="w-full bg-slate-900 text-white rounded-xl px-2 py-1.5 text-[8px] md:text-[10px] font-black uppercase outline-none shadow-md cursor-pointer"><option value="net">Profit Net Réel</option><option value="gross">CA Brut</option><option value="expenses">Coût Prestations</option></select>
             <div className="flex flex-col gap-1 pl-1">
                 {mode !== 'years' && <select value={contextYear} onChange={e=>setContextYear(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[8px] md:text-[10px] font-bold text-slate-700">{safeYears.map(y=><option key={y} value={y}>Année {y}</option>)}</select>}
                 {mode !== 'properties' && <select value={contextProp} onChange={e=>setContextProp(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[8px] md:text-[10px] font-bold text-slate-700"><option value="all">Tous Logements</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}
                 {mode !== 'platforms' && <select value={contextPlat} onChange={e=>setContextPlat(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[8px] md:text-[10px] font-bold text-slate-700"><option value="all">Toutes Plateformes</option>{platforms.map(p=><option key={p} value={p}>{p}</option>)}</select>}
             </div>
         </div>
      </div>

      <div className="overflow-x-auto hide-scroll touch-manipulation">
        <div className="min-w-[450px] md:min-w-[600px] relative">
          <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            {yTicks.map((tick, i) => (
              <g key={`grid-${i}`}><line x1={padX} y1={getY(tick)} x2={w - padX} y2={getY(tick)} stroke="#F1F5F9" strokeWidth="2" /><text x={w - padX + 8} y={getY(tick) + 4} fill="#475569" fontSize="11" fontWeight="900">{tick >= 1000 ? (tick / 1000).toFixed(1) + 'k€' : Math.round(tick) + '€'}</text></g>
            ))}
            {months.map((m, i) => (
              <text key={m} x={getX(i)} y={h - 5} fill={hoveredMonth === i ? "#0F172A" : "#94A3B8"} fontSize="12" fontWeight="900" textAnchor="middle" onMouseEnter={() => setHoveredMonth(i)} onMouseLeave={() => setHoveredMonth(null)}>{m}</text>
            ))}
            {series.map((s) => (
               <g key={`series-${s.id}`}>
                  <path d={buildPath(s.data, 0, Math.max(0, s.splitIndex))} stroke={s.color} strokeWidth="4" fill="none" strokeLinecap="round" className="transition-all duration-500" />
                  <path d={buildPath(s.data, Math.max(0, s.splitIndex), 11)} stroke={s.color} strokeWidth="4" fill="none" strokeDasharray="6 8" strokeLinecap="round" className="transition-all duration-500" />
               </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
};

export default ComparisonChart;
