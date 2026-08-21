import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../../api/client";
import Card, { StatCard, StatusBadge, Button, EmptyState, SkeletonCard, SectionTitle, inputClass, MiniBarChart, RadialGauge, Modal, Select, Field, useToast } from "../../components/ui";
import { IconUsers, IconCheck, IconClock, IconWallet, IconTrash, IconPlus, IconRefresh } from "../../components/Icons";

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
  const [statusFilter, setStatusFilter] = useState("upcoming"); // default to all upcoming appointments so no patients are missed
  const [availOpen, setAvailOpen] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotMinutes, setSlotMinutes] = useState(15);
  const [breakMinutes, setBreakMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const [delaying, setDelaying] = useState(null);
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [delayingBusy, setDelayingBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = async (showLoading = false) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const res = await client.get("/doctor/home");
      setData(res.data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.error || "Unable to load dashboard");
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  };

  // Real-time auto refresh polling every 5 seconds
  useEffect(() => {
    load();
    const timer = setInterval(() => load(false), 5000);
    return () => clearInterval(timer);
  }, []);

  const queue = useMemo(() => {
    if (!data) return [];
    let rows = [];
    if (statusFilter === "today") {
      rows = [...(data.today || [])];
    } else if (statusFilter === "upcoming") {
      rows = [...(data.allAppointments || data.upcoming || [])].filter((a) =>
        ["confirmed", "in-progress", "requested"].includes(a.status)
      );
    } else if (statusFilter === "all") {
      rows = [...(data.allAppointments || data.today || [])];
    } else {
      rows = [...(data.allAppointments || data.today || [])].filter((a) => a.status === statusFilter);
    }

    if (q) {
      const s = q.toLowerCase().trim();
      rows = rows.filter((a) =>
        [a.patient?.name, a.patient?.patientId, a.reason, a.token]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(s)
      );
    }

    return rows.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
  }, [data, q, statusFilter]);

  if (!data) return <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;

  const s = data.stats || {};
  const profile = data.profile?.profile || {};

  const openAvailability = () => {
    setSlots((profile.availability || []).map((a) => ({ day: a.day !== undefined && a.day !== null ? Number(a.day) : 1, start: a.start || "10:00", end: a.end || "12:00" })));
    setSlotMinutes(Number(profile.slotMinutes) || 15);
    setBreakMinutes(Number(profile.breakMinutes) || 15);
    setAvailOpen(true);
  };
  const setSlot = (i, k, v) => setSlots(slots.map((sv, idx) => idx === i ? { ...sv, [k]: v } : sv));
  const addSlot = () => setSlots([...slots, { day: 1, start: "10:00", end: "12:00" }]);
  const summary = () => slots.map((sv) => `${DAYS_SHORT[sv.day] || "?"} ${fmtRange(sv.start)}-${fmtRange(sv.end)}`).join(", ");
  const saveAvailability = async () => {
    setSaving(true);
    try {
      const payload = { availability: slots.filter((sv) => sv.start && sv.end).map((sv) => ({ day: Number(sv.day), start: sv.start, end: sv.end })), slotMinutes, breakMinutes, visitingHours: summary() };
      await client.put("/doctor/profile/availability", payload);
      setAvailOpen(false);
      toast("Availability updated. Patients can now book inside these windows.", "success");
      load(true);
    } catch (e) { toast(e.response?.data?.error || "Could not save availability", "error"); }
    finally { setSaving(false); }
  };

  const confirmDelay = async () => {
    if (!delaying || delayingBusy) return;
    setDelayingBusy(true);
    try {
      const { data: resData } = await client.post(`/doctor/appointments/${delaying._id}/delay`, { minutes: delayMinutes });
      toast(`Delayed ${resData.shifted} patient(s) by ${delayMinutes} minutes — everyone after them shifted too.`, "success");
      setDelaying(null);
      load(true);
    } catch (e) { toast(e.response?.data?.error || "Could not delay the queue", "error"); }
    finally { setDelayingBusy(false); }
  };

  const totalPatientsCount = s.totalAppointments || data.allAppointments?.length || 0;
  const activeAppointmentsCount = s.pendingTotal || data.upcoming?.length || 0;
  const completedVisitsCount = s.totalVisits || s.completedToday || 0;
  const totalRevenue = s.totalRevenue || s.revenueToday || 0;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-4 py-2.5">{error}</p>}

      {/* Top Banner Profile Card */}
      <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">Dr. {data.profile?.name}</h1>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Real-Time Live Sync
              </span>
            </div>
            <p className="text-xs text-[var(--color-ink-soft)] mt-1">{profile?.specialty || "Specialist"} · {profile?.location || "Clinic"} · Fee {money(profile?.consultationFee)}</p>
            <p className="text-xs text-[var(--color-primary)] mt-1 font-semibold">{profile?.visitingHours ? `Working hours: ${profile.visitingHours}` : "Set your working hours so patients can book."}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {data.next ? (
              <div className="text-right bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-200 dark:border-blue-800">
                <p className="text-[10px] uppercase font-bold text-blue-600">Next Appointment</p>
                <p className="font-semibold text-xs text-[var(--color-ink)] mt-0.5">
                  {data.next.patient?.name || "Patient"} · {data.next.token || "T01"} · {new Date(data.next.scheduledFor).toLocaleDateString()} {new Date(data.next.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ) : <p className="text-xs text-[var(--color-ink-soft)] font-medium">No patients waiting in queue</p>}

            <div className="flex items-center gap-2">
              <button
                onClick={() => load(true)}
                disabled={isRefreshing}
                className="px-3 py-1.5 rounded-xl border border-[var(--color-line)] text-xs text-[var(--color-ink-soft)] hover:text-blue-600 flex items-center gap-1 transition-all"
              >
                <IconRefresh className={isRefreshing ? "animate-spin" : ""} /> Refresh
              </button>
              <Button size="sm" variant="ghost" onClick={openAvailability}>Set availability</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Real Dynamic Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Patients"
          value={totalPatientsCount}
          sub={`${activeAppointmentsCount} Active · ${completedVisitsCount} Completed`}
          icon={<IconUsers className="text-blue-600" />}
        />
        <StatCard
          label="Active Appointments"
          value={activeAppointmentsCount}
          sub={`${data.today?.length || 0} Scheduled Today`}
          icon={<IconClock className="text-amber-500" />}
        />
        <StatCard
          label="Completed Visits"
          value={completedVisitsCount}
          sub={`${s.completedToday || 0} Completed Today`}
          icon={<IconCheck className="text-emerald-500" />}
        />
        <StatCard
          label="Total Consultation Revenue"
          value={money(totalRevenue)}
          sub={`Today: ${money(s.revenueToday)}`}
          icon={<IconWallet className="text-purple-500" />}
        />
      </div>

      {/* Queue & Analytics Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
          <SectionTitle
            title="Patient Consultations Queue"
            subtitle={`Displaying ${queue.length} appointment(s)`}
            right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient or token..." className={`${inputClass} w-44 rounded-full text-xs py-2`} />}
          />

          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { id: "upcoming", label: "Upcoming & Active" },
              { id: "today", label: "Today Only" },
              { id: "all", label: "All Appointments" },
              { id: "confirmed", label: "Confirmed" },
              { id: "in-progress", label: "In Progress" },
              { id: "completed", label: "Completed" },
              { id: "cancelled", label: "Cancelled" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3.5 py-1.5 text-xs rounded-full capitalize transition-all font-medium cursor-pointer ${
                  statusFilter === st.id
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold"
                    : "bg-[var(--color-surface-2)] text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {queue.length ? (
            <div className="divide-y divide-[var(--color-line)]">
              {queue.map((a) => {
                const now = Date.now();
                const apptTime = new Date(a.scheduledFor).getTime();
                const oneHourMs = 60 * 60 * 1000;
                const isEligibleToStart = (apptTime - now) <= oneHourMs;

                const handleRowClick = () => {
                  if (!isEligibleToStart && a.status === "confirmed") {
                    toast(`Consultation room locked: Scheduled for ${new Date(a.scheduledFor).toLocaleString()}. Available 1 hour before appointment time.`, "info");
                    return;
                  }
                  navigate(`/app/doctor/consult/${a._id}`);
                };

                return (
                  <div key={a._id} className="py-3 flex flex-wrap items-center gap-3 hover:bg-[var(--color-surface-2)] rounded-2xl px-3 transition-colors">
                    <button onClick={handleRowClick} className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white grid place-items-center font-[var(--font-mono)] text-xs font-bold shrink-0 shadow-sm">
                        {a.token || "T01"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-[var(--color-ink)]">{a.patient?.name || "Patient"}</span>
                          <span className="text-[10px] font-[var(--font-mono)] text-[var(--color-primary)] bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full font-bold">{a.patient?.patientId || "PAT"}</span>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="text-xs text-[var(--color-ink-soft)] truncate mt-0.5">
                          📅 {new Date(a.scheduledFor).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {new Date(a.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {a.reason ? ` · Reason: ${a.reason}` : ""}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {["confirmed", "in-progress"].includes(a.status) && (
                        <Button size="sm" variant="ghost" onClick={() => { setDelayMinutes(Math.max(15, a.delayStep || 30)); setDelaying(a); }}>
                          Delay
                        </Button>
                      )}
                      {a.status === "confirmed" && (
                        isEligibleToStart ? (
                          <Button size="sm" onClick={() => navigate(`/app/doctor/consult/${a._id}`)} className="shadow-md shadow-blue-500/20">
                            Start Consult
                          </Button>
                        ) : (
                          <button
                            onClick={() => toast(`Consultation room locked until 1 hour before scheduled time (${new Date(a.scheduledFor).toLocaleDateString()} ${new Date(a.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`, "info")}
                            className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                            title="Available 1 hour before appointment"
                          >
                            <IconClock className="text-xs" /> Starts 1h Before
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No patients found in queue" hint="No appointments match the selected filter." />
          )}
        </Card>

        {/* Analytics & Demographics Sidebar */}
        <div className="space-y-6">
          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
            <SectionTitle title="Analytics" subtitle="Weekly visits trend" right={<span className="text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary-soft)] px-2.5 py-1 rounded-full">Weekly</span>} />
            <MiniBarChart data={(data.charts?.weeklyAppointments || []).map((d) => ({ label: d._id.slice(8), value: d.count }))} height={150} />
          </Card>

          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
            <SectionTitle title="Gender Demographics" subtitle="Patient proportion" />
            <RadialGauge value={`${totalPatientsCount}`} label="Total Patients" manFrac={0.6} womanFrac={0.4} />
          </Card>
        </div>
      </div>

      {/* Set Working Hours Modal */}
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
          <Field label="Consult duration per patient (min)">
            <Select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))}>
              {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </Select>
          </Field>
          <Field label="Rest each hour (min)">
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

      {/* Delay Queue Modal */}
      <Modal open={!!delaying} onClose={() => setDelaying(null)} title="Delay this patient & everyone after them" wide>
        {delaying && (
          <>
            <p className="text-sm text-[var(--color-ink-soft)] mb-4">
              <b className="text-[var(--color-ink)]">{delaying.patient?.name}</b> ({delaying.token}) is currently at{" "}
              {new Date(delaying.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. If the consultation runs late, this patient and all remaining patients today will be pushed forward by the same amount.
            </p>
            <Field label="Delay by">
              <Select value={delayMinutes} onChange={(e) => setDelayMinutes(Number(e.target.value))}>
                {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </Select>
            </Field>
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