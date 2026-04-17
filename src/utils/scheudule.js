const booked = {}; // { "2026-04-20": ["12:00", "15:00"] }

const WORK_HOURS = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00"
];

function getAvailableSlots(date) {
  const busy = booked[date] || [];
  return WORK_HOURS.filter(t => !busy.includes(t));
}

function bookSlot(date, time) {
  if (!booked[date]) booked[date] = [];
  booked[date].push(time);
}

function isSlotAvailable(date, time) {
  const busy = booked[date] || [];
  return !busy.includes(time);
}

module.exports = {
  getAvailableSlots,
  bookSlot,
  isSlotAvailable
};