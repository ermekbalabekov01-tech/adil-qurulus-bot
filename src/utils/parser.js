function parseDate(text) {
  text = text.toLowerCase();

  const today = new Date();

  if (text.includes('сегодня')) {
    return today.toISOString().slice(0, 10);
  }

  if (text.includes('завтра')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  const match = text.match(/(\d{1,2})[.\s]?(\d{1,2})?/);

  if (match) {
    const day = match[1];
    const month = match[2] || today.getMonth() + 1;

    return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

function parseTime(text) {
  const match = text.match(/(\d{1,2})[:.]?(\d{2})?/);

  if (!match) return null;

  const h = match[1];
  const m = match[2] || '00';

  return `${String(h).padStart(2, '0')}:${m}`;
}

module.exports = {
  parseDate,
  parseTime
};