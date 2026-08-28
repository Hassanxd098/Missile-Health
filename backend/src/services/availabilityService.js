// Convert human-friendly visiting hours into structured booking windows so that
// availability written as free text ("Mon-Sat, 10 AM-2 PM") is enforced the
// same way as the structured editor. Returns slots like [{ day, start, end }].

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const to24 = (h, m, mer) => {
  const mLower = String(mer || "").toLowerCase();
  const hour = (h === 12 ? 0 : h) + (mLower === "pm" ? 12 : 0);
  return hour * 60 + (m || 0);
};

const fmt = (h, m) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor(m)).padStart(2, "0")}`;
const fmt12 = (mins) => {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
};

const RANGE_RE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to|till|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi;

// Extract one or more time windows from a string, e.g. "10 AM - 2 PM", "5-9 pm".
export function parseTimeWindows(text) {
  const out = [];
  const t = String(text || "");
  let m;
  RANGE_RE.lastIndex = 0;
  while ((m = RANGE_RE.exec(t))) {
    const h1 = Number(m[1]);
    const min1 = Number(m[2] || 0);
    const h2 = Number(m[4]);
    const min2 = Number(m[5] || 0);
    const mer1 = m[3] ? m[3].toLowerCase() : undefined;
    const mer2 = m[6] ? m[6].toLowerCase() : undefined;

    // Infer missing meridians ("10 to 2 pm" -> 10:00 AM - 2:00 PM).
    let sMer = mer1;
    let eMer = mer2;
    if (!sMer && eMer) sMer = h1 >= h2 ? (eMer === "pm" ? "am" : "pm") : eMer;
    if (sMer && !eMer) eMer = h2 >= h1 ? sMer : (sMer === "pm" ? "am" : "pm");

    let start = to24(h1, min1, sMer || "am");
    let end = to24(h2, min2, eMer || "am");
    if (end <= start) end += 12 * 60; // shorthand short-hand crossing noon
    if (end > 24 * 60) continue;
    out.push({ start: fmt(start / 60, start % 60), end: fmt(end / 60, end % 60) });
  }
  return out;
}

// Extract weekdays, supporting lists and ranges: "Mon-Fri", "mon, wed, sun", "daily".
export function parseDays(text) {
  const t = String(text || "").toLowerCase();
  if (/(^|[^a-z])(all|daily|every day|7 days|whole week)/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  const set = new Set();
  const rangeRe = /\b(sun|mon|tue|wed|thu|fri|sat)(?:day)?\s*[-–]\s*(sun|mon|tue|wed|thu|fri|sat)(?:day)?/g;
  let m;
  while ((m = rangeRe.exec(t))) {
    const a = DAY_SHORT[m[1]];
    const b = DAY_SHORT[m[2]];
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (let d = lo; d <= hi; d++) set.add(d);
  }
  const singleRe = /\b(sun|mon|tue|wed|thu|fri|sat)(?:day)?\b/g;
  const cleaned = t.replace(rangeRe, " ");
  while ((m = singleRe.exec(cleaned))) set.add(DAY_SHORT[m[1]]);
  return set.size ? [...set].sort() : [0, 1, 2, 3, 4, 5, 6];
}

// Full conversion: free-text visiting hours -> structured availability slots.
export function visitingTextToSlots(text) {
  const windows = parseTimeWindows(text);
  if (!windows.length) return [];
  const slots = [];
  parseDays(text).forEach((day) => windows.forEach((w) => slots.push({ day, start: w.start, end: w.end })));
  return slots;
}

// Structured slots -> compact human text for display ("Mon–Sat 10:00 AM-2:00 PM; Thu 5:00 PM-8:00 PM").
export function visitingTextFromSlots(slots) {
  if (!slots || !slots.length) return "";
  const byDay = {};
  slots.forEach((s) => {
    if (s.start && s.end) {
      const d = Number(s.day);
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(s);
    }
  });

  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  if (!days.length) return "";

  const formatDayTimes = (daySlots) => {
    return daySlots
      .map((s) => `${fmt12(toMin(s.start))}-${fmt12(toMin(s.end))}`)
      .join(", ");
  };

  const timeGroupMap = {};
  days.forEach((d) => {
    const timeStr = formatDayTimes(byDay[d]);
    if (!timeGroupMap[timeStr]) timeGroupMap[timeStr] = [];
    timeGroupMap[timeStr].push(d);
  });

  const formatDayList = (dayList) => {
    if (dayList.length === 7) return "Daily";
    if (dayList.length === 6 && !dayList.includes(0)) return "Mon–Sat";
    if (dayList.length === 5 && dayList.every((d, i) => d === i + 1)) return "Mon–Fri";

    const segments = [];
    let start = dayList[0];
    let prev = start;

    for (let i = 1; i < dayList.length; i++) {
      if (dayList[i] === prev + 1) {
        prev = dayList[i];
      } else {
        segments.push(start === prev ? DAYS[start].slice(0, 3) : `${DAYS[start].slice(0, 3)}–${DAYS[prev].slice(0, 3)}`);
        start = dayList[i];
        prev = start;
      }
    }
    segments.push(start === prev ? DAYS[start].slice(0, 3) : `${DAYS[start].slice(0, 3)}–${DAYS[prev].slice(0, 3)}`);
    return segments.join(", ");
  };

  return Object.entries(timeGroupMap)
    .map(([timeStr, dayList]) => `${formatDayList(dayList)} ${timeStr}`)
    .join("; ");
}

const toMin = (t) => {
  const [h, m] = String(t || "").split(":").map(Number);
  return (Number(h) || 0) * 60 + (Number(m) || 0);
};

// A slot overlaps the hourly break when it ends after the break begins
// (e.g. breakMinutes 15 => 10:45-11:00 is blocked for every hour).
const overlapsBreak = (startMin, duration, breakMinutes) => {
  if (!breakMinutes) return false;
  const hourStart = Math.floor(startMin / 60) * 60;
  const breakStart = hourStart + (60 - breakMinutes);
  return startMin + duration > breakStart;
};

// The doctor's enforcement windows: structured availability first, otherwise
// free-text visiting hours are parsed into windows.
export function doctorWindows(doctor) {
  let structured = Array.isArray(doctor?.profile?.availability) && doctor.profile.availability.length
    ? doctor.profile.availability
    : [];

  if (doctor?.profile?.visitingHours) {
    const parsedFromText = visitingTextToSlots(doctor.profile.visitingHours);
    if (parsedFromText.length) {
      if (!structured.length) {
        structured = parsedFromText;
      } else {
        const textHasPM = /pm/i.test(doctor.profile.visitingHours);
        const structHasAMOnly = structured.every((s) => s.start && Number(s.start.split(":")[0]) < 12);
        if (textHasPM && structHasAMOnly) {
          structured = parsedFromText;
        }
      }
    }
  }

  if (!structured.length) {
    structured = defaultAvailability();
  }

  return structured.map((r) => ({ day: Number(r.day), start: r.start, end: r.end })).filter((r) => Number.isInteger(r.day) && r.day >= 0 && r.day <= 6);
}

// Generate every slot minute-of-day the doctor offers for a given date, applying
// the doctor's consult duration and hourly break. Used both to SHOW the patient
// free slots and to VALIDATE a booking, so the two always agree.
export function generateDoctorSlots(doctor, date) {
  const day = date.getDay();
  const slotMinutes = Math.max(15, Number(doctor?.profile?.slotMinutes) || 15);
  const breakMinutes = Math.max(0, Number(doctor?.profile?.breakMinutes) || 0);
  const ranges = doctorWindows(doctor).filter((r) => r.day === day);
  const minutes = [];
  ranges.forEach((r) => {
    const start = toMin(r.start);
    const end = toMin(r.end);
    if (end <= start) return;
    for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
      if (breakMinutes > 0 && overlapsBreak(t, slotMinutes, breakMinutes)) continue;
      minutes.push(t);
    }
  });
  return { slotMinutes, breakMinutes, minutes };
}

// The hospital-wide default daily availability every doctor starts with:
// 10:00 AM to 1:00 PM and 5:00 to 9:00 PM, every day. A doctor removes a day or
// changes the timings from their own "Set working hours" screen when needed.
const DEFAULT_WINDOWS = [
  { day: 0, start: "10:00", end: "13:00" },
  { day: 0, start: "17:00", end: "21:00" },
  { day: 1, start: "10:00", end: "13:00" },
  { day: 1, start: "17:00", end: "21:00" },
  { day: 2, start: "10:00", end: "13:00" },
  { day: 2, start: "17:00", end: "21:00" },
  { day: 3, start: "10:00", end: "13:00" },
  { day: 3, start: "17:00", end: "21:00" },
  { day: 4, start: "10:00", end: "13:00" },
  { day: 4, start: "17:00", end: "21:00" },
  { day: 5, start: "10:00", end: "13:00" },
  { day: 5, start: "17:00", end: "21:00" },
  { day: 6, start: "10:00", end: "13:00" },
  { day: 6, start: "17:00", end: "21:00" },
];

export function defaultAvailability() {
  return DEFAULT_WINDOWS.map((w) => ({ ...w }));
}

// All slot start Date objects the doctor offers for `date`, oldest first,
// excluding times already past. Callers decide which are still free.
export function slotStarts(doctor, date) {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const gen = generateDoctorSlots(doctor, base);
  const now = Date.now();
  const times = [];
  gen.minutes.forEach((minutes) => {
    const d = new Date(base);
    d.setMinutes(minutes, 0, 0);
    if (d.getTime() > now) times.push(d);
  });
  return { times, slotMinutes: gen.slotMinutes, breakMinutes: gen.breakMinutes };
}

// Ensures no two active appointments for a doctor on a given day share the exact same scheduledFor time or duplicate token.
// Staggers clashing times by 15 minutes and re-indexes tokens as T01, T02, T03... in chronological order.
export async function sanitizeDoctorDayQueue(doctorId, date = new Date()) {
  try {
    const Appointment = (await import("../models/Appointment.js")).default;
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);

    const appointments = await Appointment.find({
      doctor: doctorId,
      scheduledFor: { $gte: start, $lt: end },
      status: { $nin: ["cancelled", "missed"] },
    }).sort({ scheduledFor: 1, createdAt: 1 });

    if (!appointments || !appointments.length) return;

    const usedTimes = new Set();
    const slotMinutes = 15;

    for (let i = 0; i < appointments.length; i++) {
      const appt = appointments[i];
      let timeMs = new Date(appt.scheduledFor).getTime();

      // If another patient is already scheduled at this exact time, stagger forward by slotMinutes
      while (usedTimes.has(timeMs)) {
        timeMs += slotMinutes * 60000;
      }

      usedTimes.add(timeMs);
      const newScheduledFor = new Date(timeMs);
      const tokenStr = `T${String(i + 1).padStart(2, "0")}`;

      let updated = false;
      if (appt.scheduledFor.getTime() !== newScheduledFor.getTime()) {
        appt.scheduledFor = newScheduledFor;
        updated = true;
      }
      if (appt.token !== tokenStr) {
        appt.token = tokenStr;
        updated = true;
      }

      if (updated) {
        await appt.save();
      }
    }
  } catch (err) {
    console.error("Error sanitizing doctor day queue:", err);
  }
}