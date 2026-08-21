import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { Button, Field, inputClass, StatusBadge, Modal, EmptyState, SkeletonCard, SectionTitle, useToast } from "../../components/ui";
import { IconPlus } from "../../components/Icons";

export default function ManagePharmacy() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(null);

  const load = async () => {
    try { setData((await client.get("/admin/pharmacy")).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load pharmacy staff"); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await client.post("/admin/pharmacy", { name: f.get("name"), email: f.get("email"), password: f.get("password"), storeName: f.get("storeName") });
      setCreating(false); toast("Pharmacy account created", "success"); load();
    } catch (err) { toast(err.response?.data?.error || "Could not create account", "error"); }
  };
  const toggle = async (u) => {
    try { await client.patch(`/admin/pharmacy/${u._id}`, { active: !u.active }); load(); }
    catch (err) { toast(err.response?.data?.error || "Update failed", "error"); }
  };
  const reset = async (e) => {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password");
    try { await client.post(`/admin/doctors/${resetting._id}/reset-password`, { password }); setResetting(null); toast("Password reset", "success"); }
    catch (err) { toast(err.response?.data?.error || "Reset failed", "error"); }
  };

  if (!data) return <Card><SkeletonCard /></Card>;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      <Card>
        <SectionTitle title="Pharmacy staff" subtitle={`${data.pharmacy.length} accounts`} right={<Button onClick={() => setCreating(true)}><IconPlus /> Add pharmacy staff</Button>} />
        {data.pharmacy.length ? (
          <div className="divide-y divide-[var(--color-line)]">
            {data.pharmacy.map((u) => (
              <div key={u._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-[var(--color-ink)]">{u.name}</span><StatusBadge status={u.active ? "active" : "cancelled"} /></div>
                  <p className="text-sm text-[var(--color-ink-soft)]">{u.email} · {u.pharmacy?.storeName || "Store name not set"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setResetting(u)}>Reset password</Button>
                  <Button size="sm" variant={u.active ? "danger" : "success"} onClick={() => toggle(u)}>{u.active ? "Deactivate" : "Activate"}</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No pharmacy staff" hint="Add pharmacy users who receive and dispense prescriptions." />}
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add pharmacy staff">
        <form className="space-y-3" onSubmit={create}>
          <Field label="Full name"><input name="name" required className={inputClass} /></Field>
          <Field label="Email"><input name="email" required type="email" className={inputClass} /></Field>
          <Field label="Password"><input name="password" required minLength="8" type="password" className={inputClass} /></Field>
          <Field label="Store name"><input name="storeName" className={inputClass} /></Field>
          <Button type="submit" className="w-full">Create account</Button>
        </form>
      </Modal>

      <Modal open={!!resetting} onClose={() => setResetting(null)} title={`Reset password — ${resetting?.name}`}>
        <form onSubmit={reset} className="space-y-3">
          <Field label="New password"><input name="password" required minLength="8" type="password" className={inputClass} /></Field>
          <Button type="submit" className="w-full">Reset password</Button>
        </form>
      </Modal>
    </div>
  );
}