import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const SC = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f43f5e','#84cc16'];
const DC = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f43f5e','#84cc16'];
const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const METRICS = [
  { id:'gross',   label:'CA Brut',      u:'€' },
  { id:'profit',  label:'Profit Net',   u:'€' },
  { id:'charges', label:'Charges',      u:'€' },
  { id:'nights',  label:'Nuits',        u:'nuits' },
  { id:'count',   label:'Réservations', u:'' },
];

/* ── filtres ── */

const matchMulti = (t, selY, selP, selPl) => {
  if (!t.startDate) return false;
  if (selY.length  > 0 && !selY.includes(t.startDate.slice(0,4))) return false;
  if (selP.length  > 0 && !selP.includes(t.propertyId))           return false;
  if (selPl.length > 0 && !selPl.includes(t.platform))            return false;
  return true;
};

/* ── données mensuelles (générique) ── */

const getMonthly = (tenants, selY, selP, selPl, metric, chargeType = 'all') => {
  const data = Array(12).fill(0);
  tenants.filter(t => matchMulti(t, selY, selP, selPl)).forEach(t => {
    const sm  = t.startDate ? parseInt(t.startDate.slice(5,7))-1 : -1;
    const g   = parseFloat(t.grossAmount)||0;

    const addDate = (date, amt) => {
      if (!date || !amt) return;
      if (selY.length === 1 && date.slice(0,4) !== selY[0]) return;
      data[parseInt(date.slice(5,7))-1] += amt;
    };

    if (metric === 'nights') {
      if (sm >= 0) data[sm] += Math.max(0, Math.round((new Date(t.endDate)-new Date(t.startDate))/86400000));
    } else if (metric === 'count') {
      if (sm >= 0) data[sm]++;
    } else {
      if (metric === 'gross' || metric === 'profit') {
        if (t.platform === 'En direct') {
          addDate(t.acompte1Date, parseFloat(t.acompte1Amount)||0);
          addDate(t.acompte2Date, parseFloat(t.acompte2Amount)||0);
          addDate(t.soldeDate,    parseFloat(t.soldeAmount)||0);
        } else {
          addDate(t.paymentDate, g);
        }
      }
      if (metric === 'charges' || metric === 'profit') {
        const sign = metric === 'profit' ? -1 : 1;
        if (chargeType !== 'urssaf') {
          (t.resExpenses||[]).forEach(e => addDate(e.paymentDate, sign*(parseFloat(e.amount)||0)));
        }
        if (chargeType !== 'prestataires' && t.isUrssaf !== false && sm >= 0) {
          if (!selY.length || selY.includes(t.startDate.slice(0,4))) data[sm] += sign * g * 0.077;
        }
      }
    }
  });
  if (metric === 'profit') return data.map(v => Math.max(0, v));
  return data;
};

/* Prévisionnel basé sur la date de début de séjour */
const getForecast = (tenants, year, selP, selPl, metric) => {
  const data = Array(12).fill(0);
  tenants.filter(t => matchMulti(t, [year], selP, selPl)).forEach(t => {
    const m = parseInt(t.startDate.slice(5,7))-1;
    if (metric === 'nights') data[m] += Math.max(0, Math.round((new Date(t.endDate)-new Date(t.startDate))/86400000));
    else if (metric === 'count') data[m]++;
    else data[m] += parseFloat(t.grossAmount)||0;
  });
  return data;
};

/* ── KPI ── */

const computeKPIs = (tenants, selY, selP, selPl, chargeType = 'all') => {
  let gross=0, nights=0, charges=0, count=0;
  tenants.filter(t => matchMulti(t, selY, selP, selPl)).forEach(t => {
    count++;
    gross  += parseFloat(t.grossAmount)||0;
    nights += Math.max(0, Math.round((new Date(t.endDate)-new Date(t.startDate))/86400000));
    if (chargeType !== 'urssaf')
      (t.resExpenses||[]).forEach(e => { charges += parseFloat(e.amount)||0; });
    if (chargeType !== 'prestataires' && t.isUrssaf !== false)
      charges += (parseFloat(t.grossAmount)||0)*0.077;
  });
  return { gross, nights, charges, profit: gross-charges, count, rpn: nights>0?gross/nights:0 };
};

const trend = (a, b) => b > 0 ? Math.round(((a-b)/b)*100) : null;

/* ── Répartitions ── */

const getPlatBreak = (tenants, selY, selP) =>
  Object.entries(
    tenants.filter(t => matchMulti(t, selY, selP, [])).reduce((m,t) => {
      m[t.platform] = (m[t.platform]||0)+(parseFloat(t.grossAmount)||0); return m;
    }, {})
  ).sort((a,b)=>b[1]-a[1]);

const getPropBreak = (tenants, props, selY, selPl) =>
  Object.entries(
    tenants.filter(t => matchMulti(t, selY, [], selPl)).reduce((m,t) => {
      m[t.propertyId] = (m[t.propertyId]||0)+(parseFloat(t.grossAmount)||0); return m;
    }, {})
  ).map(([id,v])=>[props.find(p=>p.id===id)?.name||id, v]).sort((a,b)=>b[1]-a[1]);

/* ── Graphique SVG ── */

const LineChart = ({ series, labels, unit='€' }) => {
  const [tip, setTip] = useState(null);
  const W=720, H=260, PL=58, PR=16, PT=16, PB=28;
  const pW=W-PL-PR, pH=H-PT-PB;
  const all = series.flatMap(s=>s.data).filter(v=>v!=null&&v>0);
  const mx  = Math.max(...all, 1);
  const xS  = i => PL+(i/Math.max(labels.length-1,1))*pW;
  const yS  = v => PT+pH-(Math.max(v,0)/mx)*pH;

  const smooth = d => {
    let path='', last=null;
    d.forEach((v,i)=>{
      if (v==null){last=null;return;}
      const pt=[xS(i),yS(v)];
      if (!last) path+=`M${pt[0]} ${pt[1]}`;
      else { const c=(pt[0]-last[0])/2.8; path+=` C${last[0]+c} ${last[1]},${pt[0]-c} ${pt[1]},${pt[0]} ${pt[1]}`; }
      last=pt;
    });
    return path;
  };
  const areaD = d => {
    const v=d.map((v,i)=>v!=null?i:-1).filter(i=>i>=0);
    if (!v.length) return '';
    return `${smooth(d)} L${xS(v[v.length-1])} ${PT+pH} L${xS(v[0])} ${PT+pH}Z`;
  };
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

      {/* grille */}
      {Array.from({length:6}).map((_,i)=>{
        const y=PT+(i/5)*pH, v=mx*(1-i/5);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="#f1f5f9" strokeWidth="1"/>
            <text x={PL-5} y={y+4} textAnchor="end" fontSize="8" fill="#94a3b8" fontFamily="system-ui">{fmt(v)}</text>
          </g>
        );
      })}
      {labels.map((l,i)=>(
        <text key={i} x={xS(i)} y={H-5} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="system-ui">{l}</text>
      ))}

      {/* courbes */}
      {series.map((s,si)=>(
        <g key={si}>
          {!s.dashed && <path d={areaD(s.data)} fill={`url(#lg${si})`}/>}
          <path d={smooth(s.data)} fill="none" stroke={s.color}
            strokeWidth={s.dashed?2:2.5} strokeDasharray={s.dashed?'7 4':undefined}
            strokeLinecap="round" opacity={s.dashed?0.7:1}/>
          {s.data.map((v,i)=>v==null?null:(
            <circle key={i} cx={xS(i)} cy={yS(v)} r={s.dashed?3:4.5}
              fill={s.dashed?'white':s.color} stroke={s.color} strokeWidth="2"
              onMouseEnter={()=>setTip({x:xS(i),y:yS(v),name:s.name,lbl:labels[i],val:v,color:s.color,dashed:s.dashed})}
              onMouseLeave={()=>setTip(null)} style={{cursor:'pointer'}}/>
          ))}
        </g>
      ))}


      {/* tooltip */}
      {tip&&(()=>{
        const tx=tip.x>W-148?tip.x-152:tip.x+12, ty=tip.y<52?tip.y+8:tip.y-44;
        return (
          <g>
            <line x1={tip.x} y1={PT} x2={tip.x} y2={PT+pH} stroke={tip.color} strokeWidth="1" strokeDasharray="4 2" opacity="0.4"/>
            <rect x={tx} y={ty} width="134" height="38" rx="8" fill="white" stroke={tip.color} strokeWidth="1.5" style={{filter:'drop-shadow(0 4px 8px rgba(0,0,0,0.12))'}}/>
            <text x={tx+67} y={ty+13} textAnchor="middle" fontSize="8.5" fill="#64748b" fontFamily="system-ui">{tip.name}{tip.dashed?' (prév.)':''} · {tip.lbl}</text>
            <text x={tx+67} y={ty+28} textAnchor="middle" fontSize="13" fontWeight="bold" fill={tip.color} fontFamily="system-ui">{fmt(tip.val)}</text>
          </g>
        );
      })()}
    </svg>
  );
};

/* ── Donut ── */

const Donut = ({ data, colors, title }) => {
  const [hov, setHov] = useState(null);
  const total=data.reduce((s,[,v])=>s+v,0);
  const r=38,cx=50,cy=50,circ=2*Math.PI*r;
  let cum=0;
  const segs=data.slice(0,8).map(([name,value],i)=>{
    const pct=total>0?value/total:0;
    const da=pct*circ,doff=circ*(1-cum); cum+=pct;
    return {name,value,pct,da,doff,color:colors[i%colors.length],i};
  });
  const disp=hov!==null?data[hov]:null;
  return (
    <div>
      {title && <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-3">{title}</p>}
      <svg viewBox="0 0 100 100" className="w-32 h-32 mx-auto">
        {segs.map(s=>(
          <circle key={s.i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
            strokeWidth={hov===s.i?20:15} strokeDasharray={`${s.da} ${circ-s.da}`}
            strokeDashoffset={s.doff} transform={`rotate(-90 ${cx} ${cy})`}
            style={{cursor:'pointer',transition:'stroke-width 0.15s'}}
            onMouseEnter={()=>setHov(s.i)} onMouseLeave={()=>setHov(null)}/>
        ))}
        <circle cx={cx} cy={cy} r="24" fill="white"/>
        <text x={cx} y={cy-4} textAnchor="middle" fontSize="6" fill="#94a3b8" fontFamily="system-ui">
          {disp?(disp[0].length>12?disp[0].slice(0,12)+'…':disp[0]):'Total'}
        </text>
        <text x={cx} y={cy+7} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1e293b" fontFamily="system-ui">
          {disp?`${Math.round(disp[1]/1000)}k€`:`${Math.round(total/1000)}k€`}
        </text>
      </svg>
      <div className="space-y-1 mt-2">
        {segs.map(s=>(
          <div key={s.i}
            className={`flex items-center justify-between text-[8px] px-1.5 py-1 rounded-xl cursor-default transition-colors ${hov===s.i?'bg-slate-50':''}`}
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

/* ── MiniBar ── */

const MiniBar = ({ data, labels, color, unit='nuits' }) => {
  const [hov,setHov]=useState(null);
  const max=Math.max(...data,1);
  return (
    <div className="flex items-end gap-0.5" style={{height:100}}>
      {data.map((v,i)=>(
        <div key={i} className="flex-1 flex flex-col items-center justify-end relative"
          onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}>
          {hov===i&&v>0&&(
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

/* ── KPI Card ── */

const KPI = ({ label, value, sub, trend: t, color='blue', icon }) => {
  const cls={blue:'text-blue-600',emerald:'text-emerald-600',violet:'text-violet-600',amber:'text-amber-500',rose:'text-rose-500',slate:'text-slate-700'};
  return (
    <div className="bg-white rounded-[22px] p-4 shadow-lg border border-slate-50 flex flex-col gap-1">
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-tight">{label}</p>
      <p className={`text-xl md:text-2xl font-black leading-none ${cls[color]}`}>{value}</p>
      {sub&&<p className="text-[8px] text-slate-400 font-bold">{sub}</p>}
      {t!==null&&t!==undefined&&(
        <div className={`mt-1 self-start flex items-center gap-1 text-[7px] font-black px-2 py-0.5 rounded-full ${t>=0?'bg-emerald-50 text-emerald-600':'bg-rose-50 text-rose-500'}`}>
          {t>=0?<TrendingUp size={8}/>:<TrendingDown size={8}/>} {t>=0?'+':''}{t}% vs N-1
        </div>
      )}
    </div>
  );
};

/* ── Pill ── */

const Pill = ({label,active,color,onClick,size='sm'}) => (
  <button onClick={onClick}
    className={`flex items-center gap-1.5 rounded-xl font-black uppercase transition-all ${size==='sm'?'px-2.5 py-1 text-[8px]':'px-3 py-1.5 text-[9px]'}`}
    style={{
      background: active ? color+'22' : '#1e293b',
      color: active ? color : '#64748b',
      border: `1.5px solid ${active ? color+'66' : '#334155'}`,
    }}>
    {active&&<span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:color}}/>}
    {label}
  </button>
);

/* ── Composant principal ── */

const Statistiques = ({ tenants, properties, availablePlatforms }) => {
  const curYear  = new Date().getFullYear();
  const curMonth = new Date().getMonth();

  const availableYears = useMemo(()=>{
    const s=new Set(tenants.map(t=>t.startDate?.slice(0,4)).filter(Boolean));
    return Array.from(s).sort((a,b)=>b-a);
  },[tenants]);

  /* ── États filtres ── */
  const [selYears,     setSelYears]     = useState([String(curYear)]);
  const [selProps,     setSelProps]     = useState([]);          // vide = tous
  const [selPlatforms, setSelPlatforms] = useState([]);          // vide = toutes
  const [filterCharge, setFilterCharge] = useState('all');

  /* ── États graphique ── */
  const [chartMode,  setChartMode]  = useState('years');
  const [selMetric,  setSelMetric]  = useState('gross');
  const [selMetrics, setSelMetrics] = useState(['gross','profit']);

  const tog = (list, setList, item, max=6) => {
    if (list.includes(item)) { if (list.length>1) setList(list.filter(x=>x!==item)); }
    else if (list.length<max) setList([...list,item]);
  };

  /* ── Séries graphique ── */
  const chartSeries = useMemo(()=>{
    const addYear = (acc, y, color, extraP, extraPl) => {
      const yStr = String(y);
      if (yStr === String(curYear) && curMonth < 11) {
        const paid = getMonthly(tenants,[yStr],extraP,extraPl,selMetric,filterCharge);
        const fc   = getForecast(tenants,yStr,extraP,extraPl,selMetric);
        acc.push({ name:yStr, color, data: paid.map((v,m)=>m<curMonth?v:null) });
        acc.push({ name:yStr, color, data: fc.map((v,m)=>{
          if (m<curMonth-1) return null;
          if (m===curMonth-1) return paid[m]||0;
          return v;
        }), dashed:true, hideLegend:true });
      } else {
        acc.push({ name:yStr, color, data: getMonthly(tenants,[yStr],extraP,extraPl,selMetric,filterCharge) });
      }
    };

    if (chartMode==='years') {
      const r=[];
      selYears.forEach((y,i)=>addYear(r,y,SC[i%SC.length],selProps,selPlatforms));
      return r;
    }
    if (chartMode==='properties') {
      const list=selProps.length>0?selProps:properties.slice(0,4).map(p=>p.id);
      return list.map((pid,i)=>({
        name:properties.find(p=>p.id===pid)?.name||pid,
        color:SC[i%SC.length],
        data:getMonthly(tenants,selYears,[pid],selPlatforms,selMetric,filterCharge),
      }));
    }
    if (chartMode==='platforms') {
      const list=selPlatforms.length>0?selPlatforms:availablePlatforms.slice(0,4);
      return list.map((pl,i)=>({
        name:pl, color:SC[i%SC.length],
        data:getMonthly(tenants,selYears,selProps,[pl],selMetric,filterCharge),
      }));
    }
    if (chartMode==='years_x_props') {
      const pList=selProps.length>0?selProps.slice(0,3):properties.slice(0,2).map(p=>p.id);
      const r=[]; let idx=0;
      selYears.slice(0,3).forEach(y=>{
        pList.forEach(pid=>{
          r.push({
            name:`${y} · ${properties.find(p=>p.id===pid)?.name?.split(' ')[0]||pid}`,
            color:SC[idx%SC.length],
            data:getMonthly(tenants,[y],[pid],selPlatforms,selMetric,filterCharge),
          });
          idx++;
        });
      });
      return r;
    }
    if (chartMode==='years_x_platforms') {
      const plList=selPlatforms.length>0?selPlatforms.slice(0,3):availablePlatforms.slice(0,2);
      const r=[]; let idx=0;
      selYears.slice(0,3).forEach(y=>{
        plList.forEach(pl=>{
          r.push({
            name:`${y} · ${pl}`,
            color:SC[idx%SC.length],
            data:getMonthly(tenants,[y],selProps,[pl],selMetric,filterCharge),
          });
          idx++;
        });
      });
      return r;
    }
    // metrics
    return selMetrics.map((mid,i)=>({
      name:METRICS.find(m=>m.id===mid)?.label||mid,
      color:SC[i%SC.length],
      data:getMonthly(tenants,selYears,selProps,selPlatforms,mid,filterCharge),
    }));
  },[chartMode,selYears,selProps,selPlatforms,selMetric,selMetrics,filterCharge,tenants,properties,availablePlatforms]);

  const activeMetric = chartMode==='metrics' ? selMetrics[0] : selMetric;
  const chartUnit = (activeMetric==='nights'||activeMetric==='count') ? '' : '€';

  /* ── KPI ── */
  const prevYears = useMemo(()=>selYears.map(y=>String(parseInt(y)-1)),[selYears]);
  const kpis     = useMemo(()=>computeKPIs(tenants,selYears,selProps,selPlatforms,filterCharge),[tenants,selYears,selProps,selPlatforms,filterCharge]);
  const kpisPrev = useMemo(()=>computeKPIs(tenants,prevYears,selProps,selPlatforms,filterCharge),[tenants,prevYears,selProps,selPlatforms,filterCharge]);

  /* ── Donuts + bar ── */
  const platData  = useMemo(()=>getPlatBreak(tenants,selYears,selProps),[tenants,selYears,selProps]);
  const propData  = useMemo(()=>getPropBreak(tenants,properties,selYears,selPlatforms),[tenants,properties,selYears,selPlatforms]);
  const nightData = useMemo(()=>getMonthly(tenants,selYears,selProps,selPlatforms,'nights'),[tenants,selYears,selProps,selPlatforms]);

  /* ── Titre résumé sélection ── */
  const yearLabel = selYears.length===1?selYears[0]:selYears.join(', ');

  return (
    <div className="space-y-5 px-2 md:px-0 pb-10">

      {/* ══ BARRE DE FILTRES ══ */}
      <div className="bg-slate-900 rounded-[28px] p-5 space-y-4 border border-slate-800">

        {/* Années */}
        <div className="space-y-2">
          <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest">Années</p>
          <div className="flex flex-wrap gap-1.5">
            {availableYears.map((y,i)=>(
              <Pill key={y} label={y} active={selYears.includes(y)}
                color={SC[selYears.includes(y)?selYears.indexOf(y):i%SC.length]}
                onClick={()=>tog(selYears,setSelYears,y)}/>
            ))}
          </div>
        </div>

        <div className="h-px bg-slate-800"/>

        {/* Logements + Plateformes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest">Logements</p>
              {selProps.length>0&&(
                <button onClick={()=>setSelProps([])} className="text-[7px] text-slate-500 underline">Tous</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {properties.map((p,i)=>(
                <Pill key={p.id} label={p.name.split(' ')[0]} active={selProps.includes(p.id)}
                  color={SC[(i+1)%SC.length]}
                  onClick={()=>{
                    if (selProps.includes(p.id)) setSelProps(selProps.filter(x=>x!==p.id));
                    else setSelProps([...selProps,p.id]);
                  }}/>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest">Plateformes</p>
              {selPlatforms.length>0&&(
                <button onClick={()=>setSelPlatforms([])} className="text-[7px] text-slate-500 underline">Toutes</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availablePlatforms.map((pl,i)=>(
                <Pill key={pl} label={pl} active={selPlatforms.includes(pl)}
                  color={SC[(i+2)%SC.length]}
                  onClick={()=>{
                    if (selPlatforms.includes(pl)) setSelPlatforms(selPlatforms.filter(x=>x!==pl));
                    else setSelPlatforms([...selPlatforms,pl]);
                  }}/>
              ))}
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-800"/>

        {/* Type de charges */}
        <div className="space-y-2">
          <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest">Type de charges</p>
          <div className="flex gap-1.5 flex-wrap">
            {[['all','Toutes'],['urssaf','URSSAF (7,7%)'],['prestataires','Prestataires']].map(([v,l])=>(
              <button key={v} onClick={()=>setFilterCharge(v)}
                className={`px-3 py-1.5 rounded-xl text-[8.5px] font-black uppercase transition-colors border ${filterCharge===v?'bg-rose-600 text-white border-rose-600':'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-slate-800"/>

        {/* Mode graphique */}
        <div className="space-y-2">
          <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest">Mode graphique</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['years',            'Par années'],
              ['properties',       'Par logements'],
              ['platforms',        'Par plateformes'],
              ['years_x_props',    'Années × Logements'],
              ['years_x_platforms','Années × Plateformes'],
              ['metrics',          'Métriques'],
            ].map(([m,l])=>(
              <button key={m} onClick={()=>setChartMode(m)}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-colors ${chartMode===m?'bg-blue-600 text-white':'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Métrique */}
        {chartMode!=='metrics' ? (
          <div className="space-y-2">
            <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest">Métrique affichée</p>
            <div className="flex flex-wrap gap-1.5">
              {METRICS.map((m,i)=>(
                <button key={m.id} onClick={()=>setSelMetric(m.id)}
                  className="px-3 py-1.5 rounded-xl text-[8.5px] font-black uppercase transition-all"
                  style={{
                    background: selMetric===m.id ? SC[i%SC.length] : '#1e293b',
                    color: selMetric===m.id ? 'white' : '#64748b',
                    border: `1.5px solid ${selMetric===m.id ? SC[i%SC.length] : '#334155'}`,
                  }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[7px] font-black uppercase text-slate-500 tracking-widest">Métriques à comparer</p>
            <div className="flex flex-wrap gap-1.5">
              {METRICS.map((m,i)=>(
                <Pill key={m.id} label={m.label} active={selMetrics.includes(m.id)}
                  color={SC[selMetrics.includes(m.id)?selMetrics.indexOf(m.id):i%SC.length]}
                  onClick={()=>tog(selMetrics,setSelMetrics,m.id)}/>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ KPI ══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI label="CA Brut"      value={`${Math.round(kpis.gross).toLocaleString('fr-FR')}€`}
          trend={trend(kpis.gross,kpisPrev.gross)} color="blue"/>
        <KPI label="Profit Net"   value={`${Math.round(kpis.profit).toLocaleString('fr-FR')}€`}
          trend={trend(kpis.profit,kpisPrev.profit)} color="emerald"/>
        <KPI label="Charges"      value={`-${Math.round(kpis.charges).toLocaleString('fr-FR')}€`} color="rose"/>
        <KPI label="Nuits totales" value={kpis.nights}
          sub={`${kpis.count} réservation${kpis.count>1?'s':''}`}
          trend={trend(kpis.nights,kpisPrev.nights)} color="violet"/>
        <KPI label="Rev. / Nuit"  value={`${Math.round(kpis.rpn)}€`}
          trend={trend(kpis.rpn,kpisPrev.rpn)} color="amber"/>
        <KPI label="Taux charges" value={kpis.gross>0?`${Math.round((kpis.charges/kpis.gross)*100)}%`:'—'}
          sub="Charges / CA" color="slate"/>
      </div>

      {/* ══ GRAPHIQUE ══ */}
      <div className="bg-white rounded-[28px] shadow-lg p-5">
        {/* Légende */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {chartSeries.filter(s=>!s.hideLegend).map(s=>(
            <div key={s.name+s.color} className="flex items-center gap-1.5">
              <div className="w-6 h-1.5 rounded-full" style={{background:s.color}}/>
              <span className="text-[8px] font-black text-slate-600 uppercase">{s.name}</span>
            </div>
          ))}
          {chartSeries.some(s=>s.dashed)&&(
            <div className="flex items-center gap-1.5">
              <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 3"/></svg>
              <span className="text-[8px] font-bold text-slate-400 uppercase">Prévisionnel</span>
            </div>
          )}
        </div>

        {/* Corps : totaux à gauche + courbe à droite */}
        <div className="flex gap-3 items-center">

          {/* ── TOTAUX ANNUELS ── */}
          <div className="flex flex-col gap-2 shrink-0" style={{width:'96px'}}>
            {chartSeries.filter(s=>!s.dashed&&!s.hideLegend).map(s=>{
              const encaisse = s.data.reduce((a,v)=>a+(v||0), 0);

              // Cherche la série pointillée associée (même nom + même couleur)
              const dashed = chartSeries.find(d=>d.dashed&&d.hideLegend&&d.name===s.name&&d.color===s.color);
              // Prévisionnel futur = mois curMonth..11 de la série pointillée
              const prevFutur = dashed ? dashed.data.slice(curMonth).reduce((a,v)=>a+(v||0),0) : 0;
              const totalPrev = encaisse + prevFutur;

              const fmtT = v => chartUnit==='€'
                ? (v>=1000?`${(v/1000).toFixed(v>=10000?0:1)}k€`:`${Math.round(v)}€`)
                : Math.round(v).toString();

              return (
                <div key={s.name+s.color} className="rounded-xl px-2 py-2"
                  style={{background:s.color+'15', borderLeft:`3px solid ${s.color}`}}>
                  <p className="text-[7px] font-black uppercase truncate leading-tight mb-1.5"
                    style={{color:s.color}}>{s.name}</p>

                  {dashed ? (
                    <>
                      {/* CA encaissé */}
                      <p className="text-[6px] font-bold text-slate-400 uppercase leading-none mb-0.5">Encaissé</p>
                      <p className="text-[14px] font-black leading-none mb-2"
                        style={{color:s.color}}>{fmtT(encaisse)}</p>

                      {/* Séparateur */}
                      <div className="h-px mb-1.5" style={{background:s.color+'44'}}/>

                      {/* Total encaissé + prévisionnel */}
                      <p className="text-[6px] font-bold text-slate-400 uppercase leading-none mb-0.5">Encaissé + Prév.</p>
                      <p className="text-[14px] font-black leading-none"
                        style={{color:s.color}}>{fmtT(totalPrev)}</p>
                    </>
                  ) : (
                    <p className="text-[15px] font-black leading-none"
                      style={{color:s.color}}>{fmtT(encaisse)}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Graphique */}
          <div className="flex-1 min-w-0">
            <LineChart series={chartSeries} labels={MONTHS} unit={chartUnit}/>
          </div>
        </div>
      </div>

      {/* ══ BAS DE PAGE ══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-[28px] shadow-lg p-5">
          {platData.length>0
            ? <Donut data={platData} colors={DC} title="Par plateforme"/>
            : <p className="text-center text-[9px] text-slate-300 font-black py-8">Aucune donnée</p>}
        </div>
        <div className="bg-white rounded-[28px] shadow-lg p-5">
          {propData.length>0
            ? <Donut data={propData} colors={DC} title="Par logement"/>
            : <p className="text-center text-[9px] text-slate-300 font-black py-8">Aucune donnée</p>}
        </div>
        <div className="bg-white rounded-[28px] shadow-lg p-5">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-3">Nuits / mois</p>
          <MiniBar data={nightData} labels={MONTHS} color="#8b5cf6" unit="nuits"/>
        </div>
      </div>

      {/* ══ TAUX D'OCCUPATION ══ */}
      {(() => {
        const year = selYears.length===1 ? parseInt(selYears[0]) : new Date().getFullYear();
        const isLeap = (year%4===0&&year%100!==0)||(year%400===0);
        const available = isLeap ? 366 : 365;
        const propStats = (properties||[]).map(prop => {
          const res = tenants.filter(t => t.propertyId===prop.id && t.startDate && t.startDate.startsWith(String(year)));
          const nights = res.reduce((s,t)=>s+Math.max(0,Math.round((new Date(t.endDate)-new Date(t.startDate))/86400000)),0);
          const revenue = res.reduce((s,t)=>s+(parseFloat(t.grossAmount)||0),0);
          const rate = Math.round((nights/available)*100);
          const rpn = nights>0 ? Math.round(revenue/nights) : 0;
          return {name:prop.name, nights, rate, rpn, count:res.length};
        }).filter(p=>p.count>0);
        if (propStats.length===0) return null;
        return (
          <div className="bg-white rounded-[28px] shadow-lg overflow-hidden">
            <div className="p-4 bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest">Taux d'occupation {year}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[400px]">
                <thead className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase border-b">
                  <tr><th className="p-3">Logement</th><th className="p-3 text-right">Nuits</th><th className="p-3 text-right">Taux</th><th className="p-3 text-right">Rev. / nuit</th><th className="p-3 text-right">Réservations</th></tr>
                </thead>
                <tbody className="divide-y font-bold text-[10px]">
                  {propStats.map(p=>(
                    <tr key={p.name}>
                      <td className="p-3 font-black uppercase text-slate-800">{p.name}</td>
                      <td className="p-3 text-right">{p.nights}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{width:`${Math.min(p.rate,100)}%`}}/></div>
                          <span className={`font-black ${p.rate>=70?'text-emerald-600':p.rate>=40?'text-amber-600':'text-rose-500'}`}>{p.rate}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-black text-slate-700">{p.rpn}€</td>
                      <td className="p-3 text-right text-slate-500">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default Statistiques;
