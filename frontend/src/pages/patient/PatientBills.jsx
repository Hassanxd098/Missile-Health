import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { Button, StatusBadge, EmptyState, SkeletonCard, Modal, Select } from "../../components/ui";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function PatientBills() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    try { setData((await client.get("/patients/home")).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load bills"); }
  };
  useEffect(() => { load(); }, []);

  if (!data) return <div className="grid md:grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  const { invoices } = data;
  const pending = invoices.filter((i) => i.status === "pending");
  const paid = invoices.filter((i) => i.status === "paid");
  const totalPending = pending.reduce((s, i) => s + (i.total || 0), 0);

  const pay = async (id, method) => {
    setError(""); setMsg("");
    try { await client.post(`/patients/invoices/${id}/pay`, { method }); setMsg("Payment successful."); load(); }
    catch (e) { setError(e.response?.data?.error || "Payment failed"); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      {msg && <p className="text-sm text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-xl px-3 py-2">{msg}</p>}

      <div className="grid md:grid-cols-3 gap-4">
        <Card><p className="text-xs text-[var(--color-ink-soft)]">Pending bills</p><p className="text-3xl font-[var(--font-display)] text-[var(--color-ink)]">{pending.length}</p></Card>
        <Card><p className="text-xs text-[var(--color-ink-soft)]">Amount due</p><p className="text-3xl font-[var(--font-display)] text-[var(--color-danger)]">{money(totalPending)}</p></Card>
        <Card><p className="text-xs text-[var(--color-ink-soft)]">Paid bills</p><p className="text-3xl font-[var(--font-display)] text-[var(--color-success)]">{paid.length}</p></Card>
      </div>

      <Card>
        <h2 className="font-semibold text-lg text-[var(--color-ink)] mb-4">Bills & payments</h2>
        {invoices.length ? (
          <div className="space-y-3">
            {invoices.map((i) => <BillRow key={i._id} invoice={i} onPay={pay} />)}
          </div>
        ) : <EmptyState title="No bills yet" hint="Consultation and pharmacy invoices will appear here." />}
      </Card>
    </div>
  );
}

function BillRow({ invoice, onPay }) {
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState("online");
  return (
    <div className="border border-[var(--color-line)] rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--color-ink)]">{invoice.invoiceNo}</span>
            <StatusBadge status={invoice.status} />
            <StatusBadge status={invoice.type} />
          </div>
          <p className="text-xs text-[var(--color-ink-soft)] mt-1">{new Date(invoice.createdAt).toLocaleString()} · {invoice.doctor?.name || "Pharmacy"}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-lg text-[var(--color-ink)]">{money(invoice.total)}</p>
          {invoice.status === "pending"
            ? <Button size="sm" onClick={() => setPayOpen(true)}>Pay now</Button>
            : <p className="text-xs text-[var(--color-success)]">Paid via {invoice.paymentMethod} · {new Date(invoice.paidAt).toLocaleString()}</p>}
        </div>
      </div>

      {invoice.lines?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--color-line)]">
          {invoice.lines.map((l, idx) => (
            <div key={idx} className="flex justify-between text-sm py-0.5">
              <span className="text-[var(--color-ink-soft)]">{l.name} × {l.quantity}</span>
              <span className="text-[var(--color-ink)]">{money(l.amount)}</span>
            </div>
          ))}
          {invoice.gstAmount > 0 && (
            <div className="flex justify-between text-sm py-0.5">
              <span className="text-[var(--color-ink-soft)]">GST ({invoice.gstPercent}%)</span>
              <span className="text-[var(--color-ink)]">{money(invoice.gstAmount)}</span>
            </div>
          )}
          {invoice.consultationFee > 0 && (
            <div className="flex justify-between text-sm py-0.5">
              <span className="text-[var(--color-ink-soft)]">Consultation fee</span>
              <span className="text-[var(--color-ink)]">{money(invoice.consultationFee)}</span>
            </div>
          )}
        </div>
      )}

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={`Pay ${invoice.invoiceNo}`}>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[var(--color-ink-soft)]">Amount due</span>
            <span className="text-xl font-semibold text-[var(--color-ink)]">{money(invoice.total)}</span>
          </div>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {["online", "upi", "card", "cash", "insurance"].map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
          </Select>
          <Button className="w-full" onClick={() => { onPay(invoice._id, method); setPayOpen(false); }}>Pay {money(invoice.total)}</Button>
        </div>
      </Modal>
    </div>
  );
}