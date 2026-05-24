import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { X, FileText, Download } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { db, storage, appId } from './firebaseConfig';

const OWNER = {
  name: 'Camille et Anthony DELERUE',
  address: '5913 route des grandes terres, 13480 CABRIES',
  phone: '07 49 89 54 97',
  email: 'delerue.anthony@hotmail.fr',
};

const RIB = {
  titulaire: 'M ANTHONY DELERUE / MME CAMILLE BEURAERT',
  adresseTitulaire: '4755 ROUTE DU PONT DE BOUC, 13480 CABRIES',
  iban: 'FR76 1009 6183 3100 0797 9700 147',
  bic: 'CMCIFRPP',
  domiciliation: 'CIC AIX LA DURANNE — RUE ISAAC NEWTON — 13100 AIX EN PROVENCE',
};

const CADELIO_ADDRESS = [
  'Apt B 401 au 4ème étage de la résidence Edelweiss',
  'Allée des Saules, 05240 La Salle-les-Alpes',
  'Serre Chevalier, Hautes-Alpes',
];

const CADELIO_EQUIPMENT = [
  '1 lit double 160 x 200',
  '3 lits superposés 80 x 190',
  '2 lits en mezzanine 80 x 190',
  '1 canapé lit Rapido 140 x 190',
  'Un lave-vaisselle',
  'Un réfrigérateur avec congélateur',
  'Un micro-onde et mini four',
  'Un grille-pain',
  'Une machine à café Senseo et filtre',
  'Une bouilloire',
  'Un set raclette et fondue',
  'Une Smart TV',
  '2 balcons',
  'Parking gratuit à l\'entrée de la résidence',
  'Rangement à skis sécurisé',
  'Le linge de lit, serviettes et torchons ne sont pas compris (disponibles en option)',
];

const fmt = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

export default function ContratModal({ tenant, property, providerEmails, onClose, onSaved }) {
  const cleaningExp = (tenant.resExpenses || []).find(e =>
    e.type?.toLowerCase().includes('ménage') || e.type?.toLowerCase().includes('menage')
  );
  const contactExp = (tenant.resExpenses || []).find(e =>
    e.person && !e.person.toLowerCase().includes('dias')
  );

  const [form, setForm] = useState({
    arrivalTime: '16:00',
    departureTime: '11:00',
    cleaningBy: cleaningExp ? 'prestataire' : 'locataire',
    cleaningFee: cleaningExp ? (parseFloat(cleaningExp.amount) || '').toString() : '',
    maxPersons: '4',
    deposit: (parseFloat(tenant.deposit) || 500).toString(),
    contactName: contactExp?.person || 'Justine',
    contactPhone: contactExp ? (providerEmails?.[contactExp.person] || '') : '',
    specialNotes: 'Animaux interdits',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const generate = async () => {
    setSaving(true);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const W = 210;
    const M = 20;
    const CW = W - 2 * M;
    let y = 20;

    const nl = (n = 1) => { y += n; };
    const checkPage = (needed = 20) => { if (y + needed > 280) { pdf.addPage(); y = 20; } };

    const h1 = (text) => {
      checkPage(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text(text, M, y);
      y += 9;
    };
    const body = (text, indent = 0) => {
      checkPage(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(text, CW - indent);
      pdf.text(lines, M + indent, y);
      y += lines.length * 5.5;
    };
    const bold = (text, indent = 0) => {
      checkPage(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(text, CW - indent);
      pdf.text(lines, M + indent, y);
      y += lines.length * 5.5;
      pdf.setFont('helvetica', 'normal');
    };
    const bullet = (text) => { body(`• ${text}`, 3); };
    const sep = () => {
      checkPage(6);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(M, y, W - M, y);
      y += 6;
    };

    // --- TITRE ---
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text('CONTRAT DE LOCATION', W / 2, y, { align: 'center' });
    y += 5;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Référence : ${tenant.name?.replace(/\s+/g, '_')}_${tenant.startDate}`, W / 2, y + 3, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    y += 10;
    sep();

    // --- INTRO ---
    body('Madame, Monsieur,');
    nl(3);
    body('Suite à votre demande, j\'ai l\'amabilité de vous proposer le contrat de location suivant.');
    body('Si cette proposition retient votre attention, veuillez me renvoyer un exemplaire revêtu de votre accord et accompagné du règlement.');
    body('En souhaitant bientôt vous accueillir, je vous adresse mes salutations.');
    nl(8);

    // --- ADRESSE ---
    h1('Adresse du logement');
    CADELIO_ADDRESS.forEach(line => body(line));
    pdf.setTextColor(0, 80, 200);
    body('https://goo.gl/maps/U1x4oWFEjc1vJN629');
    pdf.setTextColor(0, 0, 0);
    nl(6);

    // --- CONDITIONS DE LOCATION ---
    h1('Le propriétaire loue :');
    const amount = parseFloat(tenant.grossAmount) || 0;
    body(`Du ${fmt(tenant.startDate)} à ${form.arrivalTime} au ${fmt(tenant.endDate)} à ${form.departureTime}`);
    nl(2);
    body(`Le montant de la location est fixé à ${amount.toFixed(0)} € net toutes charges comprises pour un maximum de ${form.maxPersons} personnes.`);
    nl(2);
    if (form.cleaningBy === 'prestataire' && form.cleaningFee) {
      body(`Les frais de ménage de ${form.cleaningFee} € sont à rajouter au prix de la location.`);
    } else if (form.cleaningBy === 'locataire') {
      body('Le ménage de fin de séjour est à la charge du locataire.');
    } else {
      body('Les frais de ménage sont inclus dans le prix de la location.');
    }
    nl(6);

    // --- EQUIPEMENTS ---
    h1('Dans l\'appartement vous trouverez :');
    nl(1);
    CADELIO_EQUIPMENT.forEach(item => bullet(item));
    nl(6);

    // --- A SAVOIR ---
    h1('À savoir :');
    nl(1);
    if (form.specialNotes) {
      form.specialNotes.split('\n').filter(l => l.trim()).forEach(line => bullet(line));
    }
    if (form.contactName && form.contactPhone) {
      bullet(`Votre contact sur place sera ${form.contactName} au ${form.contactPhone}`);
    }
    if (form.deposit) {
      bullet(`Un chèque de caution de ${form.deposit} € vous sera demandé à votre arrivée.`);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      const cautionNote = '(Cette caution sera restituée au départ. Si des dégradations sont constatées, il se peut que la caution soit conservée partiellement ou totalement)';
      const cLines = pdf.splitTextToSize(cautionNote, CW - 6);
      checkPage(cLines.length * 5 + 2);
      pdf.text(cLines, M + 6, y);
      y += cLines.length * 5 + 2;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
    }
    nl(6);

    // --- RESERVATION / PAIEMENT ---
    checkPage(40);
    h1('La réservation :');
    nl(1);

    const a1 = parseFloat(tenant.acompte1Amount) || 0;
    const a2 = parseFloat(tenant.acompte2Amount) || 0;
    const s = parseFloat(tenant.soldeAmount) || 0;

    if (a1 > 0) {
      let txt = `Un acompte de ${a1.toFixed(0)} euros par virement est demandé pour bloquer la réservation.`;
      if (tenant.acompte1DueDate) txt += ` À régler avant le ${fmt(tenant.acompte1DueDate)}.`;
      body(txt);
      body('(Non remboursable en cas d\'annulation par vos soins)');
      nl(3);
    }
    if (a2 > 0) {
      let txt = `Un deuxième acompte de ${a2.toFixed(0)} euros par virement est demandé.`;
      if (tenant.acompte2DueDate) txt += ` À régler avant le ${fmt(tenant.acompte2DueDate)}.`;
      body(txt);
      nl(3);
    }
    if (s > 0) {
      let txt = `Le solde de ${s.toFixed(0)} euros sera à régler par virement`;
      if (tenant.soldeDueDate) txt += ` avant le ${fmt(tenant.soldeDueDate)}.`;
      else txt += ' une semaine avant votre arrivée.';
      body(txt);
      nl(3);
    }

    body('La réservation prendra effet à réception de l\'acompte et du présent contrat daté et signé avec la mention « Lu et approuvé ».');
    nl(2);
    body('Au-delà de cette date la réservation sera annulée, le propriétaire disposera de la location à sa convenance.');
    nl(8);

    // --- RIB ---
    checkPage(50);
    h1('Coordonnées bancaires (RIB)');
    nl(1);

    const ribLines = [
      ['Titulaire', RIB.titulaire],
      ['', RIB.adresseTitulaire],
      ['IBAN', RIB.iban],
      ['BIC', RIB.bic],
      ['Domiciliation', RIB.domiciliation],
    ];
    ribLines.forEach(([label, value]) => {
      checkPage(7);
      if (label) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(`${label} :`, M, y);
        pdf.setFont('helvetica', 'normal');
        const vLines = pdf.splitTextToSize(value, CW - 35);
        pdf.text(vLines, M + 35, y);
        y += Math.max(vLines.length, 1) * 5.5;
      } else {
        body(value, 35);
      }
    });
    nl(8);

    // --- SIGNATURE ---
    checkPage(45);
    h1('Signature');
    body('Veuillez dater et signer ci-dessous avec la mention « Lu et approuvé » :');
    nl(4);

    const bW = (CW - 10) / 2;
    pdf.setDrawColor(150, 150, 150);
    pdf.rect(M, y, bW, 30);
    pdf.rect(M + bW + 10, y, bW, 30);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Le locataire :', M + 2, y + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(tenant.name || '', M + 2, y + 11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Le bailleur :', M + bW + 12, y + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Camille et Anthony DELERUE', M + bW + 12, y + 11);
    y += 40;

    // --- PIED DE PAGE ---
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`${OWNER.name} — ${OWNER.address} — ${OWNER.phone} — ${OWNER.email}`, W / 2, y, { align: 'center' });
    pdf.setTextColor(0, 0, 0);

    const fileName = `Contrat_${(tenant.name || 'locataire').replace(/\s+/g, '_')}_${tenant.startDate || 'date'}.pdf`;
    const pdfBlob = pdf.output('blob');

    // Sauvegarde Firebase Storage
    try {
      const storageRef = ref(storage, `contrats/${appId}/${tenant.id}/${fileName}`);
      await uploadBytes(storageRef, pdfBlob);
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tenants', tenant.id),
        { contratPdfUrl: url, contratPdfName: fileName },
        { merge: true }
      );
      if (onSaved) onSaved(url, fileName);
    } catch (e) {
      // Storage non configuré ou erreur — on télécharge quand même
    }

    pdf.save(fileName);
    setSaving(false);
    setDone(true);
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
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700"><X size={20}/></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {done ? (
            <div className="text-center py-6">
              <div className="bg-emerald-50 text-emerald-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                <Download size={28}/>
              </div>
              <p className="font-black uppercase text-sm text-slate-700">Contrat généré !</p>
              <p className="text-[10px] text-slate-400 mt-1">Le PDF a été téléchargé et sauvegardé dans la fiche.</p>
            </div>
          ) : (
            <>
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
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Caution €</label>
                  <input type="number" value={form.deposit} onChange={e => setForm({ ...form, deposit: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Contact sur place</label>
                  <input type="text" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none"/>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Téléphone contact</label>
                  <input type="text" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none"/>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Règles particulières (une par ligne)</label>
                <textarea value={form.specialNotes} onChange={e => setForm({ ...form, specialNotes: e.target.value })} rows={3} placeholder="Animaux interdits&#10;Pas de fête..." className="w-full p-3 border border-slate-200 rounded-xl font-black text-slate-700 outline-none resize-none text-sm"/>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t flex flex-col gap-2">
          {!done ? (
            <button onClick={generate} disabled={saving} className="w-full p-4 rounded-2xl font-black uppercase text-[10px] text-white bg-blue-600 shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              <Download size={16}/>
              {saving ? 'Génération en cours...' : 'Générer et télécharger le PDF'}
            </button>
          ) : (
            <button onClick={generate} disabled={saving} className="w-full p-4 rounded-2xl font-black uppercase text-[10px] text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
              <Download size={16}/>
              Retélécharger
            </button>
          )}
          <button onClick={onClose} className="w-full py-3 rounded-2xl font-black uppercase text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
            {done ? 'Fermer' : 'Annuler'}
          </button>
        </div>
      </div>
    </div>
  );
}
