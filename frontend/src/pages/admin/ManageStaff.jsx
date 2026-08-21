import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { Button, Field, inputClass, Select, StatusBadge, EmptyState, SectionTitle, SkeletonCard, useToast, Modal } from "../../components/ui";
import { IconPlus, IconUsers, IconActivity, IconDoctor } from "../../components/Icons";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function ManageStaff() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const load = async () => {
    try { setData((await client.get("/admin/staff-groups")).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load staff"); }
  };
  useEffect(() => { load(); }, []);
  if (!data) return <div className="grid md:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div>;

  const create = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await client.post("/admin/staff", { name: f.get("name"), email: f.get("email"), password: f.get("password"), role: f.get("role"), designation: f.get("designation"), salary: Number(f.get("salary")) || 0 });
      setCreating(false); toast("Staff created", "success"); load();
    } catch (err) { setError(err.response?.data?.error || "Could not create staff"); }
  };
  const saveEdit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await client.patch(`/admin/staff/${editing._id}`, { name: f.get("name") || undefined, profile: { salary: Number(f.get("salary")) || 0, designation: f.get("designation") || "" } });
      setEditing(null); toast("Saved", "success"); load();
    } catch (err) { setError(err.response?.data?.error || "Could not save"); }
  };
  const toggle = async (u) => {
    try { await client.patch(`/admin/staff/${u._id}`, { active: !u.active }); load(); }
    catch (err) { setError(err.response?.data?.error || "Could not update"); }
  };

  const groups = [
    { label: "Reception staff", key: "reception", icon: <IconUsers className="text-base" />, list: data.groups.reception },
    { label: "Cleaners", key: "cleaners", icon: <IconActivity className="text-base" />, list: data.groups.cleaners },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      <Card>
        <SectionTitle title="Staff: reception & cleaners" subtitle="Create accounts, set salaries and manage access" right={<Button onClick={() => setCreating(true)}><IconPlus /> Add staff</Button>} />
        <div className="grid md:grid-cols-2 gap-6">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)] mb-2">{g.icon} <span>{g.label}</span> <span className="text-xs text-[var(--color-ink-soft)]">({g.list.length})</span></div>
              {g.list.length ? (
                <div className="space-y-2">
                  {g.list.map((u) => (
                    <div key={u._id} className="border border-[var(--color-line)] rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[var(--color-ink)]">{u.name}</span>
                          <StatusBadge status={u.active ? "active" : "blocked"} />
                        </div>
                        <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">{u.email} · {u.profile?.designation || "—"} · <b className="text-[var(--color-primary)]">{money(u.profile?.salary)}</b>/month</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>Edit</Button>
                        <Button size="sm" variant={u.active ? "danger" : "success"} onClick={() => toggle(u)}>{u.active ? "Deactivate" : "Activate"}</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No staff yet" hint={`Add ${g.label.toLowerCase()} to get started.`} />}
            </div>
          ))}
        </div>
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add staff account">
        <form className="space-y-3" onSubmit={create}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role"><Select name="role" required defaultValue="reception"><option value="reception">Reception</option><option value="cleaner">Cleaner</option></Select></Field>
            <Field label="Designation"><input name="designation" className={inputClass} placeholder="e.g. Front desk, Housekeeping" /></Field>
          </div>
          <Field label="Full name"><input name="name" required className={inputClass} /></Field>
          <Field label="Email"><input name="email" type="email" required className={inputClass} /></Field>
          <Field label="Password" hint="Minimum 8 characters"><input name="password" type="password" required minLength={8} className={inputClass} /></Field>
          <Field label="Monthly salary"><input name="salary" type="number" min={0} className={inputClass} placeholder="e.g. 12000" /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" type="button" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit">Create staff</Button></div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name || "staff"}`}>
        {editing && (
          <form className="space-y-3" onSubmit={saveEdit}>
            <Field label="Full name"><input name="name" defaultValue={editing.name} className={inputClass} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Designation"><input name="designation" defaultValue={editing.profile?.designation || ""} className={inputClass} /></Field>
              <Field label="Monthly salary"><input name="salary" type="number" min={0} defaultValue={editing.profile?.salary || 0} className={inputClass} /></Field>
            </div>
            <div className="flex justify-end gap-2"><Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit">Save changes</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}