import { useEffect, useMemo, useState } from "react";
import client from "../../api/client";
import Card, { StatCard, StatusBadge, Button, EmptyState, SkeletonCard, SectionTitle, inputClass, Modal } from "../../components/ui";
import { IconPill, IconCheck, IconReceipt } from "../../components/Icons";
import { useToast } from "../../components/ui";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function PharmacyDashboard() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [billing, setBilling] = useState(null); // prescription being billed
  const [prices, setPrices] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setData((await client.get("/pharmacy/prescriptions")).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load prescriptions"); }
  };
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    let r = data?.prescriptions || [];
    if (status !== "all") r = r.filter((p) => p.status === status);
    if (q) { const s = q.toLowerCase(); r = r.filter((p) => [p.prescriptionId, p.patient?.name, p.patient?.patientId, p.doctor?.name].filter(Boolean).join(" ").toLowerCase().includes(s)); }
    return r;
  }, [data, status, q]);

  const advance = async (id, st) => {
    try { await client.patch(`/pharmacy/prescriptions/${id}/status`, { status: st }); toast("Status updated", "success"); load(); }
    catch (e) { toast(e.response?.data?.error || "Update failed", "error"); }
  };

  const openBilling = (rx) => {
    setBilling(rx);
    const pr = {};
    (rx.medicines || []).forEach((m, i) => { pr[i] = { name: m.name, qty: m.quantity || m.durationDays || 1, unitPrice: "" }; });
    setPrices(pr);
  };

  const generateInvoice = async () => {
    const missing = (billing.medicines || []).findIndex((_m, i) => {
      const raw = prices[i]?.unitPrice;
      return raw === "" || raw === undefined || raw === null || Number.isNaN(Number(raw));
    });
    if (missing !== -1) { toast("Enter a unit price for every medicine before generating the invoice", "error"); return; }
    setSaving(true);
    const lines = (billing.medicines || []).map((m, i) => ({ name: m.name, unitPrice: Number(prices[i]?.unitPrice) || 0 }));
    try {
      const { data } = await client.post(`/pharmacy/prescriptions/${billing._id}/invoice`, { lines });
      setBilling(null);
      toast(`Invoice ${data.invoice.invoiceNo} for ${money(data.total)} generated`, "success");
      load();
    } catch (e) { toast(e.response?.data?.error || "Could not generate invoice", "error"); }
    finally { setSaving(false); }
  };

  if (!data) return <div className="grid md:grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="New prescriptions" value={data.pendingMedicines} icon={<IconPill className="text-xl" />} tint="primary" />
        <StatCard label="In queue" value={rows.filter((p) => ["new", "sent-to-pharmacy"].includes(p.status)).length} icon={<IconReceipt className="text-xl" />} tint="warning" />
        <StatCard label="Ready" value={(data.prescriptions || []).filter((p) => p.status === "ready").length} icon={<IconCheck className="text-xl" />} tint="success" />
        <StatCard label="Dispensed" value={(data.prescriptions || []).filter((p) => p.status === "dispensed").length} icon={<IconCheck className="text-xl" />} tint="teal" />
      </div>

      <Card>
        <SectionTitle
          title="Prescription queue"
          subtitle="Received from doctors in real time"
          right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient / RX…" className={`${inputClass} w-44`} />}
        />
        <div className="flex flex-wrap gap-2 mb-4">
          {["all", "new", "sent-to-pharmacy", "preparing", "ready", "dispensed"].map((st) => (
            <button key={st} onClick={() => setStatus(st)} className={`px-3 py-1.5 text-xs rounded-full capitalize ${status === st ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-2)] text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)]"}`}>{st.replace("-", " ")}</button>
          ))}
        </div>

        {rows.length ? (
          <div className="divide-y divide-[var(--color-line)]">
            {rows.map((rx) => (
              <div key={rx._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--color-ink)]">{rx.prescriptionId}</span>
                    <StatusBadge status={rx.status} />
                  </div>
                  <p className="text-sm text-[var(--color-ink-soft)]">
                    {rx.patient?.name} ({rx.patient?.patientId}) · Dr. {rx.doctor?.name} · {new Date(rx.createdAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--color-ink-soft)]">{rx.medicines?.length || 0} medicines · {rx.diagnosis}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["sent-to-pharmacy", "new"].includes(rx.status) && <Button size="sm" onClick={() => advance(rx, "preparing")}>Start preparing</Button>}
                  {rx.status === "preparing" && <Button size="sm" onClick={() => advance(rx, "ready")}>Mark ready</Button>}
                  {["sent-to-pharmacy", "new", "preparing"].includes(rx.status) && <Button size="sm" variant="accent" onClick={() => openBilling(rx)}><IconReceipt /> Generate invoice</Button>}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No prescriptions" hint="Prescriptions forwarded by doctors will appear here." />}
      </Card>

      {/* Billing modal */}
      <Modal open={!!billing} onClose={() => setBilling(null)} title={`Generate invoice for ${billing?.prescriptionId}`} wide>
        {billing && (
          <div className="space-y-3">
            <div className="text-sm text-[var(--color-ink-soft)]">Patient: <b className="text-[var(--color-ink)]">{billing.patient?.name}</b> ({billing.patient?.patientId}) · Dr. {billing.doctor?.name}</div>
            {(billing.medicines || []).map((m, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-5 text-sm text-[var(--color-ink)]">{m.name} <span className="text-[var(--color-ink-soft)]">×{m.quantity || m.durationDays || 1}</span></span>
                <input type="number" min="0" className={`${inputClass} col-span-3`} placeholder="Unit price (₹)" value={prices[i]?.unitPrice || ""} onChange={(e) => setPrices({ ...prices, [i]: { ...(prices[i] || {}), unitPrice: e.target.value } })} />
                <span className="col-span-4 text-xs text-[var(--color-ink-soft)]">Subtotal: {money((Number(prices[i]?.unitPrice) || 0) * (m.quantity || m.durationDays || 1))}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <Button onClick={generateInvoice} disabled={saving}>{saving ? "Generating…" : "Generate invoice + 5% GST"}</Button>
              <span className="text-sm text-[var(--color-ink-soft)]">Consultation fee is auto-included</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}