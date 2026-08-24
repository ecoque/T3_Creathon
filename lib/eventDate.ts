// Etkinlik "bugün"ü her zaman İstanbul saatine göre hesaplanır — cihazın
// kendi saat dilimi ne olursa olsun (ör. yurt dışından test eden bir cihaz)
// yemek menüsü/atama tabloları aynı takvim gününe düşer.

const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';

// 'YYYY-MM-DD' — meals.event_date / meal_assignments.event_date (date sütunu) ile birebir uyumlu.
export function istanbulDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ISTANBUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

// event_date ('YYYY-MM-DD') + 'HH:MM' (İstanbul yerel saati) -> ISO timestamptz.
export function istanbulTimestamp(eventDate: string, hhmm: string): string {
  return new Date(`${eventDate}T${hhmm}:00+03:00`).toISOString();
}
