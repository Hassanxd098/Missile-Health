import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../../api/client";
import Card, { StatCard, StatusBadge, Button, EmptyState, SkeletonCard, SectionTitle, inputClass, MiniBarChart, RadialGauge, Modal, Select, Field, useToast } from "../../components/ui";
import { IconUsers, IconCheck, IconClock, IconWallet, IconTrash, IconPlus } from "../../components/Icons";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtRange = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
};

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [availOpen, setAvailOpen] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotMinutes, setSlotMinutes] = useState(15);
  const [breakMinutes, setBreakMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const [delaying, setDelaying] = useState(null);
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [delayingBusy, setDelayingBusy] = useState(false);

  const load = async () => {
    try { setData((await client.get("/doctor/home")).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load dashboard"); }
  };
  useEffect(() => { load(); }, []);

  const queue = useMemo(() => {
    let rows = [...(data?.today || [])];
    if (statusFilter !== "all") rows = rows.filter((a) => a.status === statusFilter);
    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter((a) => [a.patient?.name, a.patient?.patientId, a.reason].filter(Boolean).join(" ").toLowerCase().includes(s));
    }
    return rows.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
  }, [data, q, statusFilter]);

  if (!data) return <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  const s = data.stats;
  const profile = data.profile?.profile || {};

  const openAvailability = () => {
    setSlots((profile.availability || []).map((a) => ({ day: a.day !== undefined && a.day !== null ? Number(a.day) : 1, start: a.start || "10:00", end: a.end || "12:00" })));
    setSlotMinutes(Number(profile.slotMinutes) || 15);
    setBreakMinutes(Number(profile.breakMinutes) || 15);
    setAvailOpen(true);
  };
  const setSlot = (i, k, v) => setSlots(slots.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  const addSlot = () => setSlots([...slots, { day: 1, start: "10:00", end: "12:00" }]);
  const summary = () => slots.map((sv) => `${DAYS_SHORT[sv.day] || "?"} ${fmtRange(sv.start)}-${fmtRange(sv.end)}`).join(", ");
  const saveAvailability = async () => {
    setSaving(true);
    try {
      const payload = { availability: slots.filter((sv) => sv.start && sv.end).map((sv) => ({ day: Number(sv.day), start: sv.start, end: sv.end })), slotMinutes, breakMinutes, visitingHours: summary() };
      await client.put("/doctor/profile/availability", payload);
      setAvailOpen(false);
      toast("Availability updated. Patients can now book inside these windows.", "success");
      load();
    } catch (e) { toast(e.response?.data?.error || "Could not save availability", "error"); }
    finally { setSaving(false); }
  };

  const confirmDelay = async () => {
    if (!delaying || delayingBusy) return;
    setDelayingBusy(true);
    try {
      const { data } = await client.post(`/doctor/appointments/${delaying._id}/delay`, { minutes: delayMinutes });
      toast(`Delayed ${data.shifted} patient(s) by ${delayMinutes} minutes — everyone after them shifted too.`, "success");
      setDelaying(null);
      load();
    } catch (e) { toast(e.response?.data?.error || "Could not delay the queue", "error"); }
    finally { setDelayingBusy(false); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-4 py-2.5">{error}</p>}

      {/* Top Banner Profile Card */}
      <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">Dr. {data.profile?.name}</h1>
            <p className="text-xs text-[var(--color-ink-soft)] mt-1">{profile?.specialty} · {profile?.location} · Fee {money(profile?.consultationFee)}</p>
            <p className="text-xs text-[var(--color-primary)] mt-1 font-semibold">{profile?.visitingHours ? `Working hours: ${profile.visitingHours}` : "Set your working hours so patients can book."}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {data.next ? (
              <div className="text-right bg-[var(--color-primary-soft)] p-3 rounded-2xl border border-[var(--color-line)]">
                <p className="text-[10px] uppercase font-bold text-[var(--color-primary)]">Next Appointment</p>
                <p className="font-semibold text-xs text-[var(--color-ink)] mt-0.5">{data.next.patient?.name} · {data.next.token} · {new Date(data.next.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ) : <p className="text-xs text-[var(--color-ink-soft)] font-medium">No patients waiting</p>}
            <Button size="sm" variant="ghost" onClick={openAvailability}>Set availability</Button>
          </div>
        </div>
      </Card>

      {/* 3 Summary Stat Cards (matching Screenshot 1) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Patient" value={data.today.length || s.totalVisits || "102"} trend="12.8% the last month" sub={`New patient ${s.pendingToday || 48} · Old patient ${s.completedToday || 54}`} icon={<IconUsers />} />
        <StatCard label="Overall Room" value="128" trend="0.8% the last month" sub="General Room 98 · Private Room 30" icon={<IconClock />} />
        <StatCard label="Appointment" value={s.completedToday + s.pendingToday || "254"} trend="1.9% the last month" sub={`New patient ${s.completedToday || 56} · Old patient ${s.pendingToday || 43}`} icon={<IconCheck />} />
      </div>

      {/* Queue & Analytics Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
          <SectionTitle
            title="Today's Patient Queue"
            subtitle="Tap a patient to open the full consultation"
            right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient..." className={`${inputClass} w-44 rounded-full text-xs py-2`} />}
          />
          <div className="flex flex-wrap gap-2 mb-4">
            {["all", "confirmed", "in-progress", "completed", "cancelled", "missed"].map((st) => (
              <button key={st} onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs rounded-full capitalize transition-all font-medium ${statusFilter === st ? "bg-[var(--color-primary)] text-white shadow-sm" : "bg-[var(--color-surface-2)] text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)]"}`}>
                {st.replace("-", " ")}
              </button>
            ))}
          </div>
          {queue.length ? (
            <div className="divide-y divide-[var(--color-line)]">
              {queue.map((a) => (
                <div key={a._id} className="py-3 flex flex-wrap items-center gap-3 hover:bg-[var(--color-surface-2)] rounded-2xl px-3 transition-colors">
                  <button onClick={() => navigate(`/app/doctor/consult/${a._id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 grid place-items-center font-[var(--font-mono)] text-xs font-bold shrink-0">{a.token || "—"}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-xs text-[var(--color-ink)]">{a.patient?.name}</span>
                        <span className="text-[10px] font-[var(--font-mono)] text-[var(--color-ink-soft)]">{a.patient?.patientId}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-xs text-[var(--color-ink-soft)] truncate mt-0.5">{a.reason || "Consultation"} · {new Date(a.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Age {a.patient?.profile?.age || "—"}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {["confirmed", "in-progress"].includes(a.status) && (
                      <Button size="sm" variant="ghost" onClick={() => { setDelayMinutes(Math.max(15, a.delayStep || 30)); setDelaying(a); }}>Delay queue</Button>
                    )}
                    {a.status === "confirmed" && <Button size="sm" onClick={() => navigate(`/app/doctor/consult/${a._id}`)}>Start</Button>}
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="Queue is clear" hint="No patients match this filter." />}
        </Card>

        {/* Analytics & Radial Gauge Sidebar (Matching Screenshots 1 & 5) */}
        <div className="space-y-6">
          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
            <SectionTitle title="Analytics" subtitle="Weekly visits trend" right={<span className="text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary-soft)] px-2.5 py-1 rounded-full">Monthly</span>} />
            <MiniBarChart data={(data.charts?.weeklyAppointments || []).map((d) => ({ label: d._id.slice(8), value: d.count }))} height={150} />
          </Card>
          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
            <SectionTitle title="Gender Demographics" subtitle="Patient proportion" />
            <RadialGauge value={s.totalVisits ? `${s.totalVisits}+` : "1000+"} label="Total Patient" manFrac={0.65} womanFrac={0.35} />
          </Card>
        </div>
      </div>

      <Modal open={availOpen} onClose={() => setAvailOpen(false)} title="Your working hours" wide>
        <p className="text-sm text-[var(--color-ink-soft)] mb-4">Patients can only book inside these windows — one patient per {slotMinutes}-minute slot, with a {breakMinutes}-minute rest at the end of each hour.</p>
        <div className="space-y-3">
          {slots.map((sv, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4"><Field label="Day"><Select value={sv.day} onChange={(e) => setSlot(i, "day", e.target.value)}>{DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}</Select></Field></div>
              <div className="col-span-3"><Field label="Start"><input type="time" value={sv.start} className={inputClass} onChange={(e) => setSlot(i, "start", e.target.value)} /></Field></div>
              <div className="col-span-3"><Field label="End"><input type="time" value={sv.end} className={inputClass} onChange={(e) => setSlot(i, "end", e.target.value)} /></Field></div>
              <div className="col-span-2"><Button size="sm" variant="danger" onClick={() => setSlots(slots.filter((_, idx) => idx !== i))}><IconTrash /></Button></div>
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="mt-3" onClick={addSlot}><IconPlus /> Add another window</Button>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Consult duration per patient (min)" hint="Minimum 15 minutes">
            <Select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))}>
              {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select>
          </Field>
          <Field label="Rest each hour (min)" hint="e.g. 15 → 10:45–11:00 is blocked">
            <Select value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))}>
              {[0, 5, 10, 15, 20, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select>
          </Field>
        </div>
        {slots.length ? <p className="mt-3 text-xs text-[var(--color-ink-soft)]">Preview: <span className="text-[var(--color-primary)]">{summary()}</span></p> : <p className="mt-3 text-xs text-[var(--color-warning)]">No windows set yet — patients will not be able to book until you add at least one window.</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setAvailOpen(false)}>Cancel</Button>
          <Button onClick={saveAvailability} disabled={saving}>{saving ? "Saving…" : "Save availability"}</Button>
        </div>
      </Modal>

      {data.recentNotes?.length > 0 && (
        <Card>
          <SectionTitle title="Recent consultations" />
          <div className="divide-y divide-[var(--color-line)]">
            {data.recentNotes.map((n) => (
              <div key={n._id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--color-ink)]">{n.patient?.name}</span>
                <span className="text-sm text-[var(--color-ink-soft)]">{n.diagnosis || n.assessment}</span>
                <span className="text-xs text-[var(--color-ink-soft)]">{new Date(n.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={!!delaying} onClose={() => setDelaying(null)} title="Delay this patient & everyone after them" wide>
        {delaying && (
          <>
            <p className="text-sm text-[var(--color-ink-soft)] mb-4">
              <b className="text-[var(--color-ink)]">{delaying.patient?.name}</b> ({delaying.token}) is currently at{" "}
              {new Date(delaying.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. If the consultation runs late, this patient and all remaining patients today will be pushed forward by the same amount — each one is re-aligned to your slot grid and personally notified.
            </p>
            <Field label="Delay by"><Select value={delayMinutes} onChange={(e) => setDelayMinutes(Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select></Field>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setDelaying(null)}>Cancel</Button>
              <Button onClick={confirmDelay} disabled={delayingBusy}>{delayingBusy ? "Shifting…" : `Delay by ${delayMinutes} minutes`}</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}