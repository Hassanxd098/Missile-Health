import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { StatusBadge, EmptyState, SkeletonCard, Button, SectionTitle, inputClass, Modal, useToast } from "../../components/ui";
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
  const [ocrModalOpen, setOcrModalOpen] = useState(false);

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
          subtitle="Download, print, or scan any doctor prescription image"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setOcrModalOpen(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700">
                📷 Scan Prescription (OCR)
              </Button>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prescription, doctor…" className={`${inputClass} md:w-56`} />
            </div>
          }
        />
        {rx.length ? (
          <div className="space-y-4">
            {rx.map((p) => <PrescriptionCard key={p._id} p={p} />)}
          </div>
        ) : <EmptyState title="No prescriptions yet" hint="Prescriptions issued by your doctors appear here." />}
      </Card>

      {/* Prescription OCR Scanner Modal */}
      <PrescriptionOcrModal open={ocrModalOpen} onClose={() => setOcrModalOpen(false)} />
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

function PrescriptionOcrModal({ open, onClose }) {
  const toast = useToast();
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  const [ocrError, setOcrError] = useState("");

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrError("");
    setOcrData(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result;
      if (dataUrl) {
        const mimeType = file.type || "image/jpeg";
        const base64 = String(dataUrl).split(",")[1] || "";
        setImage({ base64, mimeType, name: file.name, previewUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  const processOcr = async () => {
    if (!image || !image.base64) return;
    setScanning(true);
    setOcrError("");
    setOcrData(null);

    try {
      const { data: resData } = await client.post("/ai/ocr-prescription", { imageData: image });
      if (resData.success && resData.data) {
        setOcrData(resData.data);
        toast("Prescription OCR scan complete!", "success");
      } else {
        setOcrError("Could not extract clinical text from this image.");
      }
    } catch (err) {
      setOcrError(err.response?.data?.error || "Prescription OCR scan failed. Please try a clearer prescription image.");
    } finally {
      setScanning(false);
    }
  };

  const copyText = () => {
    if (!ocrData) return;
    const text = ocrData.rawOcrText || JSON.stringify(ocrData, null, 2);
    navigator.clipboard.writeText(text);
    toast("Copied OCR text to clipboard!", "success");
  };

  return (
    <Modal open={open} onClose={onClose} title="📷 AI Prescription OCR Scanner & Reader" wide>
      <div className="space-y-4">
        {!image ? (
          <div className="border-2 border-dashed border-[var(--color-line)] rounded-2xl p-8 text-center bg-[var(--color-surface-2)] space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center text-3xl mx-auto shadow-inner">
              📷
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--color-ink)]">Upload or Take Photo of Prescription</h3>
              <p className="text-xs text-[var(--color-ink-soft)] mt-1 max-w-sm mx-auto">
                AI Vision OCR scans handwritten or printed doctor notes, prescription slips, and discharge medications.
              </p>
            </div>
            <label className="inline-block px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-bold text-xs hover:opacity-90 cursor-pointer shadow-md shadow-blue-500/20 transition-all">
              Browse Prescription Image
              <input type="file" onChange={handleImageFile} accept="image/*" className="hidden" />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img src={image.previewUrl} alt="Prescription" className="w-16 h-16 object-cover rounded-xl border border-[var(--color-line)] shadow-sm shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-xs text-[var(--color-ink)] truncate">{image.name}</p>
                  <p className="text-[10px] text-[var(--color-ink-soft)]">Ready to scan & read</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setImage(null)}>Change Photo</Button>
                <Button size="sm" onClick={processOcr} disabled={scanning} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  {scanning ? "Scanning OCR..." : "⚡ Start OCR Scan"}
                </Button>
              </div>
            </div>

            {scanning && (
              <div className="p-6 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-center space-y-3 animate-pulse">
                <div className="text-2xl animate-spin">🌀</div>
                <p className="font-bold text-sm text-blue-700 dark:text-blue-300">Reading Doctor Prescription Text via AI Vision...</p>
                <p className="text-xs text-blue-600/80 dark:text-blue-400">Deciphering drug names, dosages, timings, and clinical notes...</p>
              </div>
            )}

            {ocrError && (
              <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-soft)] p-3 rounded-xl font-medium">{ocrError}</p>
            )}

            {ocrData && (
              <div className="space-y-4 border-t border-[var(--color-line)] pt-4 animate-fade-up">
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-1">
                    <p className="font-bold text-[var(--color-ink)]">🩺 Doctor & Clinic Info</p>
                    <p className="text-[var(--color-ink-soft)]">Dr. {ocrData.doctor?.name || "Not specified"}</p>
                    {ocrData.doctor?.specialty && <p className="text-[var(--color-ink-soft)]">{ocrData.doctor.specialty}</p>}
                    {ocrData.doctor?.hospital && <p className="text-[var(--color-ink-soft)]">{ocrData.doctor.hospital}</p>}
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-1">
                    <p className="font-bold text-[var(--color-ink)]">👤 Patient Details</p>
                    <p className="text-[var(--color-ink-soft)]">Name: {ocrData.patient?.name || "Patient"}</p>
                    {(ocrData.patient?.age || ocrData.patient?.gender) && (
                      <p className="text-[var(--color-ink-soft)]">Age/Gender: {ocrData.patient.age || "—"} / {ocrData.patient.gender || "—"}</p>
                    )}
                    {ocrData.patient?.date && <p className="text-[var(--color-ink-soft)]">Date: {ocrData.patient.date}</p>}
                  </div>
                </div>

                {(ocrData.diagnosis || ocrData.chiefComplaint || ocrData.advice) && (
                  <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xs space-y-2">
                    {ocrData.diagnosis && <p><b className="text-[var(--color-ink)]">Diagnosis:</b> <span className="text-[var(--color-ink-soft)]">{ocrData.diagnosis}</span></p>}
                    {ocrData.chiefComplaint && <p><b className="text-[var(--color-ink)]">Chief Complaints:</b> <span className="text-[var(--color-ink-soft)]">{ocrData.chiefComplaint}</span></p>}
                    {ocrData.advice && <p><b className="text-[var(--color-ink)]">Doctor Advice:</b> <span className="text-[var(--color-ink-soft)]">{ocrData.advice}</span></p>}
                  </div>
                )}

                {Array.isArray(ocrData.medicines) && ocrData.medicines.length > 0 && (
                  <div className="border border-[var(--color-line)] rounded-xl overflow-hidden text-xs">
                    <div className="px-3 py-2 bg-[var(--color-surface-2)] font-bold text-[var(--color-ink)] flex items-center justify-between">
                      <span>💊 Extracted Medicines ({ocrData.medicines.length})</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-[var(--color-line)] text-[var(--color-ink-soft)] font-semibold bg-[var(--color-surface-2)]/50">
                            <th className="p-2.5">Medicine Name</th>
                            <th className="p-2.5">Dosage / Frequency</th>
                            <th className="p-2.5">Timing & Food</th>
                            <th className="p-2.5">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ocrData.medicines.map((m, idx) => (
                            <tr key={idx} className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-surface-2)]/30">
                              <td className="p-2.5 font-bold text-[var(--color-ink)]">{m.name}</td>
                              <td className="p-2.5 text-[var(--color-ink-soft)]">{m.dosage || m.frequency || "As directed"}</td>
                              <td className="p-2.5">
                                <div className="flex flex-wrap gap-1 text-[10px]">
                                  {m.morning && <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-semibold">🌅 Morning</span>}
                                  {m.afternoon && <span className="bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 px-1.5 py-0.5 rounded font-semibold">☀️ Afternoon</span>}
                                  {m.night && <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.5 rounded font-semibold">🌙 Night</span>}
                                  {m.beforeFood && <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-semibold">Before Food</span>}
                                  {m.afterFood && <span className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">After Food</span>}
                                </div>
                              </td>
                              <td className="p-2.5 text-[var(--color-ink-soft)] font-mono">{m.durationDays ? `${m.durationDays} days` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {Array.isArray(ocrData.labTests) && ocrData.labTests.length > 0 && (
                  <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xs">
                    <p className="font-bold text-[var(--color-ink)] mb-1">🧪 Advised Lab Tests</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ocrData.labTests.map((t, idx) => (
                        <span key={idx} className="bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-lg text-[11px] font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-line)]">
                  <Button variant="ghost" size="sm" onClick={copyText}>📋 Copy OCR Text</Button>
                  <Button variant="secondary" size="sm" onClick={() => { setOcrData(null); setImage(null); }}>Scan Another Prescription</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}