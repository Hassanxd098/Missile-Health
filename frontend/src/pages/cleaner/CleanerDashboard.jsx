import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { StatCard, StatusBadge, EmptyState, SkeletonCard, SectionTitle, inputClass } from "../../components/ui";
import { IconClock, IconCheck, IconCalendar } from "../../components/Icons";

const pad = (x) => String(x).padStart(2, "0");
const monthStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export default function CleanerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(monthStr());
  const load = async () => {
    try { setData((await client.get(`/auth/cleaner/attendance?month=${month}`)).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load attendance"); }
  };
  useEffect(() => { load(); }, [month]);
  if (!data) return <div className="grid md:grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Present days" value={data.present} icon={<IconCheck className="text-xl" />} tint="success" />
        <StatCard label="Total days logged" value={data.total} icon={<IconCalendar className="text-xl" />} tint="primary" />
        <StatCard label="This month" value={data.month?.split("-").join("-")} icon={<IconClock className="text-xl" />} tint="teal" />
      </div>
      <Card>
        <SectionTitle title="My attendance" subtitle="Recorded by the reception desk. Biometric sync arrives later." right={<input type="month" value={month} max={monthStr()} onChange={(e) => setMonth(e.target.value)} className={`${inputClass} w-44`} />} />
        {data.records.length ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.records.map((r) => (
              <div key={r._id} className="border border-[var(--color-line)] rounded-xl p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--color-ink)] text-sm">{new Date(r.date + "T00:00:00").toLocaleDateString()}</p>
                  <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">{r.checkIn ? `In ${r.checkIn}` : "—"}{r.checkOut ? ` · Out ${r.checkOut}` : ""}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        ) : <EmptyState title="No records this month" hint="Your attendance appears here once the reception desk marks you present." />}
      </Card>
    </div>
  );
}