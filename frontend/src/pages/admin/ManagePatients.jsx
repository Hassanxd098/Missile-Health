import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { Button, inputClass, StatusBadge, EmptyState, SkeletonCard, SectionTitle, useToast } from "../../components/ui";

export default function ManagePatients() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const load = async (p = page, search = q) => {
    try { setData((await client.get(`/admin/patients?page=${p}&limit=15&search=${encodeURIComponent(search)}`)).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load patients"); }
  };
  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  const toggle = async (u, field) => {
    try {
      const payload = field === "blocked" ? { blocked: !u.blocked } : { active: !u.active };
      await client.patch(`/admin/patients/${u._id}/status`, payload);
      toast("Patient status updated", "success");
      load();
    } catch (err) { toast(err.response?.data?.error || "Update failed", "error"); }
  };

  if (!data) return <Card><SkeletonCard /></Card>;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      <Card>
        <SectionTitle title="Patients" subtitle={`${data.total} registered patients`}
          right={<form onSubmit={(e) => { e.preventDefault(); setPage(1); load(1, q); }} className="flex gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / ID / mobile…" className={`${inputClass} w-56`} /><Button type="submit">Search</Button></form>} />
        {data.patients.length ? (
          <div className="divide-y divide-[var(--color-line)]">
            {data.patients.map((u) => (
              <div key={u._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--color-ink)]">{u.name}</span>
                    <span className="text-xs font-[var(--font-mono)] text-[var(--color-primary)]">{u.patientId}</span>
                    <StatusBadge status={u.blocked ? "blocked" : u.active ? "active" : "cancelled"} />
                  </div>
                  <p className="text-sm text-[var(--color-ink-soft)]">{u.mobile || "—"} · {u.email} · Blood {u.patient?.bloodGroup || "—"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={u.active ? "danger" : "success"} onClick={() => toggle(u, "active")}>{u.active ? "Deactivate" : "Activate"}</Button>
                  <Button size="sm" variant={u.blocked ? "success" : "danger"} onClick={() => toggle(u, "blocked")}>{u.blocked ? "Unblock" : "Block"}</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No patients found" />}
        {data.total > 15 && (
          <div className="flex justify-center gap-2 mt-4">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span className="text-sm text-[var(--color-ink-soft)] px-2">Page {page}</span>
            <Button size="sm" variant="ghost" disabled={page * 15 >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </Card>
    </div>
  );
}