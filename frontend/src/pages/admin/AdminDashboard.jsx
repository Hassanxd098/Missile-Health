import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../api/client";
import Card, { StatCard, StatusBadge, SkeletonCard, SectionTitle, MiniBarChart } from "../../components/ui";
import { IconDoctor, IconUsers, IconPill, IconCalendar, IconWallet, IconShield, IconChart, IconActivity } from "../../components/Icons";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = async () => {
    try { setData((await client.get("/admin/home")).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load admin dashboard"); }
  };
  useEffect(() => { load(); }, []);

  if (!data) return <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  const c = data.counts;
  const revenueData = data.charts.revenue.map((d) => ({ label: d._id.slice(8), value: d.total }));
  const salesData = data.charts.medicineSales.map((d) => ({ label: d._id, value: d.units }));

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Doctors" value={c.doctors} icon={<IconDoctor className="text-xl" />} tint="primary" />
        <StatCard label="Patients" value={c.patients} icon={<IconUsers className="text-xl" />} tint="accent" />
        <StatCard label="Appointments" value={c.appointments} icon={<IconCalendar className="text-xl" />} tint="teal" />
        <StatCard label="Pharmacy staff" value={c.pharmacy} icon={<IconPill className="text-xl" />} tint="violet" />
        <StatCard label="Today's appointments" value={c.todayAppointments} icon={<IconActivity className="text-xl" />} tint="success" />
       <StatCard label="Revenue today" value={money(data.revenueToday)} icon={<IconWallet className="text-xl" />} tint="primary" />      </div>
      {/* <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Reception staff" value={c.reception} icon={<IconUsers className="text-xl" />} tint="teal" />
        <StatCard label="Nurses" value={c.nurses} icon={<IconActivity className="text-xl" />} tint="success" />
        <StatCard label="Security staff" value={c.security} icon={<IconShield className="text-xl" />} tint="warning" />
        <StatCard label="Management" value={c.management} icon={<IconChart className="text-xl" />} tint="violet" />
        <StatCard label="Pending bills" value={c.pendingBills} icon={<IconWallet className="text-xl" />} tint="warning" />
       
      </div> */}

      {/* <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        
      </div> */}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title="Revenue (30 days)" subtitle={`Total collected ${money(data.totalRevenue)}`} />
          <MiniBarChart data={revenueData} height={180} money />
        </Card>
        <Card>
          <SectionTitle title="Medicine sales" subtitle="Units dispensed (top 10)" />
          <MiniBarChart data={salesData} height={180} />
        </Card>
      </div>

      <Card>
        <SectionTitle title="Recent activity" right={<Link to="/app/admin/appointments" className="text-sm text-[var(--color-primary)] hover:underline">View all</Link>} />
        <div className="divide-y divide-[var(--color-line)]">
          {data.recent.map((a) => (
            <div key={a._id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-medium text-[var(--color-ink)]">{a.patient?.name}</span>
                <span className="text-[var(--color-ink-soft)]"> with {a.doctor?.name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={a.status} />
                <span className="text-xs text-[var(--color-ink-soft)]">{new Date(a.scheduledFor).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}