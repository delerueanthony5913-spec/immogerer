export const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1', '#F43F5E', '#06B6D4'];
export const TIME_SLOTS = [];
for (let h = 0; h <= 23; h++) {
  const hour = h.toString().padStart(2, '0');
  TIME_SLOTS.push(`${hour}:00`, `${hour}:30`);
}

export const formatDateFr = (dateString) => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateString;
};

export const isSundayOrHoliday = (dateStr) => {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-');
  const date = new Date(y, m - 1, d);
  if (date.getDay() === 0) return true;
  
  const year = parseInt(y, 10);
  const holidays = [
      `${year}-01-01`, `${year}-05-01`, `${year}-05-08`, `${year}-07-14`, 
      `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25`
  ];
  
  const a = year % 19, b = Math.floor(year / 100), c = year % 100,
        d1 = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
        g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d1 - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
        m1 = Math.floor((a + 11 * h + 22 * l) / 451), n0 = h + l - 7 * m1 + 114,
        month = Math.floor(n0 / 31), day = (n0 % 31) + 1;
        
  const paques = new Date(year, month - 1, day);
  const formatLocal = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  holidays.push(
    formatLocal(new Date(paques.getTime() + 86400000)), // Lundi Pâques
    formatLocal(new Date(paques.getTime() + 3369600000)), // Ascension
    formatLocal(new Date(paques.getTime() + 4320000000)) // Pentecôte
  );
  return holidays.includes(dateStr);
};
