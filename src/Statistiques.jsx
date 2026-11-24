import React, { useState, useMemo } from 'react';

/* ─────────────────────────────────────────────────────────────
   Statistiques — vue simplifiée
   - Filtres : qui (Anthony / Camille), activité (locations / travaux), logement
   - Comparaison année A vs année B, en brut ou en net
   - Réalisé (encaissé) vs prévisionnel (non encore encaissé)
   ───────────────────────────────────────────────────────────── */

const MS = ['J','F','M','A','M','J','J','A','S','O','N','D'];
const MF = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const WHO = {
  anthony: { label: 'Anthony', initial: 'A', color: '#2f5fa8' },
  camille: { label: 'Camille', initial: 'C', color: '#1f7a55' },
};
const URSSAF_RATE = 0.077;
const GOLD = '#CFA650', GOLD_DARK = '#a07830', INK = '#1a1810', MUTED = '#6a6050', LINE = '#e6dfc8', CARD = '#fffdf6';
const PLAT_COLORS = [GOLD, INK, '#8a7e6a', '#c8bc9e', GOLD_DARK, '#e6dfc8'];
const hatch = (c, bg) => `repeating-linear-gradient(45deg, ${c} 0 2px, ${bg} 2px 5px)`;
const num = v => parseFloat(v) || 0;
const fmt = n => `${Math.round(n).toLocaleString('fr-FR')} €`;
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const nightsOf = t => (t.startDate && t.endDate) ? Math.max(0, Math.round((new Date(t.endDate) - new Date(t.startDate)) / 86400000)) : 0;
const pct = (a, b) => b > 0 ? Math.round(((a - b) / b) * 100) : null;
const deltaTxt = d => d === null ? '—' : `${d > 0 ? '+' : ''}${d} %`;

/* Transforme réservations + chantiers en "lignes d'argent" datées.
   - réalisé : un paiement avec une date (paymentDate, acompte/solde, encaissement chantier)
   - prévisionnel : montant pas encore encaissé, placé à la date du séjour (ou fin de chantier) */
const buildEntries = (tenants, chantiers, ownerFromProp, todayStr) => {
  const entries = [];
  const stays = [];
  const push = e => { if (e.date && e.brut > 0) entries.push(e); };

  (tenants || []).forEach(t => {
    if (!t.startDate) return;
    const base = t.owner || ownerFromProp(t.propertyId);
    const opt = (t.resOptions || []).reduce((s, o) => s + num(o.amount), 0);
    const gross = num(t.grossAmount) + opt;
    const expenses = (t.resExpenses || []).reduce((s, e) => s + num(e.amount), 0);
    const urssaf = t.isUrssaf !== false ? gross * URSSAF_RATE : 0;
    const netRatio = gross > 0 ? Math.max(0, (gross - expenses - urssaf) / gross) : 0;
    const common = { kind: 'loc', propertyId: t.propertyId, platform: t.platform || 'Autre', netRatio };
    stays.push({ propertyId: t.propertyId, owner: base, startDate: t.startDate, nights: nightsOf(t), gross });

    if (t.platform === 'En direct') {
      const who = o => (o === 'anthony' || o === 'camille') ? o : base;
      const a1 = num(t.acompte1Amount), a2 = num(t.acompte2Amount);
      const solde = num(t.soldeAmount) > 0 ? num(t.soldeAmount) : Math.max(0, num(t.grossAmount) - a1 - a2);
      [[a1, t.acompte1Date, t.acompte1Owner], [a2, t.acompte2Date, t.acompte2Owner], [solde + opt, t.soldeDate, t.soldeOwner]]
        .forEach(([amount, date, owner]) => push({ ...common, owner: who(owner), brut: amount, date: date || t.startDate, fut: !date }));
    } else {
      push({ ...common, owner: base, brut: gross, date: t.paymentDate || t.startDate, fut: !t.paymentDate });
    }
  });

  (chantiers || []).forEach(c => {
    (c.encaissements || []).forEach(e => push({ kind: 'trav', cat: e.type === 'materiaux' ? 'mat' : 'mo', owner: c.owner, brut: num(e.montant), date: e.date, fut: false, netRatio: 1 }));
    if (c.statut === 'termine') return;
    if (c.statut === 'devis' && !c.inclurePrevisionnel) return;
    const encOf = type => (c.encaissements || []).filter(e => e.type === type).reduce((s, e) => s + num(e.montant), 0);
    const date = (!c.dateFin || c.dateFin < todayStr) ? todayStr : c.dateFin;
    push({ kind: 'trav', cat: 'mo', owner: c.owner, brut: Math.max(0, num(c.montantPrestation) - encOf('prestation')), date, fut: true, netRatio: 1 });
    push({ kind: 'trav', cat: 'mat', owner: c.owner, brut: Math.max(0, num(c.montantMateriaux) - encOf('materiaux')), date, fut: true, netRatio: 1 });
  });
  return { entries, stays };
};

/* ── petits composants ── */
const Pill = ({ on, onClick, children, big }) => (
  <button onClick={onClick} style={{
    minHeight: big ? 44 : 36, padding: big ? '0 14px' : '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 700,
    border: `1px solid ${on ? (big ? INK : GOLD) : (big ? '#d8d0b8' : LINE)}`,
    background: on ? (big ? INK : GOLD) : (big ? CARD : '#f8f4e8'), color: on && big ? '#f8f4e8' : INK,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, flex: big ? 1 : 'none'
  }}>{children}</button>
);
const Dot = ({ owner, size = 22 }) => WHO[owner] ? (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', width: size, height: size, borderRadius: '50%', fontSize: Math.round(size * .5), fontWeight: 900, color: '#fff', background: WHO[owner].color }}>{WHO[owner].initial}</span>
) : null;
const Card = ({ children, style }) => (
  <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, ...style }}>{children}</div>
);
const H2 = ({ children, sub }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: INK, display: 'flex', alignItems: 'center', gap: 8 }}>{children}</h3>
    {sub && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{sub}</p>}
  </div>
);
const PrevBadge = () => (
  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, border: `1.5px dashed ${GOLD_DARK}`, color: '#6a4f1c' }}>Prévisionnel</span>
);
const Swatch = ({ kind }) => (
  <span style={{ width: 10, height: 10, borderRadius: 3, boxSizing: 'border-box', display: 'inline-block',
    ...(kind === 'fut' ? { border: `1.5px dashed ${GOLD_DARK}`, background: hatch(GOLD, '#fbf3dc') } : { background: kind === 'b' ? '#d8d0b8' : GOLD }) }} />
);
const DeltaChip = ({ d, dark }) => {
  const pos = d === null || d >= 0;
  const st = pos ? (dark ? ['#24412f', '#9fe0b4'] : ['#e2f1e6', '#1f6b3d']) : (dark ? ['#4a2620', '#f4b3a4'] : ['#f8e3de', '#9c3522']);
  return <span style={{ fontSize: 14, fontWeight: 900, padding: '3px 10px', borderRadius: 999, background: st[0], color: st[1] }}>{deltaTxt(d)}</span>;
};

/* ── Composant principal ── */
const Statistiques = ({ tenants = [], properties = [], chantiers = [], ownerFromProp = () => 'other' }) => {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const todayStr = now.toISOString().split('T')[0];

  const [who, setWho] = useState('all');
  const [act, setAct] = useState('all');
  const [prop, setProp] = useState('all');
  const [yA, setYA] = useState(curYear);
  const [yB, setYB] = useState(curYear - 1);
  const [metric, setMetric] = useState('brut');
  const [month, setMonth] = useState(curMonth);

  const { entries, stays } = useMemo(
    () => buildEntries(tenants, chantiers, ownerFromProp, todayStr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenants, chantiers, properties, todayStr]
  );

  const years = useMemo(() => {
    const s = new Set([curYear, curYear - 1]);
    entries.forEach(e => { const y = parseInt(e.date.slice(0, 4)); if (y >= 2015 && y <= curYear + 1) s.add(y); });
    return [...s].sort((a, b) => a - b);
  }, [entries, curYear]);

  const isNet = metric === 'net';
  const val = e => isNet ? e.brut * e.netRatio : e.brut;
  const propOwner = id => ownerFromProp(id);
  const locProps = properties.filter(p => who === 'all' || propOwner(p.id) === who);

  const keep = e => {
    if (who !== 'all' && e.owner !== who) return false;
    if (act !== 'all' && e.kind !== act) return false;
    if (prop !== 'all') return e.kind === 'loc' && e.propertyId === prop;
    return true;
  };
  const sel = useMemo(() => entries.filter(keep), [entries, who, act, prop]); // eslint-disable-line react-hooks/exhaustive-deps
  const showLoc = act !== 'trav';
  const selStays = stays.filter(s => (who === 'all' || s.owner === who) && (prop === 'all' || s.propertyId === prop));
  const nbProps = prop !== 'all' ? 1 : locProps.length || 1;

  const monthly = y => {
    const real = Array(12).fill(0), fut = Array(12).fill(0);
    sel.forEach(e => { if (e.date.slice(0, 4) === String(y)) (e.fut ? fut : real)[parseInt(e.date.slice(5, 7)) - 1] += val(e); });
    return { real, fut, tot: real.map((v, i) => v + fut[i]) };
  };
  const A = monthly(yA), B = monthly(yB);
  const sum = a => a.reduce((s, v) => s + v, 0);
  const totA = sum(A.tot), totB = sum(B.tot), realA = sum(A.real), futA = sum(A.fut);
  const splitLoc = sel.filter(e => e.kind === 'loc' && e.date.startsWith(String(yA))).reduce((s, e) => s + val(e), 0);
  const splitTrav = totA - splitLoc;

  const staysA = selStays.filter(s => s.startDate.startsWith(String(yA)));
  const nightsA = staysA.reduce((s, x) => s + x.nights, 0);
  const grossStaysA = staysA.reduce((s, x) => s + x.gross, 0);
  const daysYear = (yA % 4 === 0 && (yA % 100 !== 0 || yA % 400 === 0)) ? 366 : 365;
  const occA = Math.round(nightsA / (daysYear * nbProps) * 100);

  const max = Math.max(1, ...A.tot, ...B.tot);
  const dMonth = pct(A.tot[month], B.tot[month]);
  const monthIsFut = A.fut[month] > 0;

  const upcoming = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(curYear, curMonth + 1 + i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const cur = monthly(y).tot[m], last = monthly(y - 1).tot[m];
    const n = selStays.filter(s => s.startDate.slice(0, 7) === `${y}-${String(m + 1).padStart(2, '0')}`).reduce((s, x) => s + x.nights, 0);
    return { key: `${y}-${m}`, label: `${MF[m]} ${y}`, cur, last, lastYear: y - 1, ratio: last > 0 ? cur / last : null, occ: Math.round(n / (daysIn(y, m) * nbProps) * 100) };
  });

  const ranking = useMemo(() => {
    const rows = [];
    const inYear = (e, y) => e.date.startsWith(String(y));
    const base = entries.filter(e => (who === 'all' || e.owner === who) && (act === 'all' || e.kind === act));
    if (act !== 'trav') properties.forEach(p => {
      const es = base.filter(e => e.kind === 'loc' && e.propertyId === p.id);
      const a = es.filter(e => inYear(e, yA)).reduce((s, e) => s + val(e), 0), b = es.filter(e => inYear(e, yB)).reduce((s, e) => s + val(e), 0);
      if (a > 0 || b > 0) rows.push({ id: p.id, kind: 'loc', name: p.name, owner: propOwner(p.id), a, b });
    });
    if (act !== 'loc') [['mo', 'Travaux · main d’œuvre'], ['mat', 'Travaux · matériaux']].forEach(([cat, name]) => {
      const es = base.filter(e => e.kind === 'trav' && e.cat === cat);
      const a = es.filter(e => inYear(e, yA)).reduce((s, e) => s + val(e), 0), b = es.filter(e => inYear(e, yB)).reduce((s, e) => s + val(e), 0);
      if (a > 0 || b > 0) rows.push({ id: cat, kind: 'trav', name, owner: who === 'all' ? null : who, a, b });
    });
    return rows.sort((x, y) => y.a - x.a);
  }, [entries, properties, who, act, yA, yB, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const rankTotal = ranking.reduce((s, r) => s + r.a, 0) || 1;

  const platforms = useMemo(() => {
    const m = {};
    sel.filter(e => e.kind === 'loc' && e.date.startsWith(String(yA))).forEach(e => { m[e.platform] = (m[e.platform] || 0) + val(e); });
    const t = Object.values(m).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, v], i) => ({ name, v, pct: Math.round(v / t * 100), color: PLAT_COLORS[i % PLAT_COLORS.length] }));
  }, [sel, yA, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickYA = y => { setYA(y); if (y === yB) setYB(y - 1); };
  const scopeLabel = prop !== 'all'
    ? (properties.find(p => p.id === prop)?.name || '')
    : `${who === 'all' ? '' : WHO[who].label + ' · '}${{ all: 'locations + travaux', loc: 'locations', trav: 'travaux' }[act]}`;
  const metricDef = isNet
    ? 'Locations : brut moins frais prestataires et URSSAF 7,7 %. Avant impôt sur le revenu. Travaux : en brut (achats et URSSAF travaux non suivis).'
    : 'Ce que tu reçois : locations commissions déduites, options comprises ; travaux = main d’œuvre + matériaux. Avant charges et URSSAF.';
  const metricShort = isNet ? 'net' : 'brut';
  const label = { fontSize: 12, fontWeight: 700, color: MUTED, width: 76 };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 12px 120px', fontFamily: 'Inter, sans-serif', color: INK, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* QUI */}
      <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Personne">
        {[['all', 'Tous les deux'], ['anthony', 'Anthony'], ['camille', 'Camille']].map(([id, l]) => (
          <Pill key={id} big on={who === id} onClick={() => { setWho(id); setProp('all'); }}>{id !== 'all' && <Dot owner={id} />}{l}</Pill>
        ))}
      </div>

      {/* ACTIVITÉ */}
      <div style={{ display: 'flex', gap: 6, background: '#ede8d8', borderRadius: 999, padding: 4 }} role="group" aria-label="Activité">
        {[['all', 'Tout'], ['loc', 'Locations'], ['trav', 'Travaux']].map(([id, l]) => (
          <button key={id} onClick={() => { setAct(id); if (id === 'trav') setProp('all'); }} style={{
            flex: 1, minHeight: 40, border: 0, borderRadius: 999, fontSize: 13, fontWeight: 700,
            background: act === id ? CARD : 'transparent', color: act === id ? INK : MUTED, boxShadow: act === id ? '0 1px 3px rgba(26,24,16,.15)' : 'none'
          }}>{l}</button>
        ))}
      </div>

      {/* LOGEMENTS */}
      {showLoc && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Logement">
          <Pill on={prop === 'all'} onClick={() => setProp('all')}>Tous logements</Pill>
          {locProps.map(p => <Pill key={p.id} on={prop === p.id} onClick={() => setProp(p.id)}>{p.name}</Pill>)}
        </div>
      )}

      {/* ANNÉES + MONTANT */}
      <Card style={{ gap: 10, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={label}>Année</span>
          {years.map(y => <Pill key={y} on={yA === y} onClick={() => pickYA(y)}>{y}</Pill>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={label}>Comparer à</span>
          {years.filter(y => y !== yA).map(y => <Pill key={y} on={yB === y} onClick={() => setYB(y)}>{y}</Pill>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={label}>Montant</span>
          <Pill on={!isNet} onClick={() => setMetric('brut')}>Brut</Pill>
          <Pill on={isNet} onClick={() => setMetric('net')}>Net</Pill>
        </div>
      </Card>

      {/* RÉSUMÉ */}
      <div style={{ background: INK, color: '#f8f4e8', borderRadius: 26, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#d8d0b8' }}>{isNet ? 'Net' : 'CA brut'} {yA} · {scopeLabel}</span>
        <p style={{ margin: '-6px 0 0', fontSize: 12, lineHeight: 1.4, color: '#c8bc9e' }}>{metricDef}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, color: GOLD }}>{fmt(totA)}</span>
          <DeltaChip d={pct(totA, totB)} dark />
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#d8d0b8' }}>contre {fmt(totB)} en {yB}</p>
        {act === 'all' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
            {[[splitLoc, 'locations'], [splitTrav, 'travaux']].map(([v, l]) => (
              <div key={l} style={{ background: '#2a261b', borderRadius: 14, padding: 10 }}><div style={{ fontSize: 16, fontWeight: 900 }}>{fmt(v)}</div><div style={{ fontSize: 11, color: '#d8d0b8' }}>{l}</div></div>
            ))}
          </div>
        )}
        {showLoc && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
            {[[nightsA, 'nuits'], [`${occA} %`, 'occupation'], [fmt(nightsA ? grossStaysA / nightsA : 0), 'brut / nuit']].map(([v, l]) => (
              <div key={l} style={{ background: '#2a261b', borderRadius: 14, padding: 10 }}><div style={{ fontSize: 16, fontWeight: 900 }}>{v}</div><div style={{ fontSize: 11, color: '#d8d0b8' }}>{l}</div></div>
            ))}
          </div>
        )}
        {futA > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #3a3426', paddingTop: 12 }}>
            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
              <span style={{ background: GOLD, flex: realA }} />
              <span style={{ background: hatch(GOLD, 'transparent'), flex: futA }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, fontSize: 12, color: '#d8d0b8' }}>
              <div><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Swatch />Réalisé</div><div style={{ fontSize: 16, fontWeight: 900, color: '#f8f4e8' }}>{fmt(realA)}</div></div>
              <div><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Swatch kind="fut" />Prévisionnel</div><div style={{ fontSize: 16, fontWeight: 900, color: '#f8f4e8' }}>{fmt(futA)}</div></div>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: '#c8bc9e' }}>Prévisionnel = séjours et chantiers pas encore encaissés.</p>
          </div>
        )}
      </div>

      {/* MOIS PAR MOIS */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <H2>Mois par mois · {metricShort}</H2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, fontWeight: 700, color: MUTED }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Swatch />{yA}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Swatch kind="b" />{yB}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Swatch kind="fut" />Prévisionnel</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 150, borderBottom: `1px solid ${LINE}` }}>
          {MS.map((s, m) => {
            const on = month === m;
            const hR = Math.round(A.real[m] / max * 138), hF = Math.round(A.fut[m] / max * 138), hB = Math.max(2, Math.round(B.tot[m] / max * 138));
            return (
              <button key={m} onClick={() => setMonth(m)} aria-label={MF[m]} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, padding: '0 1px', border: 0, borderRadius: '6px 6px 0 0', background: on ? '#f3eddc' : 'transparent' }}>
                <span style={{ width: 9, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  {hF > 0 && <span style={{ height: hF, boxSizing: 'border-box', border: `1.5px dashed ${GOLD_DARK}`, borderBottom: hR > 0 ? 0 : undefined, borderRadius: '3px 3px 0 0', background: hatch(on ? GOLD_DARK : GOLD, '#fbf3dc') }} />}
                  <span style={{ height: Math.max(hF > 0 ? 0 : 2, hR), background: on ? GOLD_DARK : GOLD, borderRadius: hF > 0 ? 0 : '3px 3px 0 0' }} />
                </span>
                <span style={{ width: 9, height: hB, borderRadius: '3px 3px 0 0', background: '#d8d0b8' }} />
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', marginTop: -6 }}>
          {MS.map((s, m) => <span key={m} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: month === m ? 900 : 600, color: month === m ? INK : MUTED }}>{s}</span>)}
        </div>
        <div style={{ background: '#f3eddc', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 900 }}>{MF[month]} {monthIsFut && <PrevBadge />}</span>
            <DeltaChip d={dMonth} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, fontSize: 12, color: MUTED }}>
            <div><div style={{ fontSize: 15, fontWeight: 900, color: INK }}>{fmt(A.tot[month])}</div>{yA}{A.fut[month] > 0 && ` · dont ${fmt(A.fut[month])} prév.`}</div>
            <div><div style={{ fontSize: 15, fontWeight: 900, color: INK }}>{fmt(B.tot[month])}</div>{yB}</div>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Touche un mois pour voir son détail.</p>
        </div>
      </Card>

      {/* MOIS À VENIR */}
      <Card>
        <H2 sub={`Déjà réservé ou en cours (${metricShort}), comparé au total de l'an dernier`}>Les mois à venir <PrevBadge /></H2>
        {upcoming.map(u => (
          <div key={u.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderTop: '1px solid #efe8d4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 14, fontWeight: 900 }}>{u.label}</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: GOLD_DARK }}>{fmt(u.cur)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: '#ede8d8', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: `repeating-linear-gradient(45deg, ${GOLD} 0 3px, #e9d49e 3px 6px)`, width: `${Math.min(100, Math.round((u.ratio || 0) * 100))}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED }}>
              <span>{u.ratio === null ? `rien en ${u.lastYear}` : `${Math.round(u.ratio * 100)} % de ${fmt(u.last)} · total ${u.lastYear}`}</span>
              {showLoc && <span>{u.occ} % occupé</span>}
            </div>
          </div>
        ))}
      </Card>

      {/* RÉPARTITION */}
      <Card style={{ gap: 10 }}>
        <H2 sub="Touche un logement pour filtrer tout l'écran">Répartition · {metricShort} {yA}</H2>
        {ranking.length === 0 && <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Aucune donnée pour cette sélection.</p>}
        {ranking.map(r => {
          const on = r.kind === 'loc' ? prop === r.id : false;
          const share = Math.round(r.a / rankTotal * 100);
          return (
            <button key={r.id} onClick={() => {
              if (r.kind === 'loc') { setProp(prop === r.id ? 'all' : r.id); if (act === 'trav') setAct('loc'); }
              else { setAct('trav'); setProp('all'); }
            }} style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', width: '100%', padding: '10px 12px', borderRadius: 16, color: INK, border: `1px solid ${on ? GOLD : '#efe8d4'}`, background: on ? '#fbf3dc' : CARD }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, width: '100%' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.owner && <Dot owner={r.owner} size={20} />}{r.name}</span><span>{fmt(r.a)}</span>
              </span>
              <span style={{ display: 'block', width: '100%', height: 8, borderRadius: 4, background: '#ede8d8', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', borderRadius: 4, background: GOLD, width: `${share}%` }} /></span>
              <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, width: '100%' }}><span>{share} % du total</span><span>{deltaTxt(pct(r.a, r.b))} vs {yB}</span></span>
            </button>
          );
        })}
      </Card>

      {/* PLATEFORMES */}
      {showLoc && platforms.length > 0 && (
        <Card style={{ gap: 10 }}>
          <H2>Locations par plateforme · {yA}</H2>
          <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 }}>
            {platforms.map(p => <span key={p.name} style={{ background: p.color, flex: p.v }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '6px 12px' }}>
            {platforms.map(p => (
              <span key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} /><span style={{ fontWeight: 700 }}>{p.name}</span><span style={{ color: MUTED }}>{p.pct} %</span>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Statistiques;
