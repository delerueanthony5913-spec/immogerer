const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export const getAccessToken = () => localStorage.getItem('gcal_token');
export const setAccessToken = (token) => localStorage.setItem('gcal_token', token);
export const clearAccessToken = () => localStorage.removeItem('gcal_token');

const call = async (method, url, body = null, sendUpdates = null) => {
  const token = getAccessToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');
  const finalUrl = sendUpdates ? `${url}?sendUpdates=${sendUpdates}` : url;
  const res = await fetch(finalUrl, {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null,
  });
  if (res.status === 401) { clearAccessToken(); throw new Error('TOKEN_EXPIRED'); }
  if (!res.ok) throw new Error(`CALENDAR_ERROR:${res.status}`);
  if (res.status === 204) return null;
  return res.json();
};

const buildEvent = (reservation, propertyName, providerEmails = {}, colorId = null) => {
  const seen = new Set();
  const attendees = [];
  (reservation.resExpenses || []).forEach(exp => {
    const email = providerEmails[exp.person];
    if (exp.sendEmail !== false && email && !exp.person.toLowerCase().includes('dias') && !seen.has(email)) {
      seen.add(email);
      attendees.push({ email });
    }
  });

  let description = `Client : ${reservation.name}`;
  if (reservation.phone) description += `\nContact : ${reservation.phone}`;
  description += `\nPlateforme : ${reservation.platform}`;
  if (reservation.comment) description += `\nNotes : ${reservation.comment}`;
  if (reservation.resExpenses?.length > 0) {
    description += '\n\nPrestations :';
    reservation.resExpenses.forEach(exp => {
      description += `\n- ${exp.type} (${exp.person}) : ${exp.amount}€`;
    });
  }

  const endDateObj = new Date(reservation.endDate);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDate = endDateObj.toISOString().split('T')[0];

  const event = {
    summary: `${reservation.name} — ${propertyName}`,
    description,
    start: { date: reservation.startDate },
    end: { date: endDate },
  };
  if (attendees.length > 0) event.attendees = attendees;
  if (colorId) event.colorId = String(colorId);
  return event;
};

export const createCalendarEvent = (calendarId, reservation, propertyName, providerEmails, colorId) =>
  call('POST', `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    buildEvent(reservation, propertyName, providerEmails, colorId));

export const updateCalendarEvent = (calendarId, eventId, reservation, propertyName, providerEmails, colorId) =>
  call('PUT', `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    buildEvent(reservation, propertyName, providerEmails, colorId));

export const deleteCalendarEvent = (calendarId, eventId) =>
  call('DELETE', `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);

const buildDiasEvent = (exp, propertyName, type, diasEmail, colorId = null) => {
  const isEntry = type === 'ENTREE';
  const date = isEntry ? exp.dateEntry : exp.dateExit;
  const time = isEntry ? (exp.timeEntry || '10:00') : (exp.timeExit || '10:00');
  const hours = parseFloat(isEntry ? exp.hoursEntry : exp.hoursExit) || 0;
  const rate = parseFloat(isEntry ? exp.rateEntry : exp.rateExit) || 0;
  const slotTotal = (hours * rate).toFixed(2);

  const [y, m, d] = date.split('-');
  const [hh, mm] = time.split(':');
  const start = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
  const end = new Date(start.getTime() + hours * 3600000);
  const fmt = (dt) =>
    `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}T${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}:00`;

  let description = `Logement : ${propertyName}\nDurée : ${hours}h\nTarif : ${rate}€/h\nTotal : ${slotTotal}€`;
  if (exp.providerNote) description += `\n\nNotes :\n${exp.providerNote}`;

  const event = {
    summary: `Ménage ${isEntry ? 'Entrée' : 'Sortie'} — ${propertyName}`,
    description,
    start: { dateTime: fmt(start), timeZone: 'Europe/Paris' },
    end: { dateTime: fmt(end), timeZone: 'Europe/Paris' },
  };
  if (diasEmail) event.attendees = [{ email: diasEmail }];
  if (colorId) event.colorId = String(colorId);
  return event;
};

export const createDiasEvent = (calendarId, exp, propertyName, type, diasEmail, colorId) =>
  call('POST', `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    buildDiasEvent(exp, propertyName, type, diasEmail, colorId), 'all');

export const updateDiasEvent = (calendarId, eventId, exp, propertyName, type, diasEmail, colorId) =>
  call('PUT', `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    buildDiasEvent(exp, propertyName, type, diasEmail, colorId), 'none');

export const deleteDiasEvent = (calendarId, eventId) =>
  call('DELETE', `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, null, 'all');
