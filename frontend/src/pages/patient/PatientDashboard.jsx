import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../../api/client";
import Card, { StatCard, StatusBadge, Button, EmptyState, SkeletonCard, SectionTitle, inputClass } from "../../components/ui";
import { IconCalendar, IconPill, IconWallet, IconUsers, IconClock, IconDownload, IconPlus } from "../../components/Icons";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = async () => {
    try { setData((await client.get("/patients/home")).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load dashboard"); }
  };
  useEffect(() => { load(); }, []);

  const timeline = useMemo(() => {
    const rows = [];
    (data?.prescriptions || []).forEach((p) => rows.push({ id: p._id, kind: "Prescription", date: p.createdAt, title: `Dr. ${p.doctor?.name}`, sub: p.diagnosis || p.medicines?.length + " medicines", rx: p }));
    (data?.invoices || []).forEach((i) => rows.push({ id: i._id, kind: "Bill", date: i.createdAt, title: i.invoiceNo, sub: `${i.type} · ${money(i.total)} · ${i.status}`, bill: i }));
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [data]);

  const filtered = useMemo(() => {
    if (!q) return timeline;
    const s = q.toLowerCase();
    return timeline.filter((r) => [r.title, r.sub, r.kind].join(" ").toLowerCase().includes(s));
  }, [timeline, q]);

  if (!data) return <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  const s = data.stats;
  const upcoming = data.upcoming;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-2xl px-4 py-3 font-medium border border-[var(--color-danger)]/20">{error}</p>}

      {/* Welcome + patient ID */}
      <Card className="relative overflow-hidden border-[var(--color-primary-soft)] p-6">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-[var(--color-primary-soft)] opacity-70 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-[var(--font-display)] text-2xl md:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">Welcome, {data.user?.name || "Patient"}</h1>
            <p className="text-xs sm:text-sm text-[var(--color-ink-soft)] font-medium">Patient ID: <span className="font-[var(--font-mono)] font-bold text-[var(--color-primary)]">{data.user?.patientId}</span></p>
            {upcoming ? (
              <div className="mt-3 p-3 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] inline-flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[var(--color-ink)] font-medium">
                <span>Upcoming appointment:</span>
                <b className="font-bold text-[var(--color-primary)]">{upcoming.doctor?.name}</b>
                <span>on</span>
                <span className="font-semibold">{new Date(upcoming.scheduledFor).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                <StatusBadge status={upcoming.status} />
              </div>
            ) : (
              <p className="text-xs text-[var(--color-ink-soft)] mt-2 font-medium">No upcoming appointments scheduled.</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={() => navigate("/app/patient/appointments")} icon={<IconPlus />}>Book appointment</Button>
          </div>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Doctor visits" value={s.doctorVisits} icon={<IconUsers className="text-xl" />} tint="primary" />
        <StatCard label="Prescriptions" value={s.prescriptions} icon={<IconPill className="text-xl" />} tint="violet" />
        <StatCard label="Pending payments" value={money(s.totalPending)} sub={`${s.pendingCount} bill${s.pendingCount === 1 ? "" : "s"} pending`} icon={<IconWallet className="text-xl" />} tint="warning" />
        <StatCard label="Completed payments" value={s.completedCount} icon={<IconCheck className="text-xl" />} tint="success" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Book appointment", to: "/app/patient/appointments", icon: IconCalendar },
          { label: "Download prescription", to: "/app/patient/prescriptions", icon: IconDownload },
          { label: "Pay bills", to: "/app/patient/bills", icon: IconWallet },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.label} to={a.to} className="group bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-4 flex items-center gap-3.5 hover:border-[var(--color-primary)] hover:shadow-md transition-all duration-200">
              <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] grid place-items-center shrink-0 group-hover:bg-[var(--color-primary)] group-hover:text-white transition-colors"><Icon className="text-xl" /></div>
              <span className="text-sm font-bold text-[var(--color-ink)] group-hover:text-[var(--color-primary)] transition-colors">{a.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Last consultation */}
      {data.lastConsultation && (
        <Card className="p-5">
          <SectionTitle title="Last consultation" subtitle="Most recent prescription issued to you" />
          <div className="flex flex-wrap items-center gap-3.5 p-3 rounded-2xl bg-[var(--color-surface-2)]/60 border border-[var(--color-line)]">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] grid place-items-center shrink-0"><IconDoctor className="text-xl" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-[var(--color-ink)]">{data.lastConsultation.doctor?.name || "Doctor"}</p>
              <p className="text-xs text-[var(--color-ink-soft)] font-medium mt-0.5">{new Date(data.lastConsultation.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            <Link to="/app/patient/prescriptions" className="text-xs font-bold text-[var(--color-primary)] hover:underline px-3 py-1.5 rounded-xl bg-[var(--color-primary-soft)]">View Details</Link>
          </div>
        </Card>
      )}

      {/* Care timeline with search */}
      <Card className="p-5">
        <SectionTitle
          title="Your care timeline"
          subtitle="Every consultation, prescription and bill in one place"
          right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search visits, bills, medicines…" className={`${inputClass} md:w-64`} />}
        />
        {filtered.length ? (
          <div className="divide-y divide-[var(--color-line)]">
            {filtered.slice(0, 12).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-2xl grid place-items-center shrink-0 ${r.kind === "Bill" ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" : "bg-[var(--color-success-soft)] text-[var(--color-success)]"}`}>
                    {r.kind === "Bill" ? <IconWallet className="text-lg" /> : <IconPill className="text-lg" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-[var(--color-ink)] truncate">{r.title}</span>
                      <StatusBadge status={r.bill?.status} />
                    </div>
                    <p className="text-xs text-[var(--color-ink-soft)] truncate font-medium mt-0.5">{r.sub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)] font-medium shrink-0">
                  <IconClock className="text-sm" /> {new Date(r.date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No records yet" hint="Your prescriptions and bills will appear here." />}
      </Card>
    </div>
  );
}

function IconCheck({ className }) {
  return <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 6 9 17l-5-5" /></svg>;
}
function IconDoctor({ className }) {
  return <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 9a7 7 0 0 0-14 0v6a7 7 0 0 0 14 0" /><path d="M15 16a7 7 0 0 1-7-7" /><path d="M9 12h2M13 12h2M11 10v2" /></svg>;
}