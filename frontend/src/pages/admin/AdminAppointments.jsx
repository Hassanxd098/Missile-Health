import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { Button, StatusBadge, EmptyState, SkeletonCard, SectionTitle, Select, useToast } from "../../components/ui";

export default function AdminAppointments() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    try { setData((await client.get(`/admin/appointments?status=${status}`)).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load appointments"); }
  };
  useEffect(() => { load(); }, [status]);

  const update = async (id, st) => {
    try { await client.patch(`/admin/appointments/${id}`, { status: st }); toast(`Appointment ${st}`, "success"); load(); }
    catch (e) { toast(e.response?.data?.error || "Update failed", "error"); }
  };

  if (!data) return <Card><SkeletonCard /></Card>;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      <Card>
        <SectionTitle title="Appointments" subtitle={`${data.total} total`}
          right={<Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">{[["all", "All"], ["confirmed", "Confirmed"], ["in-progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["requested", "Requested"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>} />
        {data.appointments.length ? (
          <div className="divide-y divide-[var(--color-line)]">
            {data.appointments.map((a) => (
              <div key={a._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--color-ink)]">{a.patient?.name}</span>
                    <span className="text-[var(--color-ink-soft)] text-sm">with Dr. {a.doctor?.name}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-sm text-[var(--color-ink-soft)]">{new Date(a.scheduledFor).toLocaleString()} · {a.reason}</p>
                </div>
                <div className="flex gap-2">
                  {["requested", "confirmed", "in-progress"].includes(a.status) && <Button size="sm" onClick={() => update(a._id, "confirmed")}>Approve</Button>}
                  {["requested", "confirmed", "in-progress"].includes(a.status) && <Button size="sm" variant="danger" onClick={() => update(a._id, "cancelled")}>Reject</Button>}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title={status === "all" ? "No appointments yet" : "No appointments in this status"} />}
      </Card>
    </div>
  );
}