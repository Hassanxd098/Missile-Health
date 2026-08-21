import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { Button, Field, inputClass, SkeletonCard, SectionTitle, MiniBarChart, DonutChart, EmptyState } from "../../components/ui";
import { IconDownload } from "../../components/Icons";
import { usePatient } from "../../context/PatientContext";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function Reports() {
  const { patient } = usePatient();
  const isSuperAdmin = patient?.role === "superadmin";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async (f = from, t = to) => {
    try { setData((await client.get(`/admin/reports?from=${f || ""}&to=${t || ""}`)).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load reports"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const exportCSV = () => {
    if (!data) return;
    const lines = [
      ["Type", "Count", "Total"],
      ...(data.revenueByType || []).map((r) => [r._id, r.count, r.total]),
      ["", "", ""],
      ["Top Doctors", "Visits", "Revenue"],
      ...(data.topDoctors || []).map((d) => [d.doctorName, d.visits, d.revenue]),
    ];
    const csv = lines.map((r) => r.map((c) => `"${c ?? ""}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) return <div className="grid md:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div>;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}

      <Card>
        <SectionTitle title="Report period"
          right={<div className="flex flex-wrap items-end gap-2"><Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} /></Field><Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} /></Field><Button onClick={() => load()} size="sm">Apply</Button><Button onClick={exportCSV} variant="ghost" size="sm"><IconDownload /> Export CSV</Button></div>} />
        <div className={`grid gap-4 ${isSuperAdmin ? "grid-cols-1" : "grid-cols-3"}`}>
          {!isSuperAdmin && <><div className="rounded-xl bg-[var(--color-surface-2)] p-4"><p className="text-xs text-[var(--color-ink-soft)]">Appointments in period</p><p className="text-3xl font-[var(--font-display)] text-[var(--color-ink)]">{data.appointments}</p></div>
          <div className="rounded-xl bg-[var(--color-surface-2)] p-4"><p className="text-xs text-[var(--color-ink-soft)]">Prescriptions</p><p className="text-3xl font-[var(--font-display)] text-[var(--color-ink)]">{data.prescriptions}</p></div></>}
          <div className="rounded-xl bg-[var(--color-surface-2)] p-4"><p className="text-xs text-[var(--color-ink-soft)]">Total revenue</p><p className="text-3xl font-[var(--font-display)] text-[var(--color-primary)]">{money(data.totalRevenue)}</p></div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle title="Revenue by type" />
          {(data.revenueByType || []).length
            ? <DonutChart data={(data.revenueByType || []).map((r) => ({ label: r._id, value: r.count }))} size={90} />
            : <EmptyState title="No revenue data" />}
        </Card>
        {!isSuperAdmin && <Card>
          <SectionTitle title="Patient growth (monthly)" />
          <MiniBarChart data={(data.patientGrowth || []).map((d) => ({ label: d._id.slice(2), value: d.count }))} height={170} />
        </Card>}
      </div>

      <Card>
        <SectionTitle title="Top doctors by revenue" />
        {(data.topDoctors || []).length ? (
          <div className="divide-y divide-[var(--color-line)]">
            {data.topDoctors.map((d, i) => (
              <div key={i} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--color-ink)]">{i + 1}. {d.doctorName}</span>
                <span className="text-sm text-[var(--color-ink-soft)]">{d.visits} visits · {money(d.revenue)}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No doctor revenue" />}
      </Card>
    </div>
  );
}
