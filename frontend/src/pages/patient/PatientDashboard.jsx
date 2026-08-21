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
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}

      {/* Welcome + patient ID */}
      <Card className="relative overflow-hidden border-[var(--color-primary-soft)]">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-[var(--color-primary-soft)] opacity-70" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">Hello, {data.user?.name || "Patient"}</h1>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1">Patient ID <span className="font-[var(--font-mono)] text-[var(--color-primary)]">{data.user?.patientId}</span></p>
            {upcoming ? (
              <p className="text-sm mt-3 text-[var(--color-ink)]">
                Upcoming appointment: <b>{upcoming.doctor?.name}</b> on {new Date(upcoming.scheduledFor).toLocaleString()} <StatusBadge status={upcoming.status} className="ml-2" />
              </p>
            ) : (
              <p className="text-sm mt-3 text-[var(--color-ink-soft)]">No upcoming appointments.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/app/patient/appointments")}><IconPlus /> Book appointment</Button>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Book appointment", to: "/app/patient/appointments", icon: IconCalendar },
          { label: "Download prescription", to: "/app/patient/prescriptions", icon: IconDownload },
          { label: "Pay bills", to: "/app/patient/bills", icon: IconWallet },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.label} to={a.to} className="group bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-4 flex flex-col items-start gap-3 hover:border-[var(--color-primary)] transition-colors">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] grid place-items-center group-hover:bg-[var(--color-primary)] group-hover:text-white transition-colors"><Icon /></div>
              <span className="text-sm font-medium text-[var(--color-ink)]">{a.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Last consultation */}
      {data.lastConsultation && (
        <Card>
          <SectionTitle title="Last consultation" subtitle="Most recent prescription issued to you" />
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] grid place-items-center"><IconDoctor className="text-lg" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--color-ink)]">{data.lastConsultation.doctor?.name || "Doctor"}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">{new Date(data.lastConsultation.createdAt).toLocaleString()}</p>
            </div>
            <Link to="/app/patient/prescriptions" className="text-sm text-[var(--color-primary)] hover:underline">View</Link>
          </div>
        </Card>
      )}

      {/* Care timeline with search */}
      <Card>
        <SectionTitle
          title="Your care timeline"
          subtitle="Every consultation, prescription and bill in one place"
          right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search visits, bills, medicines…" className={`${inputClass} md:w-64`} />}
        />
        {filtered.length ? (
          <div className="space-y-0">
            {filtered.slice(0, 12).map((r) => (
              <div key={r.id} className="flex items-start gap-4 py-3 border-b border-[var(--color-line)] last:border-0">
                <div className={`mt-1 w-9 h-9 rounded-xl grid place-items-center ${r.kind === "Bill" ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" : "bg-[var(--color-success-soft)] text-[var(--color-success)]"}`}>
                  {r.kind === "Bill" ? <IconWallet className="text-base" /> : <IconPill className="text-base" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--color-ink)]">{r.title}</span>
                    <StatusBadge status={r.bill?.status} />
                  </div>
                  <p className="text-sm text-[var(--color-ink-soft)] truncate">{r.sub}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)] shrink-0">
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