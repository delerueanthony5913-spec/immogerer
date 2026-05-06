import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Euro, Calendar, Home, BarChart2 } from 'lucide-react';

const SERIES_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const DONUT_COLORS  = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f43f5e','#84cc16'];
const MONTHS        = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

const METRICS = [
  { id:'gross',    label:'CA Brut',     unit:'€' },
  { id:'profit',   label:'Profit Net',  unit:'€' },
  { id:'charges',  label:'Charges',     unit:'€' },
  { id:'nights',   label:'Nuits',       unit:'nuits' },
  { id:'count',    label:'Réservations',unit:'' },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

const addPayments = (t, data, year) => {
  const add = (date, amt) => {
    if (!date || !amt) return;
    if (year !== 'all' && date.slice(0,4) !== String(year)) return;
    data[parseInt(date.slice(5,7))-1] += amt;
  };
  if (t.platform === 'En direct') {
    add(t.acompte1Date, parseFloat(t.acompte1Amount)||0);
    add(t.acompte2Date, parseFloat(t.acompte2Amount)||0);
    add(t.soldeDate,    parseFloat(t.soldeAmount)||0);
  } else {
    add(t.paymentDate, parseFloat(t.grossAmount)||0);
  }
};

const matchFilters = (t, year, propId, platform) => {
  if (!t.startDate) return false;
  if (year     !== 'all' && t.startDate.slice(0,4) !== String(year))  return false;
  if (propId   !== 'all' && t.propertyId !== propId)                   return false;
  if (platform !== 'all' && t.platform   !== platform)                 return false;
  return true;
};

const getRevByMonth = (tenants, year, propId, platform) => {
  const data = Array(12).fill(0);
  tenants.filter(t => matchFilters(t, year, propId, platform)).forEach(t => addPayments(t, data, year));
  return data;
};

const getChargesByMonth = (tenants, year, propId) => {
  const data = Array(12).fill(0);
  tenants.forEach(t => {
    if (propId !== 'all' && t.propertyId !== propId) return;
    (t.resExpenses||[]).forEach(exp => {
      if (!exp.paymentDate) return;
      if (year !== 'all' && exp.paymentDate.slice(0,4) !== String(year)) return;
      data[parseInt(exp.paymentDate.slice(5,7))-1] += parseFloat(exp.amount)||0;
    });
  });
  return data;
};

const getNightsByMonth = (tenants, year, propId, platform) => {
  const data = Array(12).fill(0);
  tenants.filter(t => matchFilters(t, year, propId, platform)).forEach(t => {
    const n = Math.max(0, Math.round((new Date(t.endDate)-new Date(t.startDate))/86400000));
    data[parseInt(t.startDate.slice(5,7))-1] += n;
  });
  return data;
};

const getCountByMonth = (tenants, year, propId, platform) => {
  const data = Array(12).fill(0);
  tenants.filter(t => matchFilters(t, year, propId, platform)).forEach(t => {
    data[parseInt(t.startDate.slice(5,7))-1]++;
  });
  return data;
};

const computeKPIs = (tenants, year, propId, platform) => {
  let gross=0, nights=0, charges=0, count=0;
  tenants.filter(t => matchFilters(t, year, propId, platform)).forEach(t => {
    count++;
    gross   += parseFloat(t.grossAmount)||0;
    nights  += Math.max(0, Math.round((new Date(t.endDate)-new Date(t.startDate))/86400000));
    (t.resExpenses||[]).forEach(e => { charges += parseFloat(e.amount)||0; });
  });
  return { gross, nights, charges, profit: gross-charges, count, revPerNight: nights>0?gross/nights:0 };
};

const getPlatformBreakdown = (tenants, year, propId) => {
  const m = {};
  tenants.filter(t => matchFilters(t, year, propId, 'all')).forEach(t => {
    m[t.platform] = (m[t.platform]||0) + (parseFloat(t.grossAmount)||0);
  });
  return Object.entries(m).sort((a,b)=>b[1]-a[1]);
};

const getPropBreakdown = (tenants, properties, year, platform) => {
  const m = {};
  tenants.filter(t => matchFilters(t, year, 'all', platform)).forEach(t => {
    m[t.propertyId] = (m[t.propertyId]||0) + (parseFloat(t.grossAmount)||0);
  });
  return Object.entries(m).map(([id,val])=>[properties.find(p=>p.id===id)?.name||id, val]).sort((a,b)=>b[1]-a[1]);
};

const trend = (curr, prev) => prev>0 ? Math.round(((curr-prev)/prev)*100) : null;

// ─── SVG Line Chart ────────────────────────────────────────────────────────────

const LineChart = ({ series, labels, unit='€' }) => {
  const [tooltip, setTooltip] = useState(null);
  const W=760, H=260, PL=58, PR=20, PT=16, PB=28;
  const plotW=W-PL-PR, plotH=H-PT-PB;
  const allVals = series.flatMap(s=>s.data);
  const maxVal  = Math.max(...allVals, 1);
  const GRIDS   = 5;

  const xS = i => PL + (i/Math.max(labels.length-1,1))*plotW;
  const yS = v => PT + plotH - (v/maxVal)*plotH;

  const smooth = data => {
    const pts = data.map((v,i)=>[xS(i), yS(v)]);
    if (!pts.length) return '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i=1;i<pts.length;i++) {
      const cpx=(pts[i][0]-pts[i-1][0])/2.8;
      d+=` C ${pts[i-1][0]+cpx} ${pts[i-1][1]}, ${pts[i][0]-cpx} ${pts[i][1]}, ${pts[i][0]} ${pts[i][1]}`;
    }
    return d;
  };
  const area = data => `${smooth(data)} L ${xS(data.length-1)} ${PT+plotH} L ${xS(0)} ${PT+plotH} Z`;

  const fmt = v => unit==='€'
    ? (v>=1000?`${(v/1000).toFixed(v>=10000?0:1)}k€`:`${Math.round(v)}€`)
    : Math.round(v).toString();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{height:H}}>
      <defs>
        {series.map((s,si)=>(
          <linearGradient key={si} id={`lg${si}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.18"/>
            <stop offset="100%" stopColor={s.color} stopOpacity="0"/>
          </linearGradient>
        ))}
      </defs>

      {Array.from({length:GRIDS+1}).map((_,i)=>{
        const y=PT+(i/GRIDS)*plotH;
        const v=maxVal*(1-i/GRIDS);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="#f1f5f9" strokeWidth="1"/>
            <text x={PL-5} y={y+4} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="system-ui">{fmt(v)}</text>
          </g>
        );
      })}

      {labels.map((lbl,i)=>(
        <text key={i} x={xS(i)} y={H-5} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="system-ui">{lbl}</text>
      ))}

      {series.map((s,si)=>(
        <g key={si}>
          <path d={area(s.data)} fill={`url(#lg${si})`}/>
          <path d={smooth(s.data)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round"/>
          {s.data.map((v,i)=>(
            <circle key={i} cx={xS(i)} cy={yS(v)} r="4.5" fill={s.color} stroke="white" strokeWidth="2"
              onMouseEnter={()=>setTooltip({x:xS(i),y:yS(v),name:s.name,label:labels[i],value:v,color:s.color})}
              onMouseLeave={()=>setTooltip(null)} style={{cursor:'pointer'}}/>
          ))}
        </g>
      ))}

      {tooltip&&(()=>{
        const tx = tooltip.x > W-140 ? tooltip.x-145 : tooltip.x+12;
        const ty = tooltip.y < 50    ? tooltip.y+8   : tooltip.y-42;
        return (
          <g>
            <line x1={tooltip.x} y1={PT} x2={tooltip.x} y2={PT+plotH} stroke={tooltip.color} strokeWidth="1" strokeDasharray="4 2" opacity="0.4"/>
            <rect x={tx} y={ty} width="130" height="36" rx="8" fill="white" stroke={tooltip.color} strokeWidth="1.5" style={{filter:'drop-shadow(0 4px 8px rgba(0,0,0,0.12))'}}/>
            <text x={tx+65} y={ty+13} textAnchor="middle" fontSize="8.5" fill="#64748b" fontFamily="system-ui">{tooltip.name} · {tooltip.label}</text>
            <text x={tx+65} y={ty+28} textAnchor="middle" fontSize="13" fontWeight="bold" fill={tooltip.color} fontFamily="system-ui">{fmt(tooltip.value)}</text>
          </g>
        );
      })()}
    </svg>
  );
};

// ─── Donut ─────────────────────────────────────────────────────────────────────

const Donut = ({ data, colors }) => {
  const [hov, setHov] = useState(null);
  const total = data.reduce((s,[,v])=>s+v,0);
  const r=38, cx=50, cy=50, circ=2*Math.PI*r;
  let cum=0;
  const segs = data.slice(0,7).map(([name,value],i)=>{
    const pct=total>0?value/total:0;
    const da=pct*circ, doff=circ*(1-cum);
    cum+=pct;
    return {name,value,pct,da,doff,color:colors[i%colors.length],i};
  });
  const disp = hov!==null ? data[hov] : null;
  return (
    <div>
      <svg viewBox="0 0 100 100" className="w-32 h-32 mx-auto">
        {segs.map(s=>(
          <circle key={s.i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
            strokeWidth={hov===s.i?20:15}
            strokeDasharray={`${s.da} ${circ-s.da}`}
            strokeDashoffset={s.doff}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{cursor:'pointer',transition:'stroke-width 0.15s'}}
            onMouseEnter={()=>setHov(s.i)} onMouseLeave={()=>setHov(null)}/>
        ))}
        <circle cx={cx} cy={cy} r="24" fill="white"/>
        <text x={cx} y={cy-4} textAnchor="middle" fontSize="6" fill="#94a3b8" fontFamily="system-ui">
          {disp ? (disp[0].length>12?disp[0].slice(0,12)+'…':disp[0]) : 'Total'}
        </text>
        <text x={cx} y={cy+7} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1e293b" fontFamily="system-ui">
          {disp ? `${Math.round(disp[1]/1000)}k€` : `${Math.round(total/1000)}k€`}
        </text>
      </svg>
      <div className="space-y-1 mt-2">
        {segs.map(s=>(
          <div key={s.i} className={`flex items-center justify-between text-[8px] px-1.5 py-1 rounded-xl cursor-default transition-colors ${hov===s.i?'bg-slate-50':''}`}
            onMouseEnter={()=>setHov(s.i)} onMouseLeave={()=>setHov(null)}>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:s.color}}/>
              <span className="font-bold text-slate-600 truncate">{s.name}</span>
            </div>
            <div className="flex items-center gap-1 ml-1 flex-shrink-0">
              <span className="font-black text-slate-800">{Math.round(s.value).toLocaleString('fr-FR')}€</span>
              <span className="text-slate-400">({Math.round(s.pct*100)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Bars ──────────────────────────────────────────────────────────────────────

const MiniBar = ({ data, labels, color, unit='nuits' }) => {
  const [hov, setHov] = useState(null);
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5" style={{height:100}}>
      {data.map((v,i)=>(
        <div key={i} className="flex-1 flex flex-col items-center justify-end relative"
          onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}>
          {hov===i && v>0 && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[7px] font-black px-1.5 py-0.5 rounded-lg whitespace-nowrap z-10">
              {v} {unit}
            </div>
          )}
          <div className="w-full rounded-t-sm transition-all duration-300"
            style={{height:`${(v/max)*88}px`,background:hov===i?color+'cc':color,minHeight:v>0?2:0}}/>
          <span className="text-[6.5px] text-slate-400 font-bold mt-0.5">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
};

const GroupBar = ({ data, labels }) => {
  const [hov, setHov] = useState(null);
  const max = Math.max(...data.map(([g])=>g), 1);
  return (
    <div className="flex items-end gap-1" style={{height:100}}>
      {data.map(([gross, charges],i)=>(
        <div key={i} className="flex-1 flex items-end gap-0.5"
          onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}>
          <div className="relative flex-1">
            {hov===i && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[7px] font-black px-1.5 py-0.5 rounded-lg whitespace-nowrap z-10">
                {Math.round(gross).toLocaleString('fr-FR')}€
              </div>
            )}
            <div className="w-full rounded-t-sm" style={{height:`${(gross/max)*88}px`,background:'#3b82f6',minHeight:gross>0?2:0}}/>
          </div>
          <div className="w-2 rounded-t-sm" style={{height:`${(charges/max)*88}px`,background:'#f43f5e',minHeight:charges>0?1:0}}/>
        </div>
      ))}
      <div className="absolute bottom-0 flex gap-2">
      </div>
    </div>
  );
};

// ─── KPI Card ──────────────────────────────────────────────────────────────────

const KPI = ({ label, value, sub, trend: t, color='blue', icon }) => {
  const cls = {blue:'text-blue-600',emerald:'text-emerald-600',violet:'text-violet-600',amber:'text-amber-500',rose:'text-rose-500',slate:'text-slate-700'};
  return (
    <div className="bg-white rounded-[22px] p-4 shadow-lg border border-slate-50 flex flex-col gap-1">
      <div className="flex items-start justify-between">
        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-tight">{label}</p>
        {icon && <div className={`opacity-15 ${cls[color]}`}>{icon}</div>}
      </div>
      <p className={`text-xl md:text-2xl font-black leading-none ${cls[color]}`}>{value}</p>
      {sub && <p className="text-[8px] text-slate-400 font-bold">{sub}</p>}
      {t!==null && t!==undefined && (
        <div className={`mt-1 self-start flex items-center gap-1 text-[7px] font-black px-2 py-0.5 rounded-full ${t>=0?'bg-emerald-50 text-emerald-600':'bg-rose-50 text-rose-500'}`}>
          {t>=0?<TrendingUp size={8}/>:<TrendingDown size={8}/>} {t>=0?'+':''}{t}% vs N-1
        </div>
      )}
    </div>
  );
};

// ─── Toggle Button ─────────────────────────────────────────────────────────────

const Toggle = ({ label, active, color, onClick }) => (
  <button onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all"
    style={{background: active ? color : '#1e293b', color:'white', opacity: active ? 1 : 0.5}}>
    {active && <span className="w-1.5 h-1.5 rounded-full bg-white inline-block"/>}
    {label}
  </button>
);

// ─── Main ──────────────────────────────────────────────────────────────────────

const Statistiques = ({ tenants, properties, availablePlatforms }) => {
  const curYear = new Date().getFullYear();

  const availableYears = useMemo(()=>{
    const s=new Set(tenants.map(t=>t.startDate?.slice(0,4)).filter(Boolean));
    return Array.from(s).sort((a,b)=>b-a);
  },[tenants]);

  const [mode,           setMode]           = useState('years');
  const [selYears,       setSelYears]       = useState([String(curYear)]);
  const [selProps,       setSelProps]       = useState(properties.slice(0,1).map(p=>p.id));
  const [selMetrics,     setSelMetrics]     = useState(['gross','profit']);
  const [filterYear,     setFilterYear]     = useState(String(curYear));
  const [filterProp,     setFilterProp]     = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');

  const toggle = (list, setList, item, max=5) => {
    if (list.includes(item)) { if (list.length>1) setList(list.filter(x=>x!==item)); }
    else if (list.length<max) setList([...list,item]);
  };

  // chart series
  const chartSeries = useMemo(()=>{
    if (mode==='years') return selYears.map((y,i)=>({
      name:y, color:SERIES_COLORS[i],
      data:getRevByMonth(tenants,y,filterProp,filterPlatform),
    }));
    if (mode==='properties') return selProps.map((pid,i)=>({
      name:properties.find(p=>p.id===pid)?.name||pid, color:SERIES_COLORS[i],
      data:getRevByMonth(tenants,filterYear,pid,filterPlatform),
    }));
    // metrics
    return selMetrics.map((mid,i)=>{
      const gross   = getRevByMonth(tenants,filterYear,filterProp,filterPlatform);
      const charges = getChargesByMonth(tenants,filterYear,filterProp);
      const data =
        mid==='gross'   ? gross :
        mid==='profit'  ? gross.map((v,j)=>Math.max(0,v-charges[j])) :
        mid==='charges' ? charges :
        mid==='nights'  ? getNightsByMonth(tenants,filterYear,filterProp,filterPlatform) :
                          getCountByMonth(tenants,filterYear,filterProp,filterPlatform);
      return { name:METRICS.find(m=>m.id===mid)?.label||mid, color:SERIES_COLORS[i], data };
    });
  },[mode,selYears,selProps,selMetrics,filterYear,filterProp,filterPlatform,tenants,properties]);

  const chartUnit = mode==='metrics' && selMetrics.every(m=>m==='nights'||m==='count') ? '' : '€';

  const kpis     = useMemo(()=>computeKPIs(tenants,filterYear,filterProp,filterPlatform),[tenants,filterYear,filterProp,filterPlatform]);
  const kpisPrev = useMemo(()=>{
    const py=filterYear==='all'?'all':String(parseInt(filterYear)-1);
    return computeKPIs(tenants,py,filterProp,filterPlatform);
  },[tenants,filterYear,filterProp,filterPlatform]);

  const platData  = useMemo(()=>getPlatformBreakdown(tenants,filterYear,filterProp),[tenants,filterYear,filterProp]);
  const propData  = useMemo(()=>getPropBreakdown(tenants,properties,filterYear,filterPlatform),[tenants,properties,filterYear,filterPlatform]);
  const nightData = useMemo(()=>getNightsByMonth(tenants,filterYear,filterProp,filterPlatform),[tenants,filterYear,filterProp,filterPlatform]);
  const barData   = useMemo(()=>{
    const g=getRevByMonth(tenants,filterYear,filterProp,filterPlatform);
    const c=getChargesByMonth(tenants,filterYear,filterProp);
    return MONTHS.map((_,i)=>[g[i],c[i]]);
  },[tenants,filterYear,filterProp,filterPlatform]);

  return (
    <div className="space-y-5 px-2 md:px-0 pb-10">

      {/* ── FILTER BAR ── */}
      <div className="bg-slate-900 rounded-[28px] p-5 space-y-4">

        {/* Global filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest w-full">Filtres globaux</p>
          <select value={filterYear} onChange={e=>setFilterYear(e.target.value)}
            className="bg-slate-800 text-white text-[9px] font-black uppercase rounded-xl px-3 py-2 outline-none border border-slate-700 cursor-pointer">
            <option value="all">Toutes années</option>
            {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterProp} onChange={e=>setFilterProp(e.target.value)}
            className="bg-slate-800 text-white text-[9px] font-black uppercase rounded-xl px-3 py-2 outline-none border border-slate-700 cursor-pointer">
            <option value="all">Tous logements</option>
            {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterPlatform} onChange={e=>setFilterPlatform(e.target.value)}
            className="bg-slate-800 text-white text-[9px] font-black uppercase rounded-xl px-3 py-2 outline-none border border-slate-700 cursor-pointer">
            <option value="all">Toutes plateformes</option>
            {availablePlatforms.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="h-px bg-slate-800"/>

        {/* Mode */}
        <div className="space-y-2">
          <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Mode graphique principal</p>
          <div className="flex gap-2 flex-wrap">
            {[['years','Comparer années'],['properties','Comparer logements'],['metrics','Comparer métriques']].map(([m,lbl])=>(
              <button key={m} onClick={()=>setMode(m)}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-colors ${mode===m?'bg-blue-600 text-white':'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Series toggles */}
        <div className="space-y-2">
          <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">
            {mode==='years'?'Années à afficher (max 5)':mode==='properties'?'Logements à comparer (max 5)':'Métriques à afficher (max 5)'}
          </p>
          <div className="flex gap-2 flex-wrap">
            {mode==='years' && availableYears.map((y,idx)=>(
              <Toggle key={y} label={y} active={selYears.includes(y)}
                color={SERIES_COLORS[selYears.includes(y)?selYears.indexOf(y):idx%5]}
                onClick={()=>toggle(selYears,setSelYears,y)}/>
            ))}
            {mode==='properties' && properties.map((p,idx)=>(
              <Toggle key={p.id} label={p.name.split(' ')[0]} active={selProps.includes(p.id)}
                color={SERIES_COLORS[selProps.includes(p.id)?selProps.indexOf(p.id):idx%5]}
                onClick={()=>toggle(selProps,setSelProps,p.id)}/>
            ))}
            {mode==='metrics' && METRICS.map((m,idx)=>(
              <Toggle key={m.id} label={m.label} active={selMetrics.includes(m.id)}
                color={SERIES_COLORS[selMetrics.includes(m.id)?selMetrics.indexOf(m.id):idx%5]}
                onClick={()=>toggle(selMetrics,setSelMetrics,m.id)}/>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI label="CA Brut"      value={`${Math.round(kpis.gross).toLocaleString('fr-FR')}€`}   trend={trend(kpis.gross,kpisPrev.gross)}        color="blue"    icon={<Euro size={20}/>}/>
        <KPI label="Profit Net"   value={`${Math.round(kpis.profit).toLocaleString('fr-FR')}€`}  trend={trend(kpis.profit,kpisPrev.profit)}       color="emerald" icon={<TrendingUp size={20}/>}/>
        <KPI label="Charges"      value={`-${Math.round(kpis.charges).toLocaleString('fr-FR')}€`} color="rose"   icon={<BarChart2 size={20}/>}/>
        <KPI label="Nuits totales" value={kpis.nights}                                           sub={`${kpis.count} réservation${kpis.count>1?'s':''}`} trend={trend(kpis.nights,kpisPrev.nights)} color="violet" icon={<Calendar size={20}/>}/>
        <KPI label="Rev. / Nuit"  value={`${Math.round(kpis.revPerNight)}€`}                    trend={trend(kpis.revPerNight,kpisPrev.revPerNight)} color="amber"  icon={<Home size={20}/>}/>
        <KPI label="Taux charges" value={kpis.gross>0?`${Math.round((kpis.charges/kpis.gross)*100)}%`:'—'} sub="Charges / CA Brut" color="slate"/>
      </div>

      {/* ── LINE CHART ── */}
      <div className="bg-white rounded-[28px] shadow-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Évolution mensuelle</h3>
          <div className="flex flex-wrap gap-3">
            {chartSeries.map(s=>(
              <div key={s.name} className="flex items-center gap-1.5">
                <div className="w-6 h-1.5 rounded-full" style={{background:s.color}}/>
                <span className="text-[8px] font-black text-slate-600 uppercase">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
        <LineChart series={chartSeries} labels={MONTHS} unit={chartUnit}/>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Donut Plateformes */}
        <div className="bg-white rounded-[28px] shadow-lg p-5">
          <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-4">Par plateforme</h3>
          {platData.length>0
            ? <Donut data={platData} colors={DONUT_COLORS}/>
            : <p className="text-center text-[9px] text-slate-300 font-black py-8">Aucune donnée</p>}
        </div>

        {/* Donut Logements */}
        <div className="bg-white rounded-[28px] shadow-lg p-5">
          <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-4">Par logement</h3>
          {propData.length>0
            ? <Donut data={propData} colors={DONUT_COLORS}/>
            : <p className="text-center text-[9px] text-slate-300 font-black py-8">Aucune donnée</p>}
        </div>

        {/* Nuits + CA/Charges bars */}
        <div className="bg-white rounded-[28px] shadow-lg p-5 space-y-5">
          <div>
            <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-3">Nuits / mois</h3>
            <MiniBar data={nightData} labels={MONTHS} color="#8b5cf6" unit="nuits"/>
          </div>
          <div className="h-px bg-slate-50"/>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-widest">CA vs Charges</h3>
              <div className="flex gap-2">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-blue-500"/><span className="text-[7px] font-black text-slate-400 uppercase">CA</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-rose-400"/><span className="text-[7px] font-black text-slate-400 uppercase">Charges</span></div>
              </div>
            </div>
            <div className="relative">
              <GroupBar data={barData} labels={MONTHS}/>
              <div className="flex justify-between mt-1">
                {MONTHS.map((m,i)=><span key={i} className="flex-1 text-center text-[6px] text-slate-300 font-bold">{m}</span>)}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Statistiques;
