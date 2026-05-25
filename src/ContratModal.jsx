import React, { useState } from 'react';
import { X, FileText, Download, Plus, Trash2 } from 'lucide-react';
import SIGNATURE_B64 from './signature.js';

const CADELIO_EQUIPMENT = [
  '1 lit double 160 x 200',
  '3 lits superposés 80 x 190',
  '2 lits en mezzanine 80 x 190',
  '1 canapé lit Rapido 140 x 190',
  'Un lave-vaisselle',
  'Un réfrigérateur avec congélateur',
  'Un four micro-ondes combiné',
  'Un grille-pain',
  'Une machine à café Senseo et filtre',
  'Une bouilloire',
  'Un set raclette et fondue',
  'Une Smart TV',
  '2 balcons',
  'Parking gratuit à l\'entrée de la résidence',
  'Rangement à skis sécurisé',
];

const fmt = (d) => {
  if (!d) return '...';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const buildHTML = (form, cautions, tenant, signatureB64) => {
  const amount = parseFloat(tenant.grossAmount) || 0;
  const a1 = parseFloat(tenant.acompte1Amount) || 0;
  const a2 = parseFloat(tenant.acompte2Amount) || 0;
  const s = parseFloat(tenant.soldeAmount) || 0;
  const validCautions = cautions.filter(c => c.label && c.amount && c.checked !== false);
  const soldeModeText = { virement_10j: 'par virement 10 jours avant l\'arrivée dans les lieux', main_propre: 'en mains propres' }[form.soldeMode] || 'par virement 10 jours avant l\'arrivée dans les lieux';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Contrat - ${tenant.name || ''}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,serif;font-size:11pt;line-height:1.75;color:#2d3748;padding:2.2cm;max-width:21cm;margin:0 auto}
.prop-title{text-align:center;font-size:14pt;font-family:Helvetica,Arial,sans-serif;font-weight:900;letter-spacing:4px;color:#2c5282;text-transform:uppercase;margin-bottom:2px}
h1{text-align:center;font-size:17pt;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;color:#1a365d;font-weight:normal}
.ref{text-align:center;font-size:8pt;color:#a0aec0;margin-bottom:16px;letter-spacing:2px}
hr{border:none;border-top:1px solid #e2e8f0;margin:16px 0}
h2{font-size:10.5pt;margin:22px 0 8px;font-family:Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:2px;color:#2c5282;border-bottom:1.5px solid #bee3f8;padding-bottom:4px;page-break-after:avoid}
p{margin-bottom:8px;orphans:3;widows:3}
ul{margin:6px 0 6px 20px}
li{margin-bottom:5px}
.rib{background:#ebf8ff;border-left:3px solid #3182ce;padding:12px 16px;margin:8px 0;page-break-inside:avoid;border-radius:0 4px 4px 0}
.rib table{border-collapse:collapse;width:100%}
.rib td{padding:3px 8px;font-size:10pt;color:#2d3748}
.rib td:first-child{font-weight:bold;width:90px;color:#2c5282}
.rib .iban{font-family:'Courier New',Courier,monospace;letter-spacing:2px;font-size:10pt;font-weight:bold}
.sigs{display:table;width:100%;margin-top:28px;border-collapse:separate;border-spacing:16px 0;page-break-inside:avoid}
.sig{display:table-cell;border:1px solid #e2e8f0;background:#f7fafc;padding:12px 14px;min-height:90px;width:50%;vertical-align:top;border-radius:4px}
.sig-lbl{font-size:9pt;font-weight:bold;font-family:Helvetica,Arial,sans-serif;margin-bottom:4px;color:#2c5282;text-transform:uppercase;letter-spacing:1px}
.sig-name{font-size:9pt;color:#718096}
.footer{text-align:center;font-size:8pt;color:#a0aec0;margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0}
.note{font-size:9pt;font-style:italic;color:#718096}
.print-btn{position:fixed;top:16px;right:16px;padding:10px 22px;background:#3182ce;color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;font-family:Helvetica,Arial,sans-serif;box-shadow:0 4px 12px rgba(49,130,206,.3)}
.parties{display:table;width:100%;border-collapse:separate;border-spacing:10px 0;margin-bottom:20px;page-break-inside:avoid}
.partie{display:table-cell;vertical-align:top;font-size:10pt;background:#f7fafc;padding:11px 13px;border-radius:6px;border:1px solid #e2e8f0}
.partie-lbl{font-family:Helvetica,Arial,sans-serif;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#a0aec0;margin-bottom:5px}
.partie-name{font-size:11pt;font-weight:bold;margin-bottom:3px;color:#1a365d}
.partie-detail{font-size:9pt;color:#4a5568;line-height:1.6}
.hl{font-size:9.5pt;background:#fffbeb;border-left:3px solid #d97706;padding:8px 12px;margin:8px 0;color:#78350f;page-break-inside:avoid;border-radius:0 4px 4px 0}
.regl{background:#f0f7ff;border-radius:6px;padding:6px 16px;margin:8px 0;page-break-inside:avoid;border:1px solid #bee3f8}
.regl p{border-bottom:1px solid #dbeafe;padding:6px 0;margin-bottom:0;font-size:10.5pt}
.regl p:last-child{border-bottom:none}
.intro{background:#f7fafc;border-radius:6px;padding:14px 18px;margin:14px 0;border-left:3px solid #bee3f8}
@media print{.print-btn{display:none}body{padding:0}}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">⬇ Enregistrer en PDF</button>

<p class="prop-title">Les Cimes de Cadélio</p>
<h1>Contrat de Location</h1>
<p class="ref">Réf : ${(tenant.name || '').replace(/\s+/g, '_')}_${tenant.startDate || ''}</p>
<hr>

<div class="parties">
  <div class="partie">
    <div class="partie-lbl">Le propriétaire</div>
    <div class="partie-name">Anthony et Camille DELERUE</div>
    <div class="partie-detail">Tél : 07 49 89 54 97<br>Email : delerue.anthony@hotmail.fr</div>
  </div>
  <div class="partie">
    <div class="partie-lbl">Le locataire</div>
    <div class="partie-name">${tenant.name || ''}</div>
    <div class="partie-detail">
      ${tenant.phone ? `Tél : ${tenant.phone}<br>` : ''}
      ${form.tenantEmail ? `Email : ${form.tenantEmail}` : '&nbsp;'}
    </div>
  </div>
  ${form.contactName && form.contactPhone ? `<div class="partie">
    <div class="partie-lbl">Contact sur place</div>
    <div class="partie-name">${form.contactName}</div>
    <div class="partie-detail">Tél : ${form.contactPhone}</div>
  </div>` : ''}
</div>
<hr>

<div class="intro">
<p>Madame, Monsieur,</p>
<p>Suite à votre demande, nous avons le plaisir de vous adresser le contrat de location suivant.</p>
<p>Si cette proposition vous convient, merci de nous retourner un exemplaire signé avec la mention <strong>« Lu et approuvé »</strong>, accompagné du règlement correspondant.</p>
<p>Nous espérons vous accueillir très prochainement et vous souhaitons un excellent séjour.</p>
</div>

<h2>Le logement loué</h2>
<img src="https://les-cimes-de-cadelio.vercel.app/_next/image?url=%2Fphotos%2F1.jpg&w=1200&q=75" alt="Séjour" style="width:100%;max-height:220px;object-fit:cover;border-radius:6px;margin:6px 0 10px">
<p style="font-size:9.5pt;color:#4a5568">Apt B 401 — Résidence Edelweiss, Allée des Saules, 05240 La Salle-les-Alpes — Serre Chevalier · <a href="https://goo.gl/maps/U1x4oWFEjc1vJN629" style="color:#3182ce">Google Maps</a></p>
<p>Du <strong>${fmt(tenant.startDate)} à ${form.arrivalTime}</strong> au <strong>${fmt(tenant.endDate)} à ${form.departureTime}</strong></p>
<p>Le montant de la location est fixé à <strong>${amount.toFixed(0)} €</strong> net toutes charges comprises pour un maximum de <strong>${form.maxPersons} personnes</strong>.</p>
${form.taxeSejour === 'incluse' ? `<p>La taxe de séjour est incluse dans le prix de la location.</p>` : ''}
${form.taxeSejour === 'ensus' ? `<p>La taxe de séjour${form.taxeSejourDetail ? ` (${form.taxeSejourDetail})` : ''} sera à régler directement sur place à l'arrivée.</p>` : ''}
${form.cleaningBy === 'prestataire' && form.cleaningFee ? `<p>Les frais de ménage de <strong>${form.cleaningFee} €</strong> sont à rajouter au prix de la location.</p>` : ''}
${form.cleaningBy === 'locataire' ? '<p class="hl">Le ménage de fin de séjour est à la charge du locataire.</p>' : ''}
${form.cleaningBy === 'inclus' ? '<p>Les frais de ménage sont inclus dans le prix de la location.</p>' : ''}

<h2>Dans l'appartement vous trouverez :</h2>
<ul>${CADELIO_EQUIPMENT.map(e => `<li>${e}</li>`).join('')}</ul>
<p class="hl">Le linge de lit, serviettes de toilette et torchons ne sont pas fournis. Vous pouvez les louer directement auprès de Justine.</p>

${form.specialNotes ? `<h2>À savoir</h2><ul>${form.specialNotes.split('\n').filter(l => l.trim()).map(l => `<li>${l}</li>`).join('')}</ul>` : ''}

<h2>Règlement intérieur</h2>
<div class="regl">
<p><strong>Animaux</strong> — Les animaux sont interdits dans l'appartement.</p>
<p><strong>Tabac</strong> — Il est interdit de fumer dans l'appartement. Il est toutefois autorisé de fumer sur les balcons.</p>
<p><strong>Chauffage</strong> — Pensez à fermer les fenêtres lorsque le chauffage est allumé — merci pour vos voisins et pour la planète !</p>
<p><strong>Déchets</strong> — Merci de trier vos déchets. Les containers de collecte sélective sont accessibles à proximité immédiate du logement.</p>
<p><strong>Voisinage & capacité</strong> — Merci de respecter la tranquillité des voisins et de limiter les nuisances sonores. L'appartement accueille au maximum <strong>${form.maxPersons} personnes</strong> conformément au contrat.</p>
<p><strong>Assurance</strong> — Le locataire déclare être couvert par une assurance responsabilité civile ou villégiature pour toute la durée du séjour.</p>
</div>

<h2>La réservation</h2>
${a1 > 0 ? `<p>Un acompte de <strong>${a1.toFixed(0)} €</strong> par virement est demandé pour bloquer la réservation${tenant.acompte1DueDate ? `, à régler avant le <strong>${fmt(tenant.acompte1DueDate)}</strong>` : ''}.</p><p><em>(Non remboursable en cas d'annulation par vos soins)</em></p>` : ''}
${a2 > 0 ? `<p>Un deuxième acompte de <strong>${a2.toFixed(0)} €</strong> par virement est demandé${tenant.acompte2DueDate ? `, à régler avant le <strong>${fmt(tenant.acompte2DueDate)}</strong>` : ''}.</p>` : ''}
${s > 0 ? `<p>Le solde de <strong>${s.toFixed(0)} €</strong> sera à régler ${soldeModeText}${tenant.soldeDueDate ? ` avant le <strong>${fmt(tenant.soldeDueDate)}</strong>` : (form.soldeMode === 'main_propre' ? ' à l\'arrivée dans les lieux' : '')}.</p>` : ''}
${validCautions.length > 0 ? `<p class="hl"><strong>Cautions demandées à l\'arrivée :</strong> ${validCautions.map(c => `${c.label} : <strong>${c.amount} €</strong>`).join(' — ')}<br><span style="font-style:italic">(Restituées au départ. En cas de dégradations constatées, elles pourront être conservées partiellement ou totalement.)</span></p>` : ''}
<p>La réservation prendra effet à réception ${a1 > 0 || a2 > 0 ? 'de l\'acompte' : 'du règlement intégral'} et du présent contrat daté et signé avec la mention <strong>« Lu et approuvé »</strong>.</p>
<p>Au-delà de cette date la réservation sera annulée, le propriétaire disposera de la location à sa convenance.</p>

<h2>Coordonnées bancaires (RIB)</h2>
<div class="rib">
<table>
<tr><td>Titulaire</td><td>Anthony et Camille DELERUE</td></tr>
<tr><td>IBAN</td><td class="iban">FR76 1009 6183 3100 0797 9700 147</td></tr>
<tr><td>BIC</td><td>CMCIFRPP</td></tr>
<tr><td>Banque</td><td>CIC AIX LA DURANNE — RUE ISAAC NEWTON — 13100 AIX EN PROVENCE</td></tr>
</table>
</div>

<h2>Signature</h2>
<p>Veuillez dater et signer ci-dessous avec la mention <strong>« Lu et approuvé »</strong> :</p>
<div class="sigs">
<div class="sig"><div class="sig-lbl">Le locataire :</div><div class="sig-name">${tenant.name || ''}</div></div>
<div class="sig"><div class="sig-lbl">Le bailleur :</div><div class="sig-name">Camille et Anthony DELERUE</div>${signatureB64 ? `<img src="${signatureB64}" style="max-width:200px;max-height:65px;margin-top:8px;display:block">` : ''}</div>
</div>

<div class="footer">Camille et Anthony DELERUE — 5913 route des grandes terres, 13480 CABRIES — 07 49 89 54 97 — delerue.anthony@hotmail.fr</div>
</body>
</html>`;
};

const isJustine = (name) => name && name.toLowerCase().includes('justine');

const fmtSaved = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} à ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

export default function ContratModal({ tenant, property, providerEmails, onClose, onSave, savedData }) {
  const cleaningExp = (tenant.resExpenses || []).find(e =>
    e.type?.toLowerCase().includes('menage') || e.type?.toLowerCase().includes('nettoyage')
  );
  const contactExp = (tenant.resExpenses || []).find(e =>
    e.person && !e.person.toLowerCase().includes('dias')
  );

  const initContactName = contactExp?.person || 'Justine';
  const initContactPhone = isJustine(initContactName) ? '06 70 30 91 84' : (contactExp ? (providerEmails?.[contactExp.person] || '') : '');

  const [form, setForm] = useState(savedData?.form || {
    arrivalTime: '16:00',
    departureTime: '11:00',
    cleaningBy: cleaningExp ? 'prestataire' : 'locataire',
    cleaningFee: cleaningExp ? (parseFloat(cleaningExp.amount) || '').toString() : '',
    maxPersons: '4',
    contactName: initContactName,
    contactPhone: initContactPhone,
    tenantEmail: '',
    specialNotes: '',
    soldeMode: 'virement_10j',
    taxeSejour: 'non',
    taxeSejourDetail: '',
  });

  const [cautions, setCautions] = useState(savedData?.cautions || [
    { id: 1, label: 'Ménage', amount: '50', checked: true },
    { id: 2, label: 'Appartement', amount: String(parseFloat(tenant.deposit) || 500), checked: true },
  ]);

  const [error, setError] = useState('');

  const addCaution = () => setCautions(p => [...p, { id: Date.now(), label: '', amount: '', checked: true }]);
  const removeCaution = (id) => setCautions(p => p.filter(c => c.id !== id));
  const updateCaution = (id, field, val) => setCautions(p => p.map(c => c.id === id ? { ...c, [field]: val } : c));

  const generate = () => {
    setError('');
    try {
      const html = buildHTML(form, cautions, tenant, SIGNATURE_B64);
      const win = window.open('', '_blank');
      if (!win) {
        setError('Popup bloquée par le navigateur. Autorisez les popups pour ce site puis réessayez.');
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      if (onSave) onSave({ form, cautions, savedAt: new Date().toISOString() });
    } catch (e) {
      setError('Erreur : ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[40px] shadow-2xl max-w-md w-full border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden mx-4">

        <div className="p-6 border-b flex items-center gap-4">
          <div className="bg-blue-50 text-blue-500 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
            <FileText size={24}/>
          </div>
          <div className="flex-1">
            <h3 className="font-black text-lg uppercase tracking-tighter">Générer le contrat</h3>
            <p className="text-[10px] text-slate-400 uppercase font-black mt-0.5">{tenant.name} · {property?.name}</p>
            {savedData?.savedAt && <p className="text-[9px] text-green-600 font-black mt-0.5">Enregistré le {fmtSaved(savedData.savedAt)}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700"><X size={20}/></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Heure d'arrivée</label>
              <input type="time" value={form.arrivalTime} onChange={e => setForm({ ...form, arrivalTime: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none"/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Heure de départ</label>
              <input type="time" value={form.departureTime} onChange={e => setForm({ ...form, departureTime: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none"/>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Ménage de fin de séjour</label>
            <select value={form.cleaningBy} onChange={e => setForm({ ...form, cleaningBy: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none mb-2 bg-white">
              <option value="prestataire">Par un prestataire (frais en sus)</option>
              <option value="locataire">À la charge du locataire</option>
              <option value="inclus">Inclus dans le prix</option>
            </select>
            {form.cleaningBy === 'prestataire' && (
              <input type="number" value={form.cleaningFee} onChange={e => setForm({ ...form, cleaningFee: e.target.value })} placeholder="Frais de ménage €" className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none"/>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Nb max personnes</label>
              <input type="number" value={form.maxPersons} onChange={e => setForm({ ...form, maxPersons: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none"/>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Contact sur place</label>
              <input type="text" value={form.contactName} onChange={e => {
                const name = e.target.value;
                setForm(f => ({ ...f, contactName: name, ...(isJustine(name) ? { contactPhone: '06 70 30 91 84' } : {}) }));
              }} className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none"/>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Téléphone contact sur place</label>
            <input type="text" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none"/>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Email du locataire</label>
            <input type="email" value={form.tenantEmail} onChange={e => setForm({ ...form, tenantEmail: e.target.value })} placeholder="exemple@mail.com" className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none"/>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Mode de règlement du solde</label>
            <select value={form.soldeMode} onChange={e => setForm({ ...form, soldeMode: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none bg-white">
              <option value="virement_10j">Virement — 10 jours avant l'arrivée</option>
              <option value="main_propre">En mains propres</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Taxe de séjour</label>
            <select value={form.taxeSejour} onChange={e => setForm({ ...form, taxeSejour: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none bg-white mb-2">
              <option value="non">Non applicable</option>
              <option value="incluse">Incluse dans le prix</option>
              <option value="ensus">En sus (à préciser)</option>
            </select>
            {form.taxeSejour === 'ensus' && (
              <input type="text" value={form.taxeSejourDetail} onChange={e => setForm({ ...form, taxeSejourDetail: e.target.value })} placeholder="Ex : 1,65 € par personne et par nuit" className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none text-sm"/>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-black uppercase text-slate-400">Cautions</label>
              <button type="button" onClick={addCaution} className="flex items-center gap-1 text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors">
                <Plus size={11}/> Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {cautions.map(c => (
                <div key={c.id} className="flex gap-2 items-center">
                  <input type="checkbox" checked={c.checked !== false} onChange={e => updateCaution(c.id, 'checked', e.target.checked)} className="w-4 h-4 accent-blue-600 flex-shrink-0"/>
                  <input type="text" value={c.label} onChange={e => updateCaution(c.id, 'label', e.target.value)} placeholder="Ex: Appartement" className={`flex-1 p-2.5 border rounded-xl font-black text-slate-700 outline-none text-sm ${c.checked === false ? 'border-slate-100 text-slate-300' : 'border-slate-200'}`}/>
                  <input type="number" value={c.amount} onChange={e => updateCaution(c.id, 'amount', e.target.value)} placeholder="€" className={`w-20 p-2.5 border rounded-xl font-black text-slate-700 outline-none text-sm ${c.checked === false ? 'border-slate-100 text-slate-300' : 'border-slate-200'}`}/>
                  <button type="button" onClick={() => removeCaution(c.id)} className="p-2 text-rose-400 hover:text-rose-600 transition-colors"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">À savoir <span className="normal-case font-medium text-slate-300">(optionnel — apparaît dans le contrat si rempli)</span></label>
            <textarea value={form.specialNotes} onChange={e => setForm({ ...form, specialNotes: e.target.value })} rows={3} placeholder="Une ligne = un point. Laisser vide pour ne pas afficher cette section." className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none resize-none text-sm"/>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-[11px] font-bold text-rose-600">{error}</div>
          )}
        </div>

        <div className="p-4 border-t flex flex-col gap-2">
          <button type="button" onClick={generate} className="w-full p-4 rounded-2xl font-black uppercase text-[10px] text-white bg-blue-600 shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
            <Download size={16}/>
            Ouvrir le contrat
          </button>
          <button type="button" onClick={onClose} className="w-full py-3 rounded-2xl font-black uppercase text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
