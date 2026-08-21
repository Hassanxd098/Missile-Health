import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { StatusBadge, Button, EmptyState, SkeletonCard, SectionTitle, Select, Modal } from "../../components/ui";
import { IconPrint } from "../../components/Icons";
import { useToast } from "../../components/ui";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function PharmacyInvoices() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [paying, setPaying] = useState(null);
  const [method, setMethod] = useState("cash");

  const load = async () => {
    try { setData((await client.get(`/pharmacy/invoices?status=${status}`)).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load invoices"); }
  };
  useEffect(() => { load(); }, [status]);

  const confirmPay = async () => {
    try {
      await client.post(`/pharmacy/invoices/${paying._id}/pay`, { method });
      setPaying(null); toast("Payment recorded. Medicines dispensed.", "success"); load();
    } catch (e) { toast(e.response?.data?.error || "Payment failed", "error"); }
  };

  if (!data) return <Card><SkeletonCard /></Card>;
  const totalPending = (data.invoices || []).filter((i) => i.status === "pending").reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}

      <div className="grid md:grid-cols-3 gap-4">
        <Card><p className="text-xs text-[var(--color-ink-soft)]">Invoices</p><p className="text-3xl font-[var(--font-display)] text-[var(--color-ink)]">{data.total}</p></Card>
        <Card><p className="text-xs text-[var(--color-ink-soft)]">Pending amount</p><p className="text-3xl font-[var(--font-display)] text-[var(--color-warning)]">{money(totalPending)}</p></Card>
        <Card><p className="text-xs text-[var(--color-ink-soft)]">Ready to dispense</p><p className="text-3xl font-[var(--font-display)] text-[var(--color-success)]">{(data.invoices || []).filter((i) => i.status === "pending").length}</p></Card>
      </div>

      <Card>
        <SectionTitle
          title="Invoices & billing"
          subtitle="Collect payments and dispense medicines"
          right={
            <div className="flex gap-2">
              {["all", "pending", "paid"].map((st) => (
                <button key={st} onClick={() => setStatus(st)} className={`px-3 py-1.5 text-xs rounded-full capitalize ${status === st ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-2)] text-[var(--color-ink-soft)]"}`}>{st}</button>
              ))}
            </div>
          }
        />
        {data.invoices.length ? (
          <div className="divide-y divide-[var(--color-line)]">
            {data.invoices.map((inv) => (
              <div key={inv._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--color-ink)]">{inv.invoiceNo}</span>
                    <StatusBadge status={inv.status} />
                    <StatusBadge status={inv.type} />
                  </div>
                  <p className="text-sm text-[var(--color-ink-soft)]">{inv.patient?.name} ({inv.patient?.patientId}) · {inv.doctor?.name || "—"} · {inv.prescription?.prescriptionId || ""}</p>
                  {inv.lines?.length ? <p className="text-xs text-[var(--color-ink-soft)]">{inv.lines.map((l) => `${l.name}×${l.quantity}`).join(", ")}</p> : null}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[var(--color-ink)]">{money(inv.total)}</p>
                  {inv.status === "pending"
                    ? <div className="flex gap-2 mt-1"><Button size="sm" onClick={() => setPaying(inv)}>Mark paid</Button><Button size="sm" variant="ghost" onClick={() => printInvoice(inv)}><IconPrint /> Print</Button></div>
                    : <p className="text-xs text-[var(--color-success)]">Paid via {inv.paymentMethod} · {new Date(inv.paidAt).toLocaleString()}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No invoices" hint="Generate invoices from the prescription queue." />}
      </Card>

      <Modal open={!!paying} onClose={() => setPaying(null)} title={`Collect payment — ${paying?.invoiceNo}`}>
        {paying && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[var(--color-surface-2)] p-4">
              <p className="text-sm text-[var(--color-ink-soft)]">Patient: <b className="text-[var(--color-ink)]">{paying.patient?.name}</b></p>
              <div className="flex justify-between mt-2 text-sm"><span className="text-[var(--color-ink-soft)]">Total</span><span className="text-xl font-semibold text-[var(--color-ink)]">{money(paying.total)}</span></div>
            </div>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {["cash", "upi", "card", "insurance", "online"].map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
            </Select>
            <Button className="w-full" onClick={confirmPay}>Confirm payment & dispense</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function printInvoice(inv) {
  const w = window.open("", "_blank", "width=760,height=900");
  w.document.write(`<html><head><title>${inv.invoiceNo}</title><style>body{font-family:system-ui;padding:40px;color:#0B2545}h1{font-size:20px;border-bottom:2px solid #1B74E4;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #dfe;padding:8px;text-align:left;font-size:13px}th{background:#E3EEFC}.muted{color:#5A6E85;font-size:12px}.total{font-size:18px;font-weight:700}</style></head><body>
<h1>Missile Health Pharmacy &nbsp;<span class="muted">Invoice</span></h1>
<p class="muted">${inv.invoiceNo} · ${new Date(inv.createdAt).toLocaleString()}</p>
<p class="muted">Patient: ${inv.patient?.name} (${inv.patient?.patientId})</p>
<p class="muted">Doctor: ${inv.doctor?.name || "—"}</p>
<table><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
${(inv.lines || []).map((l) => `<tr><td>${l.name}</td><td>${l.quantity}</td><td>${l.unitPrice}</td><td>${money(l.amount)}</td></tr>`).join("")}
${inv.consultationFee ? `<tr><td>Consultation fee</td><td>1</td><td>${inv.consultationFee}</td><td>${money(inv.consultationFee)}</td></tr>` : ""}
${inv.gstAmount ? `<tr><td>GST ${inv.gstPercent}%</td><td></td><td></td><td>${money(inv.gstAmount)}</td></tr>` : ""}
</table>
<p class="total" style="text-align:right;margin-top:16px">Total: ${money(inv.total)}</p>
<p class="muted" style="margin-top:24px">${inv.status === "paid" ? `Paid via ${inv.paymentMethod} on ${new Date(inv.paidAt).toLocaleString()}` : "Status: " + inv.status}</p>
</html>`);
  w.document.close();
}