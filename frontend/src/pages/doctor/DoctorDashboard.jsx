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
  const [delayTime, setDelayTime] = useState("");
  const [delayingBusy, setDelayingBusy] = useState(false);
  const [reschedulingAppt, setReschedulingAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [reschedulingBusy, setReschedulingBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingPatientAppt, setViewingPatientAppt] = useState(null);

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
  const compactWorkingHours = (hoursText) => {
    if (!hoursText) return "";
    const text = String(hoursText || "");
    if (text.includes("–") || text.includes("Daily") || text.includes("Mon–Sat")) return text;
    const parts = text.split(/,\s*/);
    if (parts.length > 2) {
      const daysMap = {};
      parts.forEach((p) => {
        const match = p.match(/^([A-Za-z]{3})\s+(.*)$/);
        if (match) {
          const d = match[1];
          const t = match[2];
          if (!daysMap[t]) daysMap[t] = [];
          daysMap[t].push(d);
        }
      });
      if (Object.keys(daysMap).length > 0) {
        return Object.entries(daysMap)
          .map(([t, ds]) => {
            const range = ds.length === 7 ? "Daily" : ds.length > 2 ? `${ds[0]}–${ds[ds.length - 1]}` : ds.join(", ");
            return `${range} ${t}`;
          })
          .join("; ");
      }
    }
    return text;
  };

  const summary = () => {
    if (!slots || !slots.length) return "";
    const raw = slots.map((sv) => `${DAYS_SHORT[sv.day] || "?"} ${fmtRange(sv.start)}-${fmtRange(sv.end)}`).join(", ");
    return compactWorkingHours(raw);
  };
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

  const openDelayModal = (appt) => {
    const d = new Date(appt.scheduledFor);
    const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    setDelayTime(timeStr);
    setDelaying(appt);
  };

  const confirmDelay = async () => {
    if (!delaying || delayingBusy || !delayTime) return;
    setDelayingBusy(true);
    try {
      const { data: resData } = await client.post(`/doctor/appointments/${delaying._id}/delay`, { newTime: delayTime });
      const mins = resData.diffMinutes || 0;
      const label = mins > 0 ? `Delayed by +${mins} mins` : `Advanced queue by ${mins} mins`;
      toast(`Queue schedule updated! (${label}) — ${resData.shifted} patient(s) shifted.`, "success");
      setDelaying(null);
      load(true);
    } catch (e) { toast(e.response?.data?.error || "Could not update queue schedule", "error"); }
    finally { setDelayingBusy(false); }
  };

  const openRescheduleDateModal = (appt) => {
    const d = new Date(appt.scheduledFor);
    const dateStr = d.toISOString().slice(0, 10);
    const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    setRescheduleDate(dateStr);
    setRescheduleTime(timeStr);
    setReschedulingAppt(appt);
  };

  const confirmRescheduleDate = async () => {
    if (!reschedulingAppt || reschedulingBusy || !rescheduleDate || !rescheduleTime) return;
    setReschedulingBusy(true);
    try {
      const { data: resData } = await client.post(`/doctor/appointments/${reschedulingAppt._id}/reschedule`, {
        date: rescheduleDate,
        time: rescheduleTime,
      });
      toast(`Appointment for ${reschedulingAppt.patient?.name || "patient"} rescheduled to ${new Date(resData.scheduledFor).toLocaleString()}!`, "success");
      setReschedulingAppt(null);
      load(true);
    } catch (e) { toast(e.response?.data?.error || "Could not reschedule appointment", "error"); }
    finally { setReschedulingBusy(false); }
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
            <p className="text-xs text-[var(--color-primary)] mt-1 font-semibold">{profile?.visitingHours ? `Working hours: ${compactWorkingHours(profile.visitingHours)}` : "Set your working hours so patients can book."}</p>
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
                const handleRowClick = () => {
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
                      <Button size="sm" variant="secondary" onClick={() => setViewingPatientAppt(a)}>
                        Patient Details
                      </Button>
                      {["confirmed", "in-progress", "requested"].includes(a.status) && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openDelayModal(a)} title="Shift queue starting from this patient onwards">
                            ⏰ Shift Queue
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openRescheduleDateModal(a)} className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40">
                            📅 Reschedule Date
                          </Button>
                        </>
                      )}
                      {a.status === "confirmed" && (
                        <Button size="sm" onClick={() => navigate(`/app/doctor/consult/${a._id}`)} className="shadow-md shadow-blue-500/20">
                          Start Consult
                        </Button>
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

      {/* Patient Medical Details Modal */}
      <Modal open={!!viewingPatientAppt} onClose={() => setViewingPatientAppt(null)} title="Patient Medical & Intake Details" wide>
        {viewingPatientAppt && (() => {
          const pt = viewingPatientAppt.patient || {};
          const med = pt.patient || {};
          const prof = pt.profile || {};
          const emg = pt.emergencyContact || {};
          const ins = pt.insurance || {};

          return (
            <div className="space-y-5">
              {/* Header Patient Info */}
              <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-[var(--color-ink)]">{pt.name || "Patient"}</h3>
                    <span className="font-[var(--font-mono)] text-xs text-[var(--color-primary)] font-bold bg-[var(--color-primary-soft)] px-2.5 py-0.5 rounded-full">
                      {pt.patientId || "PAT-—"}
                    </span>
                    <StatusBadge status={viewingPatientAppt.status} />
                  </div>
                  <p className="text-xs text-[var(--color-ink-soft)] mt-1">
                    {prof.age ? `${prof.age} yrs` : ""} {prof.gender ? `· ${prof.gender}` : ""} {pt.mobile ? `· 📞 ${pt.mobile}` : ""} {pt.email ? `· ✉️ ${pt.email}` : ""}
                  </p>
                  {prof.address && <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">📍 {prof.address}</p>}
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                    Token {viewingPatientAppt.token || "—"}
                  </span>
                  <p className="text-xs text-[var(--color-ink-soft)] mt-1">
                    Scheduled: {new Date(viewingPatientAppt.scheduledFor).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Reason for Visit & Symptoms */}
              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Chief Complaint & Symptoms Filled by Patient</p>
                <p className="text-sm font-semibold text-[var(--color-ink)]">
                  {viewingPatientAppt.reason || viewingPatientAppt.complaint || "No specific reason provided during booking."}
                </p>
                {viewingPatientAppt.symptoms && viewingPatientAppt.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {viewingPatientAppt.symptoms.map((s, idx) => (
                      <span key={idx} className="text-xs bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 px-2.5 py-0.5 rounded-full font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Vitals Grid */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-soft)] mb-2">Vitals & Health Metrics</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    ["Blood Group", med.bloodGroup || prof.bloodGroup || "—"],
                    ["Blood Pressure", med.bloodPressure || prof.bloodPressure || "—"],
                    ["Sugar Level", med.sugarLevel || prof.sugarLevel || "—"],
                    ["Pulse Rate", med.pulse || "—"],
                    ["Temperature", med.temperature || "—"],
                    ["O2 Saturation", med.oxygenLevel || "—"],
                    ["Height", med.heightCm || prof.heightCm ? `${med.heightCm || prof.heightCm} cm` : "—"],
                    ["Weight", med.weightKg || prof.weightKg ? `${med.weightKg || prof.weightKg} kg` : "—"],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="bg-[var(--color-surface-2)] p-2.5 rounded-xl border border-[var(--color-line)]">
                      <p className="text-[11px] text-[var(--color-ink-soft)] font-medium">{lbl}</p>
                      <p className="text-xs font-semibold text-[var(--color-ink)] mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Medical History & Conditions */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-soft)] mb-2">Medical Profile & History</p>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-[var(--color-surface-2)] p-3 rounded-xl border border-[var(--color-line)] space-y-1">
                    <p className="font-semibold text-[var(--color-ink)] text-xs">⚠️ Allergies</p>
                    <p className="text-[var(--color-ink-soft)]">{med.allergies || "None declared"}</p>
                  </div>
                  <div className="bg-[var(--color-surface-2)] p-3 rounded-xl border border-[var(--color-line)] space-y-1">
                    <p className="font-semibold text-[var(--color-ink)] text-xs">💊 Current Medicines</p>
                    <p className="text-[var(--color-ink-soft)]">{med.currentMedicines || "None declared"}</p>
                  </div>
                  <div className="bg-[var(--color-surface-2)] p-3 rounded-xl border border-[var(--color-line)] space-y-1">
                    <p className="font-semibold text-[var(--color-ink)] text-xs">🏥 Existing Diseases / Conditions</p>
                    <p className="text-[var(--color-ink-soft)]">{med.existingDiseases || "None declared"}</p>
                  </div>
                  <div className="bg-[var(--color-surface-2)] p-3 rounded-xl border border-[var(--color-line)] space-y-1">
                    <p className="font-semibold text-[var(--color-ink)] text-xs">📜 Past Medical History</p>
                    <p className="text-[var(--color-ink-soft)]">{med.medicalHistory || med.previousDiseases || "None declared"}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact & Insurance */}
              {(emg.name || ins.provider) && (
                <div className="grid sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-[var(--color-line)]">
                  {emg.name && (
                    <div>
                      <p className="font-semibold text-[var(--color-ink)] mb-0.5">Emergency Contact</p>
                      <p className="text-[var(--color-ink-soft)]">{emg.name} ({emg.relation || "Contact"}) · {emg.phone || "—"}</p>
                    </div>
                  )}
                  {ins.provider && (
                    <div>
                      <p className="font-semibold text-[var(--color-ink)] mb-0.5">Insurance</p>
                      <p className="text-[var(--color-ink-soft)]">{ins.provider} · Policy #{ins.policyNumber || "—"}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex justify-end gap-2 border-t border-[var(--color-line)] pt-4">
                <Button variant="ghost" onClick={() => setViewingPatientAppt(null)}>Close</Button>
                <Button onClick={() => { setViewingPatientAppt(null); navigate(`/app/doctor/consult/${viewingPatientAppt._id}`); }}>
                  Start Consultation →
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Shift Queue Time Modal (From selected patient onwards) */}
      <Modal open={!!delaying} onClose={() => setDelaying(null)} title="Shift Queue Schedule (Selected Patient Onwards)" wide>
        {delaying && (
          <div className="space-y-4">
            {/* Scope Explanation Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <p className="font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                <span>📍 Shift Pivot Patient:</span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">{delaying.patient?.name} ({delaying.token})</span>
              </p>
              <p className="text-[var(--color-ink-soft)]">
                Currently scheduled at: <span className="font-mono font-bold text-[var(--color-primary)]">{new Date(delaying.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>.
                Shifting this appointment will delay/move <b>this patient and ALL patients scheduled AFTER this time today</b>. Patients scheduled before this time remain unaffected.
              </p>
            </div>

            {/* Quick Offset Chips */}
            <div>
              <p className="text-xs font-semibold text-[var(--color-ink-soft)] mb-2">Quick Shift Offsets:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "+15m", mins: 15 },
                  { label: "+30m", mins: 30 },
                  { label: "+45m", mins: 45 },
                  { label: "+1 Hour (+60m)", mins: 60 },
                  { label: "+1.5 Hours (+90m)", mins: 90 },
                  { label: "+2 Hours (+120m)", mins: 120 },
                ].map((chip) => (
                  <button
                    key={chip.mins}
                    type="button"
                    onClick={() => {
                      const d = new Date(delaying.scheduledFor);
                      d.setMinutes(d.getMinutes() + chip.mins);
                      setDelayTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl transition-all border border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-ink)] hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-800 cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <Field label="New Appointment Time for Selected Patient">
              <input
                type="time"
                value={delayTime}
                onChange={(e) => setDelayTime(e.target.value)}
                className="w-full px-4 py-3 text-lg font-bold rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)] font-mono cursor-pointer shadow-sm"
              />
            </Field>

            {/* Live Visual Difference Summary Breakdown Card */}
            {(() => {
              if (!delayTime) return null;
              const curDate = new Date(delaying.scheduledFor);
              const [h, m] = delayTime.split(":").map(Number);
              const newDate = new Date(curDate);
              newDate.setHours(h, m, 0, 0);
              const diffMins = Math.round((newDate.getTime() - curDate.getTime()) / 60000);
              const absMins = Math.abs(diffMins);
              const hoursText = absMins >= 60 ? `${(absMins / 60).toFixed(1).replace(".0", "")} hr${absMins >= 120 ? "s" : ""}` : `${absMins} mins`;

              if (diffMins === 0) return <p className="text-xs text-[var(--color-ink-soft)] font-medium">Selected time matches current appointment time.</p>;

              return (
                <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  diffMins > 0 ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200" : "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200"
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 dark:border-white/10 pb-2">
                    <span className="font-bold text-sm">
                      {diffMins > 0 ? `⏩ Shift Summary: +${hoursText} (+${diffMins} mins delay)` : `⏪ Shift Summary: -${hoursText} (-${Math.abs(diffMins)} mins advance)`}
                    </span>
                    <span className="font-mono font-bold bg-white/60 dark:bg-black/40 px-2.5 py-1 rounded-lg">
                      {curDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ➔ {newDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] leading-relaxed opacity-90">
                    <p>• <b>Pivot Patient ({delaying.patient?.name}):</b> Moved from {curDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} to {newDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</p>
                    <p>• <b>Subsequent Queue:</b> ALL patients scheduled from {curDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} onwards today will automatically be shifted by {diffMins > 0 ? `+${hoursText}` : `-${hoursText}`}.</p>
                    <p>• <b>Previous Patients:</b> Patients scheduled before {curDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} remain unchanged.</p>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 border-t border-[var(--color-line)] pt-4 mt-4">
              <Button variant="ghost" onClick={() => setDelaying(null)}>
                Cancel
              </Button>
              <Button onClick={confirmDelay} disabled={delayingBusy}>
                {delayingBusy ? "Shifting Queue…" : "Confirm & Shift Queue"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reschedule Patient to Another Day Modal */}
      <Modal open={!!reschedulingAppt} onClose={() => setReschedulingAppt(null)} title="Reschedule Patient to Another Day" wide>
        {reschedulingAppt && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-ink-soft)]">
              Rescheduling appointment for <b className="text-[var(--color-ink)]">{reschedulingAppt.patient?.name}</b> ({reschedulingAppt.token}).
              Currently scheduled:{" "}
              <span className="font-bold text-[var(--color-primary)] font-mono">
                {new Date(reschedulingAppt.scheduledFor).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="New Appointment Date">
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-4 py-3 text-base font-bold rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)] font-mono cursor-pointer shadow-sm"
                />
              </Field>

              <Field label="New Appointment Time">
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full px-4 py-3 text-base font-bold rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-primary)] font-mono cursor-pointer shadow-sm"
                />
              </Field>
            </div>

            {rescheduleDate && rescheduleTime && (
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center justify-between flex-wrap gap-2">
                <span>📅 Target Appointment Date & Time:</span>
                <span className="font-mono font-bold text-sm">
                  {new Date(`${rescheduleDate}T${rescheduleTime}`).toLocaleString([], { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--color-line)] pt-4 mt-4">
              <Button variant="ghost" onClick={() => setReschedulingAppt(null)}>
                Cancel
              </Button>
              <Button onClick={confirmRescheduleDate} disabled={reschedulingBusy}>
                {reschedulingBusy ? "Rescheduling…" : "Confirm New Date & Time"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}