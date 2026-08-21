import { Router } from "express";
import { db } from "../models/db.js";
import { analyzeSymptoms } from "../services/aiEngine.js";
import { requirePatient } from "../middleware/auth.js";

const router = Router();

function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function nextAvailability(doctorId) {
  const upcoming = db.data.slots
    .filter(s => s.doctorId === doctorId && s.booked < s.capacity)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return upcoming[0] ? `${upcoming[0].date} ${upcoming[0].time}` : "By request";
}

// FR-03, FR-04: analyze symptoms, rank doctors by specialty match + proximity + availability
router.post("/analyze", requirePatient, (req, res) => {
  const { text, lat, lng, radiusKm = 15 } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });

  const analysis = analyzeSymptoms(text);
  if (analysis.emergency) {
    return res.json({ ...analysis, doctors: [], nearestErPrompt: "Locating the nearest emergency room based on your location." });
  }

  const origin = lat && lng ? { lat, lng } : { lat: 11.664, lng: 78.146 };
  let candidates = db.data.doctors
    .filter(d => d.verified && d.specialty === analysis.specialty)
    .map(d => ({ ...d, distanceKm: Math.round(distanceKm(origin, d) * 10) / 10, nextAvailable: nextAvailability(d.id) }))
    .filter(d => d.distanceKm <= radiusKm)
    .sort((a, b) => a.nextAvailable.localeCompare(b.nextAvailable) || a.distanceKm - b.distanceKm);

  let broadened = false;
  if (candidates.length === 0) {
    broadened = true;
    candidates = db.data.doctors
      .filter(d => d.verified && d.specialty === analysis.specialty)
      .map(d => ({ ...d, distanceKm: Math.round(distanceKm(origin, d) * 10) / 10, nextAvailable: nextAvailability(d.id) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  res.json({ ...analysis, broadenedSearch: broadened, doctors: candidates });
});

router.get("/directory", (req, res) => {
  const { specialty } = req.query;
  const list = specialty ? db.data.doctors.filter(d => d.specialty === specialty) : db.data.doctors;
  res.json(list);
});

export default router;
