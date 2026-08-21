import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import Card, { Button, Field, inputClass, StatusBadge } from "../components/ui";
import client from "../api/client";

export default function VisitDocs() {
  const [mine, setMine] = useState([]);
  const [reports, setReports] = useState([]);
  const [appointmentId, setAppointmentId] = useState("");
  const [findingsText, setFindingsText] = useState("");
  const [medName, setMedName] = useState("Paracetamol 500mg");
  const [frequency, setFrequency] = useState("BD");
  const [duration, setDuration] = useState(5);
  const [draftReport, setDraftReport] = useState(null);
  const [error, setError] = useState(null);

  async function loadAll() {
    try {
      const [{ data: appts }, { data: reps }] = await Promise.all([
        client.get("/appointments/mine"),
        client.get("/visits/mine"),
      ]);
      setMine(appts.filter((a) => a.status === "confirmed"));
      setReports(reps);
    } catch { /* not onboarded */ }
  }

  useEffect(() => { loadAll(); }, []);

  async function captureExamination() {
    setError(null);
    try {
      const { data } = await client.post(`/visits/${appointmentId}/examination`, { rawText: findingsText });
      setDraftReport(data.report);
    } catch (e) { setError(e.response?.data?.error || "Failed to capture examination."); }
  }

  async function capturePrescription() {
    setError(null);
    try {
      const { data } = await client.post(`/visits/${appointmentId}/prescription`, {
        medicines: [{ name: medName, frequency, durationDays: Number(duration) }],
      });
      setDraftReport(data.report);
    } catch (e) { setError(e.response?.data?.error || "Failed to capture prescription."); }
  }

  async function approve() {
    setError(null);
    try {
      const { data } = await client.post(`/visits/${appointmentId}/approve`);
      setDraftReport(data.report);
      loadAll();
    } catch (e) { setError(e.response?.data?.error || "Failed to approve report."); }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Visit & AI-Assisted Clinical Documentation" subtitle="Module 4 — the doctor's point-of-care capture, structured by AI" />
      <div className="flex-1 p-8 max-w-4xl space-y-6">
        <Card>
          <p className="text-xs text-[var(--color-ink-soft)] mb-4">
            Demo note: this panel simulates the doctor's tablet capture at the point of care. In production it would sit behind a doctor login.
          </p>
          <Field label="Confirmed appointment">
            <select className={inputClass} value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
              <option value="">Choose an appointment</option>
              {mine.map((a) => <option key={a.id} value={a.id}>{a.id} — {a.date} {a.time}</option>)}
            </select>
          </Field>

          {appointmentId && (
            <div className="mt-5 space-y-5">
              <Field label="Examination findings (voice/tablet capture)">
                <textarea className={`${inputClass} min-h-[80px]`} value={findingsText} onChange={(e) => setFindingsText(e.target.value)} placeholder="Dictate or type findings…" />
              </Field>
              <Button variant="ghost" onClick={captureExamination}>Structure findings with AI</Button>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Medicine">
                  <input className={inputClass} value={medName} onChange={(e) => setMedName(e.target.value)} />
                </Field>
                <Field label="Frequency">
                  <select className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                    <option>OD</option><option>BD</option><option>TDS</option><option>QID</option>
                  </select>
                </Field>
                <Field label="Duration (days)">
                  <input type="number" className={inputClass} value={duration} onChange={(e) => setDuration(e.target.value)} />
                </Field>
              </div>
              <Button variant="ghost" onClick={capturePrescription}>Structure prescription with AI</Button>

              {draftReport && (
                <Card className="bg-[var(--color-bg)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-[var(--font-mono)] text-[var(--color-ink-soft)]">v{draftReport.version} · {draftReport.status}</span>
                    {draftReport.findings?.lowConfidence && <span className="text-xs text-[var(--color-warning)]">Low-confidence transcription — review before finalizing</span>}
                  </div>
                  {draftReport.findings && <p className="text-sm mb-3">{draftReport.findings.summary}</p>}
                  {draftReport.prescription?.length > 0 && (
                    <ul className="text-sm space-y-1">
                      {draftReport.prescription.map((p, i) => (
                        <li key={i}>{p.name} — {p.frequency} × {p.durationDays}d (qty {p.quantity})</li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              <Button onClick={approve}>Doctor approves — publish to patient</Button>
              {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
            </div>
          )}
        </Card>

        <div>
          <h3 className="font-[var(--font-display)] text-lg mb-3">Your published reports</h3>
          <div className="grid gap-3">
            {reports.map((r) => (
              <Card key={r.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-[var(--font-mono)] text-[var(--color-ink-soft)]">{r.id}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-sm">{r.findings?.summary}</p>
                {r.prescription?.length > 0 && (
                  <ul className="text-sm mt-2 text-[var(--color-ink-soft)]">
                    {r.prescription.map((p, i) => <li key={i}>{p.name} — {p.frequency} × {p.durationDays}d</li>)}
                  </ul>
                )}
              </Card>
            ))}
            {reports.length === 0 && <Card><p className="text-sm text-[var(--color-ink-soft)]">No reports yet.</p></Card>}
          </div>
        </div>
      </div>
    </div>
  );
}
