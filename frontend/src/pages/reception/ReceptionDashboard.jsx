import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { Button, Field, inputClass, Select, StatusBadge, EmptyState, SectionTitle, SkeletonCard, useToast, DonutChart } from "../../components/ui";
import { IconCalendar, IconUsers, IconWallet, IconCheck, IconPrint } from "../../components/Icons";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const pad = (x) => String(x).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtTime = (iso) => new Date(iso).toLocaleString();

export default function ReceptionDashboard() {
  const [tab, setTab] = useState("book");
  const [home, setHome] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const toast = useToast();

  const loadHome = async () => {
    try { setHome((await client.get("/reception/home")).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load reception data"); }
  };
  useEffect(() => { loadHome(); }, []);
  if (!home) return <div className="grid lg:grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;

  const tabs = [
    { k: "book", label: "Book & collect cash", icon: <IconCalendar className="text-base" /> },
    { k: "patients", label: "Patients", icon: <IconUsers className="text-base" /> },
    { k: "attendance", label: "Staff attendance", icon: <IconCheck className="text-base" /> },
    { k: "cash", label: "Cash report", icon: <IconWallet className="text-base" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      {msg && <p className="text-sm text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-xl px-3 py-2">{msg}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today's appointments", value: home.stats.todayAppointments },
          { label: "Collected today", value: money(home.cashCollected) },
          { label: "Paid visits", value: home.stats.paidToday },
          { label: "Free slots today", value: home.doctors.reduce((s, d) => s + (d.freeToday || 0), 0) },
        ].map((c) => (
          <Card key={c.label} className="!p-4"><p className="text-xs font-medium text-[var(--color-ink-soft)]">{c.label}</p><p className="text-2xl font-[var(--font-display)] font-semibold text-[var(--color-ink)] mt-1">{c.value}</p></Card>
        ))}
      </div>

      {home.cashByMode?.length ? (
        <Card className="!p-5">
          <SectionTitle title="Today's collection split" subtitle="Consultation fees collected by payment mode at the desk" />
          <div className="grid md:grid-cols-2 gap-4 items-center">
            <DonutChart data={home.cashByMode.map((c) => ({ label: c._id || "cash", value: c.total }))} size={52} />
            <div className="space-y-2">
              {home.cashByMode.map((c) => (
                <div key={c._id} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-ink-soft)] capitalize">{c._id || "cash"}</span>
                  <span className="font-medium text-[var(--color-ink)]">{money(c.total)} · {c.count} visit{c.count === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button key={t.k} variant={tab === t.k ? "primary" : "ghost"} onClick={() => setTab(t.k)} icon={t.icon}>{t.label}</Button>
        ))}
      </div>

      {tab === "book" && <BookTab home={home} setError={setError} setMsg={setMsg} toast={toast} onBooked={loadHome} />}
      {tab === "patients" && <PatientsTab setError={setError} />}
      {tab === "attendance" && <AttendanceTab setError={setError} setMsg={setMsg} toast={toast} />}
      {tab === "cash" && <CashTab setError={setError} />}
    </div>
  );
}

/* ---------- Book on behalf of a patient ---------- */
function BookTab({ home, setError, setMsg, toast, onBooked }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [patient, setPatient] = useState(null);
  const [fresh, setFresh] = useState(false);
  const [loginCreds, setLoginCreds] = useState(null);
  const [doctorId, setDoctorId] = useState("");
  const [dateStr, setDateStr] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [loadSlots, setLoadSlots] = useState(false);
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [amount, setAmount] = useState(0);
  const [bookFee, setBookFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const search = async () => {
    setError(""); setMsg(""); setPatient(null); setResults([]); setLoginCreds(null);
    if (!q.trim()) return;
    try { const { data } = await client.get(`/reception/patients?q=${encodeURIComponent(q)}`); setResults(data.patients || []); }
    catch (e) { setError(e.response?.data?.error || "Search failed"); }
  };
  const register = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setError(""); setMsg("");
    try {
      const { data } = await client.post("/reception/patients", { name: f.get("name"), mobile: f.get("mobile"), age: f.get("age"), gender: f.get("gender"), address: f.get("address") });
      setPatient(data.patient); setFresh(true); setResults([]);
      if (data.created) setLoginCreds({ mobile: data.patient?.mobile, patientId: data.patient?.patientId, email: data.loginEmail, password: data.loginPassword });
      else setLoginCreds(null);
      toast(data.created ? "Walk-in patient registered" : "Patient already registered", "success");
    } catch (err) { setError(err.response?.data?.error || "Could not register patient"); }
  };

  useEffect(() => {
    if (!doctorId) { setSlots([]); setSelected(""); return; }
    let cancelled = false;
    setLoadSlots(true); setSlots([]); setSelected("");
    client.get(`/reception/doctors/${doctorId}/slots?date=${dateStr}`)
      .then(({ data }) => { if (!cancelled) { setSlots(data.slots || []); setBookFee(data.consultationFee || 0); setAmount(data.consultationFee || 0); } })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.error || "Unable to load slots"); })
      .finally(() => { if (!cancelled) setLoadSlots(false); });
    return () => { cancelled = true; };
  }, [doctorId, dateStr]);

  const book = async (e) => {
    e.preventDefault();
    setError(""); setMsg("");
    if (!patient || !selected || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await client.post("/reception/appointments", { patientId: patient.patientId, doctorId, scheduledFor: selected, reason, paymentMode, amount });
      setMsg(`Booked for ${patient.name} at ${fmtTime(selected)}. Cash ${money(amount || bookFee)} collected. Token ${data.appointment.token}.`);
      setSelected(""); setReason(""); setPatient(null); setSlots([]); setDoctorId(""); onBooked();
    } catch (err) { setError(err.response?.data?.error || "Could not book appointment"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <SectionTitle title="1. Find or register the patient" subtitle="Elderly or walk-in visitors are helped here" />
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Patient ID, name or mobile…" className={inputClass} />
          <Button onClick={search}>Search</Button>
        </div>
        {results.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {results.map((p) => (
              <button key={p._id} onClick={() => { setPatient(p); setResults([]); }} className="w-full text-left border border-[var(--color-line)] rounded-xl px-3 py-2 hover:border-[var(--color-primary)]">
                <span className="text-sm font-medium text-[var(--color-ink)]">{p.name}</span>
                <span className="text-xs font-[var(--font-mono)] text-[var(--color-primary)] ml-2">{p.patientId}</span>
                <span className="text-xs text-[var(--color-ink-soft)] ml-2">{p.mobile || "—"}</span>
                {p.activeAppointments ? <span className="text-xs text-[var(--color-warning)] ml-2">{p.activeAppointments} active booking(s)</span> : null}
              </button>
            ))}
          </div>
        )}
        {patient ? (
          <div className="mt-3 border border-[var(--color-success)] bg-[var(--color-success-soft)] rounded-xl px-3 py-2 flex items-center justify-between">
            <div><span className="text-sm font-medium text-[var(--color-ink)]">{patient.name}</span><span className="text-xs font-[var(--font-mono)] text-[var(--color-primary)] ml-2">{patient.patientId}</span></div>
            <Button size="sm" variant="ghost" onClick={() => setPatient(null)}>Change</Button>
          </div>
        ) : null}
        <p className="text-xs font-medium text-[var(--color-ink-soft)] mt-4 mb-1.5">New walk-in patient</p>
        <form className="grid grid-cols-2 gap-3" onSubmit={register}>
          <Field label="Name"><input name="name" required className={inputClass} /></Field>
          <Field label="Mobile (10 digits)"><input name="mobile" required pattern="[0-9]{10}" maxLength={10} className={inputClass} /></Field>
          <Field label="Age"><input name="age" type="number" className={inputClass} /></Field>
          <Field label="Gender"><Select name="gender"><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></Select></Field>
          <div className="col-span-2"><Button type="submit" variant="ghost" className="w-full">Register / fetch patient</Button></div>
        </form>
        {loginCreds && (
          <div className="mt-4 border border-[var(--color-primary)] bg-[var(--color-primary-soft)] rounded-xl px-4 py-3 animate-fade-up">
            <p className="text-sm font-semibold text-[var(--color-ink)]">Hand these portal login details to the patient</p>
            <p className="text-xs text-[var(--color-ink-soft)] mt-1">They can sign in on the patient portal later to see prescriptions, bills and every visit record online.</p>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              <div><span className="text-[var(--color-ink-soft)]">Patient ID</span><p className="font-medium font-[var(--font-mono)] text-[var(--color-ink)] break-all">{loginCreds.patientId}</p></div>
              <div><span className="text-[var(--color-ink-soft)]">Password</span><p className="font-medium font-[var(--font-mono)] text-[var(--color-ink)]">{loginCreds.password}</p></div>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle title="2. Choose doctor, slot and collect cash" subtitle="Confirms instantly and records the cash payment" />
        <form className="space-y-3" onSubmit={book}>
          <Field label="Doctor"><Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required><option value="">Select doctor</option>{home.doctors.map((d) => <option key={d._id} value={d._id}>{d.name} — {money(d.profile?.consultationFee)} {d.freeToday ? `(${d.freeToday} slots free)` : "(full today)"}</option>)}</Select></Field>
          <Field label="Date"><input type="date" min={todayStr()} value={dateStr} onChange={(e) => setDateStr(e.target.value)} className={inputClass} /></Field>
          <div>
            <p className="text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Available slots</p>
            {!doctorId ? <p className="text-sm text-[var(--color-ink-soft)]">Choose a doctor first.</p>
              : loadSlots ? <p className="text-sm text-[var(--color-ink-soft)]">Loading slots…</p>
              : slots.length ? <div className="flex flex-wrap gap-2">{slots.map((s) => <button key={s} type="button" onClick={() => setSelected(s)} className={`px-3 py-1.5 text-xs rounded-full transition-colors ${selected === s ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-2)] text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)]"}`}>{new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</button>)}</div>
              : <p className="text-sm text-[var(--color-warning)]">No free slots on this date.</p>}
          </div>
          <Field label="Reason / symptoms"><input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Consultation fee (₹)"><input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} /></Field>
            <Field label="Payment mode"><Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></Select></Field>
          </div>
          <Button type="submit" disabled={!patient || !selected || submitting} className="w-full">{submitting ? "Booking…" : patient && selected ? "Book appointment & collect cash" : "Select patient and slot first"}</Button>
        </form>
      </Card>
    </div>
  );
}

/* ---------- Patient lookup, visit records & receipts ---------- */
function PatientsTab({ setError }) {
  const [id, setId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const view = async () => {
    setError(""); setResult(null);
    if (!id.trim()) return;
    setLoading(true);
    try { const { data } = await client.get(`/reception/appointments?patientId=${encodeURIComponent(id.trim().toUpperCase())}`); setResult(data); }
    catch (e) { setError(e.response?.data?.error || "Patient not found"); if (e.response?.status === 404) setResult(null); }
    finally { setLoading(false); }
  };
  const outstanding = (result?.invoices || []).filter((i) => i.status === "pending").reduce((s, i) => s + (i.total || 0), 0);

  return (
    <Card>
      <SectionTitle title="Patient visit records & receipts" subtitle="Look up by Patient ID — hand walk-ins their prescription and medicine receipts, plus every visit record" right={<div className="flex gap-2"><input value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && view()} placeholder="e.g. PAT-..." className={`${inputClass} w-64`} /><Button onClick={view} disabled={loading}>{loading ? "Loading…" : "Find"}</Button></div>} />
      {result ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border border-[var(--color-line)] rounded-xl p-3">
            <div>
              <p className="font-medium text-[var(--color-ink)]">{result.patient.name}<span className="text-xs font-[var(--font-mono)] text-[var(--color-primary)] ml-2">{result.patient.patientId}</span></p>
              <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">{result.patient.mobile || "—"}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => printVisitRecord(result)}><IconPrint /> Print visit record</Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Card className="!p-3"><p className="text-xs text-[var(--color-ink-soft)]">Visits</p><p className="text-xl font-semibold text-[var(--color-ink)]">{result.appointments.length}</p></Card>
            <Card className="!p-3"><p className="text-xs text-[var(--color-ink-soft)]">Prescriptions</p><p className="text-xl font-semibold text-[var(--color-ink)]">{result.prescriptions.length}</p></Card>
            <Card className="!p-3"><p className="text-xs text-[var(--color-ink-soft)]">Bills</p><p className="text-xl font-semibold text-[var(--color-ink)]">{result.invoices.length}</p></Card>
            <Card className="!p-3"><p className="text-xs text-[var(--color-ink-soft)]">Outstanding</p><p className="text-xl font-semibold text-[var(--color-danger)]">{money(outstanding)}</p></Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <section>
              <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-2">Visits</h3>
              {result.appointments.length ? (
                <div className="divide-y divide-[var(--color-line)] border border-[var(--color-line)] rounded-xl">
                  {result.appointments.map((a) => (
                    <div key={a._id} className="py-2.5 px-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-medium text-[var(--color-ink)]">Dr. {a.doctor?.name}</span>
                        <span className="text-xs text-[var(--color-ink-soft)] ml-2">{a.doctor?.profile?.specialty || "—"}</span>
                        <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">{fmtTime(a.scheduledFor)}{a.paidAt ? ` · ${money(a.consultationFee)} collected` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2"><StatusBadge status={a.status} />{a.token && <span className="text-xs font-[var(--font-mono)] text-[var(--color-primary)]">{a.token}</span>}</div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No visits found" />}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-2">Prescriptions</h3>
              {result.prescriptions.length ? (
                <div className="space-y-2">
                  {result.prescriptions.map((p) => (
                    <div key={p._id} className="flex flex-wrap items-center justify-between gap-2 border border-[var(--color-line)] rounded-xl px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-ink)]">{p.prescriptionId}</span>
                          <StatusBadge status={p.status} />
                        </div>
                        <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">Dr. {p.doctor?.name} · {new Date(p.createdAt).toLocaleString()}</p>
                        {p.medicines?.length ? <p className="text-[11px] text-[var(--color-ink-soft)] mt-0.5">{p.medicines.length} medicine(s) · {p.diagnosis || "—"}</p> : null}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => printPrescriptionDoc(p, result.patient)}><IconPrint /> Receipt</Button>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No prescriptions" />}
            </section>

            <section className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-2">Bills & medicine receipts</h3>
              {result.invoices.length ? (
                <div className="space-y-2">
                  {result.invoices.map((inv) => (
                    <div key={inv._id} className="flex flex-wrap items-center justify-between gap-2 border border-[var(--color-line)] rounded-xl px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-ink)]">{inv.invoiceNo}</span>
                          <StatusBadge status={inv.status} />
                          <StatusBadge status={inv.type} />
                          {inv.prescription?.prescriptionId && <span className="text-xs font-[var(--font-mono)] text-[var(--color-primary)]">{inv.prescription.prescriptionId}</span>}
                        </div>
                        <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">{new Date(inv.createdAt).toLocaleString()} · Dr. {inv.doctor?.name || "Pharmacy"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--color-ink)]">{money(inv.total)}</span>
                        <Button size="sm" variant="ghost" onClick={() => printInvoiceDoc(inv, result.patient)}><IconPrint /> Receipt</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No bills yet" hint="Consultation and medicine receipts appear here." />}
            </section>
          </div>
        </>
      ) : loading ? <p className="text-sm text-[var(--color-ink-soft)]">Searching…</p> : <EmptyState title="Enter a patient ID" hint="e.g. PAT-2498765432-001" />}
    </Card>
  );
}

/* ---------- Printable receipts for walk-in patients ---------- */
const mediTime = (m) => {
  if (m.frequency) return m.frequency;
  const mark = [m.morning && "M", m.afternoon && "A", m.night && "N"].filter(Boolean).join("-");
  return [mark, m.beforeFood && "BF", m.afterFood && "AF"].filter(Boolean).join(" ") || "As directed";
};

function printVisitRecord(result) {
  const p = result.patient;
  const w = window.open("", "_blank", "width=760,height=900");
  w.document.write(`<html><head><title>Visit Record</title><style>body{font-family:system-ui;padding:40px;color:#0B2545;line-height:1.5}h1{font-size:20px;border-bottom:2px solid #1B74E4;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #dfe;padding:8px;text-align:left;font-size:13px}th{background:#E3EEFC}.muted{color:#5A6E85;font-size:12px}</style></head><body>
<h1>Missile Health &nbsp;<span class="muted">Visit Record</span></h1>
<p class="muted">Patient: ${p.name} · ${p.patientId} · ${p.mobile || "—"}</p>
<p class="muted">Printed ${new Date().toLocaleString()}</p>
${result.appointments.length ? `<h2>Visits (${result.appointments.length})</h2><table><tr><th>Date</th><th>Doctor</th><th>Specialty</th><th>Token</th><th>Status</th><th>Fee</th></tr>${result.appointments.map((a) => `<tr><td>${new Date(a.scheduledFor).toLocaleString()}</td><td>${a.doctor?.name || "—"}</td><td>${a.doctor?.profile?.specialty || "—"}</td><td>${a.token || "—"}</td><td>${a.status}</td><td>₹${Math.round(a.consultationFee || 0)}</td></tr>`).join("")}</table>` : "<p>No visits yet.</p>"}
</body></html>`);
  w.document.close();
  w.print();
}

function printPrescriptionDoc(p, patient) {
  const w = window.open("", "_blank", "width=760,height=900");
  w.document.write(`<html><head><title>${p.prescriptionId}</title><style>body{font-family:system-ui;padding:40px;color:#0B2545;line-height:1.5}h1{font-size:20px;border-bottom:2px solid #1B74E4;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #dfe;padding:8px;text-align:left;font-size:13px}th{background:#E3EEFC}.muted{color:#5A6E85;font-size:12px}</style></head><body>
<h1>Missile Health &nbsp;<span class="muted">Prescription Receipt</span></h1>
<p class="muted">${p.prescriptionId} · Issued ${new Date(p.createdAt).toLocaleString()}</p>
<p class="muted">Patient: ${patient?.name || "—"} · ${patient?.patientId || "—"}</p>
<p class="muted">Dr. ${p.doctor?.name} (${p.doctor?.profile?.specialty || "Doctor"})</p>
${p.diagnosis ? `<p><b>Diagnosis:</b> ${p.diagnosis}</p>` : ""}
${p.advice ? `<p><b>Advice:</b> ${p.advice}</p>` : ""}
${(p.medicines?.length || 0) ? `<h2>Medicines</h2><table><tr><th>#</th><th>Medicine</th><th>Schedule</th><th>Duration</th></tr>${p.medicines.map((m, i) => `<tr><td>${i + 1}</td><td>${m.name} ${m.dosage || ""}</td><td>${mediTime(m)}</td><td>${m.durationDays ? m.durationDays + " days" : "—"}</td></tr>`).join("")}</table>` : "No medicines"}
${p.labTests?.length ? `<h2>Lab tests</h2><p>${p.labTests.join(", ")}</p>` : ""}
${p.followUpDate ? `<p class="muted" style="margin-top:12px">Follow-up: ${new Date(p.followUpDate).toLocaleDateString()}</p>` : ""}
<p class="muted" style="margin-top:24px">Digitally signed · ${p.doctorSignature || p.doctor?.name || "Doctor"}</p>
</body></html>`);
  w.document.close();
  w.print();
}

function printInvoiceDoc(inv, patient) {
  const w = window.open("", "_blank", "width=760,height=900");
  const rows = (inv.lines || []).map((l, i) => `<tr><td>${i + 1}</td><td>${l.name}</td><td>${l.description || ""}</td><td>${l.quantity || 1}</td><td>₹${Math.round(l.unitPrice || 0)}</td><td>₹${Math.round(l.amount || 0)}</td></tr>`).join("");
  w.document.write(`<html><head><title>${inv.invoiceNo}</title><style>body{font-family:system-ui;padding:40px;color:#0B2545;line-height:1.5}h1{font-size:20px;border-bottom:2px solid #1B74E4;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #dfe;padding:8px;text-align:left;font-size:13px}th{background:#E3EEFC}.muted{color:#5A6E85;font-size:12px}.total{text-align:right;margin-top:12px;font-size:16px;font-weight:700}</style></head><body>
<h1>Missile Health &nbsp;<span class="muted">${inv.type === "pharmacy" ? "Medicine Receipt" : "Bill / Receipt"}</span></h1>
<p class="muted">${inv.invoiceNo} · ${new Date(inv.createdAt).toLocaleString()} · Status: ${inv.status}</p>
<p class="muted">Patient: ${patient?.name || "—"} · ${patient?.patientId || "—"}</p>
<p class="muted">${inv.doctor?.name ? `Dr. ${inv.doctor.name} (${inv.doctor.profile?.specialty || ""})` : "Pharmacy"}</p>
${rows ? `<h2>Items</h2><table><tr><th>#</th><th>Item</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>${rows}</table>` : ""}
${inv.consultationFee > 0 ? `<p>Consultation fee: ₹${Math.round(inv.consultationFee)}</p>` : ""}
<div class="total">Subtotal ₹${Math.round(inv.subtotal || 0)}</div>
${inv.discount > 0 ? `<div class="total" style="font-size:13px;font-weight:400">Discount − ₹${Math.round(inv.discount)}</div>` : ""}
${inv.gstAmount > 0 ? `<div class="total" style="font-size:13px;font-weight:400">GST (${inv.gstPercent}%) ₹${Math.round(inv.gstAmount)}</div>` : ""}
<div class="total">Total ₹${Math.round(inv.total || 0)}</div>
${inv.status === "paid" ? `<p class="muted" style="margin-top:12px">Paid via ${inv.paymentMethod || "—"} on ${inv.paidAt ? new Date(inv.paidAt).toLocaleString() : "—"} · Ref ${inv.transactionRef || "—"}</p>` : ""}
</body></html>`);
  w.document.close();
  w.print();
}

/* ---------- Cleaner / staff attendance at the desk ---------- */
function AttendanceTab({ setError, setMsg, toast }) {
  const [staff, setStaff] = useState([]);
  const [done, setDone] = useState({});
  const load = async () => { try { const { data } = await client.get("/reception/staff"); setStaff(data.staff || []); } catch (e) { setError(e.response?.data?.error || "Could not load staff"); } };
  useEffect(() => { load(); }, []);
  const mark = async (u) => {
    setError(""); setMsg("");
    try {
      await client.put("/reception/attendance", { userId: u._id, status: "present", checkIn: "09:00" });
      setDone((d) => ({ ...d, [u._id]: true })); toast(`${u.name} marked present`, "success");
    } catch (e) { setError(e.response?.data?.error || "Could not mark attendance"); }
  };
  return (
    <Card>
      <SectionTitle title="Staff attendance at the desk" subtitle="Mark any employee present — admins see it immediately. (Biometric update arrives later.)" />
      {staff.length ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {staff.map((u) => (
            <div key={u._id} className="border border-[var(--color-line)] rounded-xl p-3 flex items-center justify-between gap-2">
              <div><p className="text-sm font-medium text-[var(--color-ink)]">{u.name}</p><p className="text-xs text-[var(--color-ink-soft)] capitalize">{u.role} · {u.profile?.designation || "—"}</p></div>
              {done[u._id] ? <StatusBadge status="present" /> : <Button size="sm" onClick={() => mark(u)}>Mark present</Button>}
            </div>
          ))}
        </div>
      ) : <EmptyState title="No staff found" hint="Admin adds employees under Staff → Employees." />}
    </Card>
  );
}

/* ---------- Daily cash report ---------- */
function CashTab({ setError }) {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const load = async () => { try { setData((await client.get(`/reception/cash?date=${date}`)).data); } catch (e) { setError(e.response?.data?.error || "Could not load cash report"); } };
  useEffect(() => { load(); }, [date]);
  return (
    <Card>
      <SectionTitle title="Cash collected at the desk" subtitle="Receptionists collect consultation fees when booking for patients" right={<input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className={`${inputClass} w-44`} />} />
      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card className="!p-4"><p className="text-xs text-[var(--color-ink-soft)]">Visits paid</p><p className="text-2xl font-semibold text-[var(--color-ink)]">{data.count}</p></Card>
            <Card className="!p-4"><p className="text-xs text-[var(--color-ink-soft)]">Total collected</p><p className="text-2xl font-semibold text-[var(--color-primary)]">{money(data.total)}</p></Card>
          </div>
          {data.appointments.length ? (
            <div className="divide-y divide-[var(--color-line)]">
              {data.appointments.map((a) => (
                <div key={a._id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div><span className="text-sm font-medium text-[var(--color-ink)]">{a.patient?.name}</span><span className="text-xs font-[var(--font-mono)] text-[var(--color-primary)] ml-2">{a.patient?.patientId}</span><span className="text-xs text-[var(--color-ink-soft)] ml-2">Dr. {a.doctor?.name}</span></div>
                  <div className="flex items-center gap-2"><span className="text-sm font-medium text-[var(--color-primary)]">{money(a.consultationFee)}</span><StatusBadge status={a.paymentMode || "paid"} /></div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No collections on this date" />}
        </>
      )}
    </Card>
  );
}