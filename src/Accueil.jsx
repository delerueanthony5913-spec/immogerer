import React, { useState, useMemo } from 'react';
import { buildEntries } from './Statistiques';

/* ─────────────────────────────────────────────────────────────
   Accueil — ce qui demande ton attention aujourd'hui et bientôt.
   Indépendant des filtres des autres onglets.
   ───────────────────────────────────────────────────────────── */

const GOLD = '#CFA650', INK = '#1a1810', MUTED = '#6a6050', LINE = '#e6dfc8', CARD = '#fffdf6', SOFT = '#f3eddc';
const DOW = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DOWF = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MON = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONF = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const num = v => parseFloat(v) || 0;
const eur = n => `${Math.round(n).toLocaleString('fr-FR')} €`;
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const nights = t => (t.startDate && t.endDate) ? Math.max(0, Math.round((parseIso(t.endDate) - parseIso(t.startDate)) / 86400000)) : 0;
const grossOf = t => num(t.grossAmount) + (t.resOptions || []).reduce((s, o) => s + num(o.amount), 0);
const arrivalTime = t => {
  const m = (t.comment || '').match(/arriv\w*[^0-9]{0,15}(\d{1,2}\s*h\s*\d{0,2}(?:\s*[-–à]\s*\d{1,2}\s*h\s*\d{0,2})?)/i);
  return m ? m[1].replace(/\s+/g, '') : '';
};

const Card = ({ children, style }) => (
  <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, ...style }}>{children}</div>
);
const Title = ({ children, sub }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: INK }}>{children}</h3>
    {sub && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{sub}</p>}
  </div>
);
const RowBtn = ({ onClick, children, style }) => (
  <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', border: 0, background: 'transparent', color: INK, padding: '10px 0', borderTop: '1px solid #efe8d4', ...style }}>{children}</button>
);

const Accueil = ({ tenants = [], properties = [], chantiers = [], ownerFromProp = () => 'other', getOverdueAlerts = () => [], fiscalCAByOwner, fiscalParams, onOpenReservation, onGoTab }) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = iso(today);
  const [selDay, setSelDay] = useState(0);

  const propName = id => properties.find(p => p.id === id)?.name || '—';
  const valid = useMemo(() => tenants.filter(t => t.startDate && t.endDate), [tenants]);

  /* Aujourd'hui */
  const departures = valid.filter(t => t.endDate === todayStr);
  const arrivals = valid.filter(t => t.startDate === todayStr);
  const services = [];
  valid.forEach(t => (t.resExpenses || []).forEach(e => {
    if (e.hasEntry !== false && e.dateEntry === todayStr) services.push({ who: e.person, time: e.timeEntry, prop: propName(t.propertyId), what: 'entrée' });
    if (e.hasExit !== false && e.dateExit === todayStr) services.push({ who: e.person, time: e.timeExit, prop: propName(t.propertyId), what: 'sortie' });
  }));

  /* 14 jours */
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const dayEvents = i => {
    const d = iso(days[i]);
    return [
      ...valid.filter(t => t.startDate === d).map(t => ({ t, kind: 'Arrivée' })),
      ...valid.filter(t => t.endDate === d).map(t => ({ t, kind: 'Départ' })),
    ];
  };
  const sd = days[selDay];
  const selEvents = dayEvents(selDay);

  /* Prochaines réservations (après aujourd'hui) */
  const next = valid.filter(t => t.startDate > todayStr).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
  const statusOf = t => {
    if (t.platform === 'En direct') {
      if (getOverdueAlerts(t).length) return ['Paiement en retard', '#f8e3de', '#9c3522'];
      if (t.soldeDate) return ['Soldé', '#e2f1e6', '#1f6b3d'];
      if (t.acompte1Date || t.acompte2Date) return ['Acompte reçu', '#e2f1e6', '#1f6b3d'];
      return ['En attente de paiement', '#fbf0cf', '#6a4f1c'];
    }
    return [t.platform || '—', '#ede8d8', INK];
  };

  /* À faire */
  const overdue = valid.filter(t => getOverdueAlerts(t).length > 0);
  const overdueAmount = overdue.reduce((s, t) => {
    const a = getOverdueAlerts(t);
    return s + (a.includes('Acompte 1') ? num(t.acompte1Amount) : 0) + (a.includes('Acompte 2') ? num(t.acompte2Amount) : 0) + (a.includes('Solde') ? num(t.soldeAmount) : 0);
  }, 0);
  const unpaidExp = [];
  valid.forEach(t => (t.resExpenses || []).forEach(e => { if (!e.paymentDate && t.endDate <= todayStr) unpaidExp.push({ t, e }); }));
  const unpaidExpAmount = unpaidExp.reduce((s, x) => s + num(x.e.amount), 0);
  const incomplete = valid.filter(t => t.startDate >= todayStr && (!t.phone || !(num(t.grossAmount) > 0) || !t.propertyId));
  const chantierRest = c => {
    const enc = (c.encaissements || []).reduce((s, e) => s + num(e.montant), 0);
    const tot = num(c.montantPrestation) + num(c.montantMateriaux);
    return { enc, tot, rest: Math.max(0, tot - enc) };
  };
  const chantiersDus = chantiers.filter(c => c.statut !== 'devis' && chantierRest(c).rest > 0 && (c.statut === 'termine' || (c.dateFin && c.dateFin <= todayStr)));
  const todo = [
    overdue.length > 0 && { key: 'overdue', title: overdue.length > 1 ? `${overdue.length} paiements en retard` : 'Paiement en retard', detail: overdue.slice(0, 2).map(t => `${t.name} · ${getOverdueAlerts(t).join(', ')}`).join(' — '), value: eur(overdueAmount), color: '#9c3522', bg: '#fbeeea', go: () => overdue.length === 1 ? onOpenReservation(overdue[0]) : onGoTab('reservations') },
    unpaidExp.length > 0 && { key: 'exp', title: 'Prestataires à payer', detail: `${[...new Set(unpaidExp.map(x => x.e.person).filter(Boolean))].slice(0, 3).join(', ') || 'Prestations'} · ${unpaidExp.length} prestation${unpaidExp.length > 1 ? 's' : ''} terminée${unpaidExp.length > 1 ? 's' : ''}`, value: eur(unpaidExpAmount), color: '#8a4b0f', bg: '#fbf3e6', go: () => onGoTab('finances') },
    incomplete.length > 0 && { key: 'inc', title: incomplete.length > 1 ? `${incomplete.length} réservations incomplètes` : 'Réservation incomplète', detail: incomplete.slice(0, 2).map(t => `${t.name || 'Sans nom'} · ${!t.phone ? 'contact' : !(num(t.grossAmount) > 0) ? 'montant' : 'logement'} manquant`).join(' — '), value: '', color: '#6a4f1c', bg: '#fbf7ea', go: () => incomplete.length === 1 ? onOpenReservation(incomplete[0]) : onGoTab('reservations') },
    chantiersDus.length > 0 && { key: 'ch', title: chantiersDus.length > 1 ? `${chantiersDus.length} chantiers à encaisser` : 'Chantier à encaisser', detail: chantiersDus.slice(0, 2).map(c => `${[c.prenom, c.nom].filter(Boolean).join(' ') || 'Chantier'}`).join(', '), value: eur(chantiersDus.reduce((s, c) => s + chantierRest(c).rest, 0)), color: '#2f5fa8', bg: '#eef3fb', go: () => onGoTab('chantiers') },
  ].filter(Boolean);

  /* Chiffres clés */
  const { entries } = useMemo(() => buildEntries(tenants, chantiers, ownerFromProp, todayStr), [tenants, chantiers, properties, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps
  const cm = todayStr.slice(0, 7);
  const lm = `${today.getFullYear() - 1}-${cm.slice(5)}`;
  const encMonth = entries.filter(e => !e.fut && !e.expense && e.date.startsWith(cm)).reduce((s, e) => s + e.brut, 0);
  const encMonthLast = entries.filter(e => !e.fut && !e.expense && e.date.startsWith(lm)).reduce((s, e) => s + e.brut, 0);
  const dEnc = encMonthLast > 0 ? Math.round((encMonth - encMonthLast) / encMonthLast * 100) : null;
  const toCollect = entries.filter(e => e.fut && !e.expense).reduce((s, e) => s + e.brut, 0);
  const nm0 = new Date(today.getFullYear(), today.getMonth() + 1, 1), nm1 = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  const nmDays = Math.round((nm1 - nm0) / 86400000);
  const nmNights = valid.reduce((s, t) => {
    const a = Math.max(parseIso(t.startDate), nm0), b = Math.min(parseIso(t.endDate), nm1);
    return s + Math.max(0, Math.round((b - a) / 86400000));
  }, 0);
  const nmOcc = properties.length ? Math.round(nmNights / (nmDays * properties.length) * 100) : 0;
  let closest = null;
  if (fiscalCAByOwner && fiscalParams) {
    const p = fiscalParams;
    ['anthony', 'camille'].forEach(o => {
      const d = fiscalCAByOwner[o]; if (!d) return;
      [['Location', d.locEnc + d.locPrev, p.tvaLocationSoft], ['Main d’œuvre', d.prestaEnc + d.prestaPrev, p.tvaServicesSoft], ['Matériaux', d.matEnc + d.matPrev, p.tvaVentesSoft]].forEach(([l, v, s]) => {
        const r = s > 0 ? v / s : 0;
        if (!closest || r > closest.r) closest = { r, label: l, who: o === 'anthony' ? 'Anthony' : 'Camille' };
      });
    });
  }
  const kpis = [
    { label: `Encaissé en ${MONF[today.getMonth()]}`, value: eur(encMonth), sub: dEnc === null ? `rien en ${MON[today.getMonth()]} ${today.getFullYear() - 1}` : `${dEnc > 0 ? '+' : ''}${dEnc} % vs ${today.getFullYear() - 1}`, go: () => onGoTab('statistiques') },
    { label: 'À encaisser', value: eur(toCollect), sub: 'séjours + chantiers', go: () => onGoTab('finances') },
    { label: `Occupation ${MONF[nm0.getMonth()]}`, value: `${nmOcc} %`, sub: 'déjà réservé', go: () => onGoTab('agenda') },
    closest && { label: 'Seuil TVA le plus proche', value: `${Math.round(closest.r * 100)} %`, sub: `${closest.label} · ${closest.who}`, go: () => onGoTab('fiscal') },
  ].filter(Boolean);

  /* Chantiers en cours */
  const enCours = chantiers.filter(c => c.statut === 'en_cours').map(c => ({ c, ...chantierRest(c) })).sort((a, b) => (a.c.dateFin || '9').localeCompare(b.c.dateFin || '9'));

  const nbMoves = departures.length + arrivals.length;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 12px 120px', fontFamily: 'Inter, sans-serif', color: INK, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: MUTED }}>{DOWF[today.getDay()]} {today.getDate()} {MONF[today.getMonth()]}</p>
        <h2 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 30 }}>Bonjour</h2>
      </div>

      {/* AUJOURD'HUI */}
      <div style={{ background: INK, color: '#f8f4e8', borderRadius: 26, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#d8d0b8' }}>Aujourd'hui</span>
          <span style={{ fontSize: 12, color: '#c8bc9e' }}>{nbMoves === 0 ? 'aucun mouvement' : `${nbMoves} mouvement${nbMoves > 1 ? 's' : ''}`}</span>
        </div>
        {[...departures.map(t => ({ t, kind: 'Départ' })), ...arrivals.map(t => ({ t, kind: 'Arrivée' }))].map(({ t, kind }) => {
          const dep = kind === 'Départ';
          const time = dep ? '' : arrivalTime(t);
          return (
            <button key={kind + t.id} onClick={() => onOpenReservation(t)} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#2a261b', border: 0, borderRadius: 16, padding: 12, color: '#f8f4e8', textAlign: 'left', width: '100%' }}>
              <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, flex: 'none', background: dep ? '#4a2620' : '#24412f', color: dep ? '#f4b3a4' : '#9fe0b4' }}>{dep ? '↑' : '↓'}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 900 }}>{kind} · {t.name || 'Sans nom'}</span>
                <span style={{ fontSize: 12, color: '#d8d0b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{propName(t.propertyId)} · {t.platform}{!dep && t.phone ? ` · ${t.phone}` : ''}</span>
              </span>
              {time && <span style={{ fontSize: 14, fontWeight: 900, color: GOLD }}>{time}</span>}
            </button>
          );
        })}
        {nbMoves === 0 && <p style={{ margin: 0, fontSize: 13, color: '#d8d0b8' }}>Pas d'arrivée ni de départ aujourd'hui.</p>}
        {services.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#d8d0b8' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9fe0b4', flex: 'none' }} />
            {s.who || 'Prestataire'} · {s.prop} ({s.what}){s.time ? ` à ${s.time}` : ''}
          </div>
        ))}
      </div>

      {/* 14 JOURS */}
      <Card style={{ gap: 12 }}>
        <Title sub="Touche un jour pour voir les arrivées et départs">Les 14 prochains jours</Title>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 340, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(14, minmax(0,1fr))', gap: 2, alignItems: 'end' }}>
              <span />
              {days.map((d, i) => {
                const on = selDay === i, has = dayEvents(i).length > 0;
                return (
                  <button key={i} onClick={() => setSelDay(i)} aria-label={`${DOWF[d.getDay()]} ${d.getDate()}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '4px 0', minHeight: 40, borderRadius: 8, border: 0, color: on ? '#f8f4e8' : INK, background: on ? INK : has ? '#f3e3b5' : 'transparent' }}>
                    <span style={{ fontSize: 9, fontWeight: 700 }}>{DOW[d.getDay()]}</span>
                    <span style={{ fontSize: 12, fontWeight: 900 }}>{d.getDate()}</span>
                  </button>
                );
              })}
            </div>
            {properties.map(p => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '60px repeat(14, minmax(0,1fr))', gap: 2, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.name || '').replace(/^(la|le|les)\s+/i, '').split(' ')[0]}</span>
                {days.map((d, i) => {
                  const ds = iso(d);
                  const occ = valid.some(t => t.propertyId === p.id && t.startDate <= ds && ds < t.endDate);
                  return <span key={i} style={{ height: 18, borderRadius: 3, background: occ ? GOLD : '#ede8d8', outline: selDay === i ? `2px solid ${INK}` : 'none', outlineOffset: -1 }} />;
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: SOFT, borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 900 }}>{DOWF[sd.getDay()]} {sd.getDate()} {MONF[sd.getMonth()]}</span>
          {selEvents.length === 0 && <span style={{ fontSize: 13, color: MUTED }}>Aucune arrivée ni départ.</span>}
          {selEvents.map(({ t, kind }) => (
            <button key={kind + t.id} onClick={() => onOpenReservation(t)} style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', fontSize: 13, color: INK }}>
              <b>{kind}</b> · {t.name || 'Sans nom'} · {propName(t.propertyId)}
            </button>
          ))}
        </div>
      </Card>

      {/* PROCHAINES RÉSERVATIONS */}
      <Card style={{ gap: 0 }}>
        <div style={{ marginBottom: 6 }}><Title>Prochaines réservations</Title></div>
        {next.length === 0 && <p style={{ margin: '8px 0 0', fontSize: 13, color: MUTED }}>Aucune réservation à venir.</p>}
        {next.map(t => {
          const d = parseIso(t.startDate), st = statusOf(t);
          return (
            <RowBtn key={t.id} onClick={() => onOpenReservation(t)}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 44, height: 48, borderRadius: 12, background: SOFT, flex: 'none' }}>
                <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{d.getDate()}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase' }}>{MON[d.getMonth()]}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name || 'Sans nom'}</span>
                <span style={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{propName(t.propertyId)} · {nights(t)} nuit{nights(t) > 1 ? 's' : ''}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 900 }}>{grossOf(t) > 0 ? eur(grossOf(t)) : '—'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: st[1], color: st[2] }}>{st[0]}</span>
              </span>
            </RowBtn>
          );
        })}
      </Card>

      {/* À FAIRE */}
      <Card>
        <Title>À faire</Title>
        {todo.length === 0 && <p style={{ margin: 0, fontSize: 13, color: '#1f6b3d', fontWeight: 700 }}>Rien en attente, tout est à jour.</p>}
        {todo.map(x => (
          <button key={x.key} onClick={x.go} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: x.bg, border: 0, textAlign: 'left', color: INK, width: '100%' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: x.color }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 900 }}>{x.title}</span>
              <span style={{ fontSize: 12, color: MUTED }}>{x.detail}</span>
            </span>
            {x.value && <span style={{ fontSize: 13, fontWeight: 900, flex: 'none' }}>{x.value}</span>}
          </button>
        ))}
      </Card>

      {/* CHIFFRES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
        {kpis.map(k => (
          <button key={k.label} onClick={k.go} style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left', color: INK }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>{k.label}</span>
            <span style={{ fontSize: 20, fontWeight: 900 }}>{k.value}</span>
            <span style={{ fontSize: 11, color: MUTED }}>{k.sub}</span>
          </button>
        ))}
      </div>

      {/* CHANTIERS */}
      {enCours.length > 0 && (
        <Card style={{ gap: 6 }}>
          <Title>Chantiers en cours</Title>
          {enCours.map(({ c, enc, tot, rest }) => {
            const p = tot > 0 ? Math.round(enc / tot * 100) : 0;
            return (
              <RowBtn key={c.id} onClick={() => onGoTab('chantiers')} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}><b>{[c.prenom, c.nom].filter(Boolean).join(' ') || 'Chantier'}</b><span style={{ color: MUTED }}>{c.dateFin ? `fin ${parseIso(c.dateFin).getDate()} ${MON[parseIso(c.dateFin).getMonth()]}` : ''}</span></span>
                <span style={{ display: 'block', height: 8, borderRadius: 4, background: '#ede8d8', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', borderRadius: 4, background: GOLD, width: `${p}%` }} /></span>
                <span style={{ fontSize: 11, color: MUTED }}>{p} % encaissé · reste {eur(rest)}</span>
              </RowBtn>
            );
          })}
        </Card>
      )}
    </div>
  );
};

export default Accueil;
