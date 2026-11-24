// Conversión de horas locales (sin zona horaria) a UTC.

export function tzOffsetMinutes(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, +p.value]),
  );
  const local = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((local - date.getTime()) / 60000);
}

/** Hora local de una zona (año, mes 1-12, día, h, min, s) -> ISO en UTC. */
export function localToISO(y, mo, d, h, mi, s, timeZone) {
  const asUTC = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s || 0);
  const offset = tzOffsetMinutes(new Date(asUTC), timeZone);
  return new Date(asUTC - offset * 60000).toISOString();
}
