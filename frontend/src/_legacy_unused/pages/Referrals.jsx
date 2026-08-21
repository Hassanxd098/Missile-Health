import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import Card, { Button, Field, inputClass, StatusBadge } from "../components/ui";
import client from "../api/client";

export default function Referrals() {
  const [specialty, setSpecialty] = useState("Cardiologist");
  const [caseNotes, setCaseNotes] = useState("");
  const [mine, setMine] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [error, setError] = useState(null);

  async function load() {
    try {
      const { data } = await client.get("/referrals/mine");
      setMine(data);
    } catch { /* not onboarded */ }
  }
  useEffect(() => { load(); }, []);

  async function requestSecondOpinion() {
    setError(null);
    try {
      const { data } = await client.post("/referrals/second-opinion", { specialty, caseNotes });
      setMine([data.referral, ...mine]);
      setSuggestions({ ...suggestions, [data.referral.id]: data.suggestedDoctors });
    } catch (e) { setError(e.response?.data?.error || "Please complete onboarding first."); }
  }

  async function confirmBooking(referralId, doctorId) {
    try {
      await client.post(`/referrals/${referralId}/confirm`, { doctorId, date: "2026-08-05", time: "10:00" });
      load();
    } catch (e) { setError(e.response?.data?.error); }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Doctor Referral & Second Opinion" subtitle="Module 5 — escalate to specialist care" />
      <div className="flex-1 p-8 max-w-3xl space-y-6">
        <Card>
          <h3 className="font-medium text-sm mb-4">Request a second opinion</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Specialty">
              <select className={inputClass} value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                <option>Cardiologist</option><option>Dermatologist</option><option>Orthopedic</option>
                <option>ENT Specialist</option><option>Pediatrician</option><option>General Physician</option>
              </select>
            </Field>
          </div>
          <Field label="Case notes">
            <textarea className={`${inputClass} min-h-[80px]`} value={caseNotes} onChange={(e) => setCaseNotes(e.target.value)} placeholder="Briefly describe your case…" />
          </Field>
          <div className="flex justify-end mt-4">
            <Button onClick={requestSecondOpinion}>Request second opinion</Button>
          </div>
          {error && <p className="text-sm text-[var(--color-danger)] mt-2">{error}</p>}
        </Card>

        <div>
          <h3 className="font-[var(--font-display)] text-lg mb-3">Your referrals</h3>
          <div className="grid gap-3">
            {mine.map((r) => (
              <Card key={r.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{r.type === "second_opinion" ? "Second opinion" : "Doctor referral"} — {r.specialty || r.toSpecialty}</span>
                  <StatusBadge status={r.status} />
                </div>
                {r.caseNotes && <p className="text-xs text-[var(--color-ink-soft)] mb-2">{r.caseNotes}</p>}
                {r.status !== "booked" && suggestions[r.id]?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {suggestions[r.id].map((d) => (
                      <Button key={d.id} variant="ghost" className="!py-1.5 !px-3" onClick={() => confirmBooking(r.id, d.id)}>
                        Book with {d.name}
                      </Button>
                    ))}
                  </div>
                )}
                {r.status === "booked" && <p className="text-xs text-[var(--color-primary)]">Appointment {r.appointmentId} confirmed.</p>}
              </Card>
            ))}
            {mine.length === 0 && <Card><p className="text-sm text-[var(--color-ink-soft)]">No referrals yet.</p></Card>}
          </div>
        </div>
      </div>
    </div>
  );
}
