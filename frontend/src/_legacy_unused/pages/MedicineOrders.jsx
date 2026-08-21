import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import Card, { Button, inputClass, StatusBadge } from "../components/ui";
import client from "../api/client";

export default function MedicineOrders() {
  const [fileNameHint, setFileNameHint] = useState("prescription_photo.jpg");
  const [cart, setCart] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function loadOrders() {
    try {
      const { data } = await client.get("/orders/mine");
      setOrders(data);
    } catch { /* not onboarded */ }
  }
  useEffect(() => { loadOrders(); }, []);

  async function upload() {
    setError(null); setCart(null); setMessage(null);
    try {
      const { data } = await client.post("/orders/upload", { fileNameHint });
      setCart(data.cart);
      setConfidence(data.confidence);
    } catch (e) { setError(e.response?.data?.error || "Upload failed."); }
  }

  async function confirmOrder() {
    try {
      const { data } = await client.post("/orders/confirm", { items: cart });
      setMessage(data.message);
      setCart(null);
      loadOrders();
    } catch (e) { setError(e.response?.data?.error); }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="AI-Powered Prescription-to-Medicine Ordering" subtitle="Module 6 — upload a prescription, AI builds the cart" />
      <div className="flex-1 p-8 max-w-3xl space-y-6">
        <Card>
          <p className="text-xs text-[var(--color-ink-soft)] mb-4">
            Demo note: file upload is simulated by a filename hint — try "blurry_photo.jpg" to see the low-confidence rejection path.
          </p>
          <div className="flex gap-3">
            <input className={inputClass} value={fileNameHint} onChange={(e) => setFileNameHint(e.target.value)} />
            <Button onClick={upload}>Upload & extract</Button>
          </div>
          {error && <p className="text-sm text-[var(--color-danger)] mt-3">{error}</p>}
          {message && <p className="text-sm text-[var(--color-primary)] mt-3">{message}</p>}
        </Card>

        {cart && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-sm">Extracted cart</h3>
              <span className="text-xs text-[var(--color-ink-soft)]">Confidence {(confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="space-y-2">
              {cart.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-[var(--color-line)] pb-2 last:border-0">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-[var(--color-ink-soft)]">{item.frequency} × {item.durationDays}d — qty {item.quantity}</div>
                  </div>
                  <div className="text-right">
                    {item.available ? <span className="text-xs text-[var(--color-success)]">₹{item.price}</span> : <span className="text-xs text-[var(--color-warning)]">Out of stock — substitute needed</span>}
                    {item.needsReview && <div className="text-xs text-[var(--color-danger)]">Needs manual confirmation</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={confirmOrder}>Confirm & proceed to payment</Button>
            </div>
          </Card>
        )}

        <div>
          <h3 className="font-[var(--font-display)] text-lg mb-3">Your orders</h3>
          <div className="grid gap-3">
            {orders.map((o) => (
              <Card key={o.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-[var(--font-mono)] text-[var(--color-ink-soft)]">{o.id}</span>
                  <StatusBadge status={o.status} />
                </div>
                <ul className="text-sm text-[var(--color-ink-soft)]">
                  {o.items.map((i, idx) => <li key={idx}>{i.name} × {i.quantity}</li>)}
                </ul>
              </Card>
            ))}
            {orders.length === 0 && <Card><p className="text-sm text-[var(--color-ink-soft)]">No orders yet.</p></Card>}
          </div>
        </div>
      </div>
    </div>
  );
}
