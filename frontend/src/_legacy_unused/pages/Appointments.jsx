import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar";
import Card, { Button, StatusBadge, Field, inputClass } from "../components/ui";
import client from "../api/client";

export default function Appointments() {
  const [params] = useSearchParams();
  const [doctorId, setDoctorId] = useState(params.get("doctorId") || "doc_001");
  const [date, setDate] = useState("2026-08-01");
  const [slots, setSlots] = useState([]);
  const [mine, setMine] = useState([]);
  const [message, setMessage] = useState(null);
  const [doctors, setDoctors] = useState([]);

  async function loadSlots() {
    if (!doctorId || !date) return;
    const { data } = await client.get("/appointments/slots", { params: { doctorId, date } });
    setSlots(data);
  }

  async function loadMine() {
    try {
      const { data } = await client.get("/appointments/mine");
      setMine(data);
    } catch { /* not onboarded yet */ }
  }

  async function loadDoctors() {
    const { data } = await client.get("/symptoms/directory");
    setDoctors(data);
  }

  useEffect(() => { loadDoctors(); loadMine(); }, []);
  useEffect(() => { loadSlots(); }, [doctorId, date]);

  async function book(time) {
    setMessage(null);
    try {
      const { data } = await client.post("/appointments/book", { doctorId, date, time });
      setMessage(data.message);
      loadSlots();
      loadMine();
    } catch (e) {
      setMessage(e.response?.data?.error || "Booking failed.");
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Appointment Booking & Management" subtitle="Module 3 — real-time availability, auto-confirm, overflow handling" />
      <div className="flex-1 p-8 max-w-4xl space-y-6">
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Doctor">
              <select className={inputClass} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            {slots.map((s) => (
              <button
                key={s.id}
                disabled={s.available === 0}
                onClick={() => book(s.time)}
                className={`rounded-lg border px-4 py-3 text-sm text-left transition-colors ${
                  s.available > 0
                    ? "border-[var(--color-line)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-line)] bg-[var(--color-bg)] opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="font-medium">{s.time}</div>
                <div className="text-xs text-[var(--color-ink-soft)]">{s.available} of {s.capacity} open</div>
              </button>
            ))}
          </div>
          {message && <p className="text-sm text-[var(--color-primary)] mt-4">{message}</p>}
        </Card>

        <div>
          <h3 className="font-[var(--font-display)] text-lg mb-3">Your appointments</h3>
          <div className="grid gap-3">
            {mine.map((a) => (
              <Card key={a.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{a.doctor?.name} — {a.doctor?.specialty}</div>
                  <div className="text-xs text-[var(--color-ink-soft)]">{a.date} at {a.time} · via {a.source}</div>
                </div>
                <StatusBadge status={a.status} />
              </Card>
            ))}
            {mine.length === 0 && <Card><p className="text-sm text-[var(--color-ink-soft)]">No appointments yet.</p></Card>}
          </div>
        </div>
      </div>
    </div>
  );
}
