import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { Button, Field, inputClass, StatusBadge, EmptyState, SectionTitle, SkeletonCard, useToast, Modal } from "../../components/ui";
import { IconPlus, IconShield } from "../../components/Icons";

export default function ManageAdmins() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(null);
  const toast = useToast();
  const load = async () => {
    try { setData((await client.get("/admin/admins")).data); }
    catch (e) { setError(e.response?.data?.error || "Only the super admin can manage admins"); }
  };
  useEffect(() => { load(); }, []);
  if (!data) return <div className="grid md:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div>;

  const create = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await client.post("/admin/admins", { name: f.get("name"), email: f.get("email"), password: f.get("password") });
      setCreating(false); toast("Admin created", "success"); load();
    } catch (err) { setError(err.response?.data?.error || "Could not create admin"); }
  };
  const toggle = async (u) => {
    try { await client.patch(`/admin/admins/${u._id}`, { active: !u.active }); load(); }
    catch (err) { setError(err.response?.data?.error || "Could not update"); }
  };
  const reset = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await client.post(`/admin/admins/${resetting._id}/reset-password`, { password: f.get("password") });
      setResetting(null); toast("Password reset", "success");
    } catch (err) { setError(err.response?.data?.error || "Could not reset password"); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      <Card>
        <SectionTitle title="Admins" subtitle="The super admin creates and manages admin accounts; an admin manages doctors, pharmacy, reception and employees" right={<Button onClick={() => setCreating(true)}><IconPlus /> Add admin</Button>} />
        {data.admins.length ? (
          <div className="divide-y divide-[var(--color-line)]">
            {data.admins.map((u) => (
              <div key={u._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><IconShield className="text-[var(--color-primary)]" /><span className="font-medium text-[var(--color-ink)]">{u.name}</span><StatusBadge status={u.active ? "active" : "blocked"} /></div>
                  <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">{u.email} · last login {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setResetting(u)}>Reset password</Button>
                  <Button size="sm" variant={u.active ? "danger" : "success"} onClick={() => toggle(u)}>{u.active ? "Deactivate" : "Activate"}</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No admins yet" hint="Create the first admin account." />}
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add admin">
        <form className="space-y-3" onSubmit={create}>
          <Field label="Full name"><input name="name" required className={inputClass} /></Field>
          <Field label="Email"><input name="email" type="email" required className={inputClass} /></Field>
          <Field label="Password" hint="Minimum 8 characters"><input name="password" type="password" required minLength={8} className={inputClass} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" type="button" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit">Create admin</Button></div>
        </form>
      </Modal>

      <Modal open={!!resetting} onClose={() => setResetting(null)} title={`Reset password — ${resetting?.name}`}>
        <form className="space-y-3" onSubmit={reset}>
          <Field label="New password" hint="Minimum 8 characters"><input name="password" type="password" required minLength={8} className={inputClass} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" type="button" onClick={() => setResetting(null)}>Cancel</Button><Button type="submit">Reset</Button></div>
        </form>
      </Modal>
    </div>
  );
}