import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { StatusBadge, EmptyState, SkeletonCard, Button, SectionTitle, inputClass } from "../../components/ui";
import { IconDownload, IconPrint, IconPill } from "../../components/Icons";

const time = (m) => {
  if (m.frequency) return m.frequency;
  const times = [m.morning && "M", m.afternoon && "A", m.night && "N"].filter(Boolean).join("-");
  const food = [m.beforeFood && "BF", m.afterFood && "AF"].filter(Boolean).join("/");
  return [times && times, food && food].filter(Boolean).join(" ") || "As directed";
};

export default function PatientPrescriptions() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = async () => {
    try { setData((await client.get("/patients/home")).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load prescriptions"); }
  };
  useEffect(() => { load(); }, []);

  if (!data) return <div className="grid md:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div>;
  const rx = (data.prescriptions || []).filter((p) => !q || [p.prescriptionId, p.diagnosis, p.doctor?.name].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      <Card>
        <SectionTitle
          title="Your prescriptions"
          subtitle="Download or print any prescription"
          right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prescription, doctor, diagnosis…" className={`${inputClass} md:w-64`} />}
        />
        {rx.length ? (
          <div className="space-y-4">
            {rx.map((p) => <PrescriptionCard key={p._id} p={p} />)}
          </div>
        ) : <EmptyState title="No prescriptions yet" hint="Prescriptions issued by your doctors appear here." />}
      </Card>
    </div>
  );
}

function PrescriptionCard({ p }) {
  const meds = p.medicines || [];
  return (
    <div className="border border-[var(--color-line)] rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[var(--color-surface-2)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--color-ink)]">{p.prescriptionId || "Prescription"}</span>
            <StatusBadge status={p.status} />
          </div>
          <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">Dr. {p.doctor?.name} · {p.doctor?.profile?.specialty} · {new Date(p.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => viewPrescription(p)}><IconPrint /> Print</Button>
          <Button size="sm" onClick={() => downloadPrescription(p)}><IconDownload /> Download</Button>
        </div>
      </div>
      <div className="px-4 py-3 grid md:grid-cols-2 gap-4">
        {p.diagnosis && <div><p className="text-xs font-medium text-[var(--color-ink-soft)]">Diagnosis</p><p className="text-sm text-[var(--color-ink)]">{p.diagnosis}</p></div>}
        {p.advice && <div><p className="text-xs font-medium text-[var(--color-ink-soft)]">Advice</p><p className="text-sm text-[var(--color-ink)]">{p.advice}</p></div>}
      </div>
      {meds.length > 0 && (
        <div className="border-t border-[var(--color-line)]">
          <div className="px-4 py-2 flex items-center gap-2 text-xs font-medium text-[var(--color-ink-soft)]"><IconPill /> Medicines</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-[var(--color-ink-soft)] border-b border-[var(--color-line)]"><th className="px-4 py-2 font-medium">Medicine</th><th className="px-4 py-2 font-medium hidden md:table-cell">Schedule</th><th className="px-4 py-2 font-medium">Duration</th></tr></thead>
            <tbody>
              {meds.map((m, i) => (
                <tr key={i} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-4 py-2 font-medium text-[var(--color-ink)]">{m.name}{m.dosage ? <span className="text-[var(--color-ink-soft)] font-normal"> · {m.dosage}</span> : null}</td>
                  <td className="px-4 py-2 text-[var(--color-ink-soft)] hidden md:table-cell">{time(m)}</td>
                  <td className="px-4 py-2 text-[var(--color-ink-soft)]">{m.durationDays ? `${m.durationDays} day${m.durationDays > 1 ? "s" : ""}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {p.labTests?.length > 0 && (
        <div className="px-4 py-3 border-t border-[var(--color-line)]">
          <p className="text-xs font-medium text-[var(--color-ink-soft)]">Lab tests</p>
          <div className="flex flex-wrap gap-2 mt-1">{p.labTests.map((t, i) => <span key={i} className="text-xs bg-[var(--color-primary-soft)] text-[var(--color-primary)] rounded-full px-2.5 py-1">{t}</span>)}</div>
        </div>
      )}
      {p.followUpDate && <div className="px-4 py-3 border-t border-[var(--color-line)] text-sm text-[var(--color-ink-soft)]">Follow-up: {new Date(p.followUpDate).toLocaleDateString()}</div>}
      <div className="px-4 py-2 text-right text-[var(--color-ink-soft)] text-xs italic">Dt. {p.doctor?.name} · {p.doctorSignature}</div>
    </div>
  );
}

function content(p) {
  return `
Missile Health - Prescription
${p.prescriptionId}
Patient: (from portal) | Issued: ${new Date(p.createdAt).toLocaleString()}
Doctor: ${p.doctor?.name} (${p.doctor?.profile?.specialty})
${p.diagnosis ? "Diagnosis: " + p.diagnosis : ""}
${p.advice ? "Advice: " + p.advice : ""}

MEDICINES
${(p.medicines || []).map((m, i) => `${i + 1}. ${m.name} ${m.dosage || ""} (${time(m)})`).join("\n") || "None"}
${p.labTests?.length ? "LAB TESTS: " + p.labTests.join(", ") : ""}
`;
}

function openDoc(p) {
  const w = window.open("", "_blank", "width=760,height=900");
  w.document.write(`<html><head><title>${p.prescriptionId}</title><style>body{font-family:system-ui;padding:40px;color:#0B2545;line-height:1.5}h1{font-size:20px;border-bottom:2px solid #1B74E4;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #dfe;padding:8px;text-align:left;font-size:13px}th{background:#E3EEFC}.muted{color:#5A6E85;font-size:12px}</style></head><body>
<h1>Missile Health &nbsp;<span class="muted">Digital Prescription</span></h1>
<p class="muted">${p.prescriptionId} · Issued ${new Date(p.createdAt).toLocaleString()} · From Patient Portal</p>
<p class="muted">Dr. ${p.doctor?.name} (${p.doctor?.profile?.specialty || "Doctor"})</p>
${p.diagnosis ? `<p><b>Diagnosis:</b> ${p.diagnosis}</p>` : ""}
${p.advice ? `<p><b>Advice:</b> ${p.advice}</p>` : ""}
${(p.medicines?.length || 0) ? `<h2>Medicines</h2><table><tr><th>#</th><th>Medicine</th><th>Schedule</th><th>Duration</th></tr>${p.medicines.map((m, i) => `<tr><td>${i + 1}</td><td>${m.name} ${m.dosage || ""}</td><td>${time(m)}</td><td>${m.durationDays ? m.durationDays + " days" : "—"}</td></tr>`).join("")}</table>` : ""}
${p.labTests?.length ? `<h2>Lab tests</h2><p>${p.labTests.join(", ")}</p>` : ""}
${p.followUpDate ? `<p class="muted" style="margin-top:12px">Follow-up: ${new Date(p.followUpDate).toLocaleDateString()}</p>` : ""}
<p class="muted" style="margin-top:24px">Digitally signed · ${p.doctor?.name || "Doctor"} · ${p.doctorSignature || ""}</p>
</html>`);
  w.document.close();
}

function downloadPrescription(p) {
  const url = URL.createObjectURL(new Blob([content(p)], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${p.prescriptionId || "prescription"}.txt`; a.click();
  URL.revokeObjectURL(url);
}
function viewPrescription(p) { openDoc(p); }