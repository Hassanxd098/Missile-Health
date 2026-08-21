import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { Button, Field, inputClass, StatusBadge, Modal, EmptyState, SkeletonCard, SectionTitle, Select, useToast } from "../../components/ui";
import { IconPlus, IconEdit } from "../../components/Icons";

const SPECIALTIES = ["General Physician", "Cardiologist", "Dermatologist", "ENT Specialist", "Pediatrician", "Orthopedic", "Neurologist", "Gynecologist", "Psychiatrist"];

export default function ManageDoctors() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async (page = 1) => {
    try { setData((await client.get(`/admin/doctors?page=${page}`)).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load doctors"); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await client.post("/admin/doctors", {
        name: f.get("name"),
        email: f.get("email"),
        password: f.get("password"),
        consultationFee: f.get("consultationFee"),
        availableToday: f.has("availableToday"),
        profile: {
          specialty: f.get("specialty"),
          location: f.get("location"),
          visitingHours: f.get("visitingHours"),
          qualification: f.get("qualification") || "",
        },
      });
      setCreating(false); toast("Doctor account created", "success"); load();
    } catch (err) { toast(err.response?.data?.error || "Could not create doctor", "error"); }
  };
  const update = async () => {
    if (!editing) return;
    try {
      await client.patch(`/admin/doctors/${editing._id}`, {
        name: editing.name,
        active: editing.active !== false,
        profile: {
          specialty: editing.profile?.specialty,
          consultationFee: editing.profile?.consultationFee,
          location: editing.profile?.location,
          visitingHours: editing.profile?.visitingHours,
        },
      });
      setEditing(null); toast("Doctor updated", "success"); load();
    } catch (err) { toast(err.response?.data?.error || "Update failed", "error"); }
  };

  if (!data) return <Card><SkeletonCard /></Card>;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      <Card>
        <SectionTitle title="Doctor directory" subtitle={`${data.total} doctors`} right={<Button onClick={() => setCreating(true)}><IconPlus /> Add doctor</Button>} />
        {data.doctors.length ? (
          <div className="divide-y divide-[var(--color-line)]">
            {data.doctors.map((d) => (
              <div key={d._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--color-ink)]">{d.name}</span>
                    <StatusBadge status={d.active ? "active" : "cancelled"} />
                    <span className="text-xs text-[var(--color-ink-soft)]">{d.profile?.specialty}</span>
                  </div>
                  <p className="text-sm text-[var(--color-ink-soft)]">{d.email} · {d.profile?.location} · Fee ₹{d.profile?.consultationFee || 0} · {d.profile?.qualification || "—"}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(d)}><IconEdit /> Edit</Button>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No doctors yet" hint="Add your first doctor." />}
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add doctor">
        <form className="space-y-3" onSubmit={create}>
          <Field label="Name"><input name="name" required className={inputClass} /></Field>
          <Field label="Email"><input name="email" required type="email" className={inputClass} /></Field>
          <Field label="Temporary password"><input name="password" required minLength="8" type="password" className={inputClass} /></Field>
          <Field label="Specialty"><Select name="specialty" required><option value="">Select</option>{SPECIALTIES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Location"><input name="location" required className={inputClass} /></Field>
          <Field label="Visiting hours"><input name="visitingHours" required className={inputClass} placeholder="Mon-Sat, 10 AM-4 PM" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Qualification"><input name="qualification" className={inputClass} placeholder="MBBS, MD" /></Field>
            <Field label="Consultation fee (₹)"><input name="consultationFee" type="number" min="0" className={inputClass} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]"><input type="checkbox" name="availableToday" defaultChecked /> Available today</label>
          <Button type="submit" className="w-full">Create doctor</Button>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name}`}>
        {editing && (
          <div className="space-y-3">
            <Field label="Specialty">
              <Select value={editing.profile?.specialty ?? ""} onChange={(e) => setEditing({ ...editing, profile: { ...editing.profile, specialty: e.target.value } })}>
                <option value="">Select…</option>
                {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Consultation fee (₹)">
              <input
                type="number" min="0" className={inputClass}
                value={editing.profile?.consultationFee ?? ""}
                onChange={(e) => setEditing({ ...editing, profile: { ...editing.profile, consultationFee: e.target.value } })}
              />
            </Field>
            <Field label="Location"><input className={inputClass} value={editing.profile?.location ?? ""} onChange={(e) => setEditing({ ...editing, profile: { ...editing.profile, location: e.target.value } })} /></Field>
            <Field label="Visiting hours" hint="e.g. Mon-Sat, 10 AM-2 PM — patients can only book inside these hours"><input className={inputClass} value={editing.profile?.visitingHours ?? ""} onChange={(e) => setEditing({ ...editing, profile: { ...editing.profile, visitingHours: e.target.value } })} /></Field>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]"><input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active account</label>
            <Button onClick={update} className="w-full">Save changes</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}