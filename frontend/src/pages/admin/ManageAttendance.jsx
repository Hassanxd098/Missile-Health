import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { Button, Field, inputClass, Select, StatusBadge, EmptyState, SectionTitle, SkeletonCard, useToast, Modal } from "../../components/ui";
import { IconCalendar } from "../../components/Icons";

const pad = (x) => String(x).padStart(2, "0");
const monthStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export default function ManageAttendance() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(monthStr());
  const [role, setRole] = useState("all");
  const [marking, setMarking] = useState(null);
  const toast = useToast();

  const load = async () => {
    try { setData((await client.get(`/admin/attendance?month=${month}`)).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load attendance"); }
  };
  useEffect(() => { load(); }, [month]);
  if (!data) return <div className="grid md:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div>;

  const rows = (data.rollup || []).filter((r) => role === "all" || r.user?.role === role);
  const mark = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await client.put("/admin/attendance", { userId: marking._id, date: `${month}-${f.get("day")}`, status: f.get("status"), checkIn: f.get("checkIn") || "09:00", source: "admin" });
      setMarking(null); toast("Attendance recorded", "success"); load();
    } catch (err) { setError(err.response?.data?.error || "Could not record attendance"); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      <Card>
        <SectionTitle
          title="Staff attendance"
          subtitle="Attendance for all hospital employees; admins can correct any day. Biometric sync arrives later."
          right={<div className="flex gap-2"><input type="month" value={month} max={monthStr()} onChange={(e) => setMonth(e.target.value)} className={`${inputClass} w-44`} /><Select value={role} onChange={(e) => setRole(e.target.value)} className="w-44">{[["all", "Everyone"], ["doctor", "Doctors"], ["reception", "Reception"], ["nurse", "Nurses"], ["management", "Management"], ["security", "Security"], ["other", "Other staff"], ["pharmacy", "Pharmacy"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></div>}
        />
        {rows.length ? (
          <div className="divide-y divide-[var(--color-line)]">
            {rows.map((r) => (
              <div key={r.user._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--color-ink)]">{r.user.name}</span>
                    <StatusBadge status={r.user.active ? "active" : "blocked"} />
                    <span className="text-xs text-[var(--color-ink-soft)] capitalize">{r.user.role}</span>
                  </div>
                  <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">{r.user.profile?.designation || "—"} · {r.user.profile?.specialty || r.user.pharmacy?.storeName || ""}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm text-[var(--color-ink-soft)]">Present <b className="text-[var(--color-success)]">{r.presentDays}</b>/{r.totalDays} days</span>
                  <Button size="sm" variant="ghost" onClick={() => setMarking(r.user)}><IconCalendar /> Mark day</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No staff in this category" hint="Choose another role or month." />}
      </Card>

      <Modal open={!!marking} onClose={() => setMarking(null)} title={`Attendance for ${marking?.name}`}>
        <form className="space-y-3" onSubmit={mark}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Day of month (1-31)"><input name="day" type="number" min={1} max={31} required defaultValue={new Date().getDate()} className={inputClass} /></Field>
            <Field label="Status"><Select name="status" defaultValue="present"><option value="present">Present</option><option value="absent">Absent</option><option value="half-day">Half-day</option><option value="leave">Leave</option></Select></Field>
          </div>
          <Field label="Check-in time"><input name="checkIn" type="time" defaultValue="09:00" className={inputClass} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" type="button" onClick={() => setMarking(null)}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      </Modal>
    </div>
  );
}