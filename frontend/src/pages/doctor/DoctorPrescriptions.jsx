import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { StatusBadge, EmptyState, SkeletonCard, SectionTitle } from "../../components/ui";

export default function DoctorPrescriptions() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = async () => {
    try { setData((await client.get("/doctor/prescriptions")).data); }
    catch (e) { setError(e.response?.data?.error || "Unable to load prescriptions"); }
  };
  useEffect(() => { load(); }, []);

  if (!data) return <Card><SkeletonCard /></Card>;
  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}
      <Card>
        <SectionTitle title="My prescriptions" subtitle="Prescriptions you have issued" />
        {data.prescriptions.length ? (
          <div className="divide-y divide-[var(--color-line)]">
            {data.prescriptions.map((p) => (
              <div key={p._id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--color-ink)]">{p.patient?.name}</span>
                    <span className="text-xs font-[var(--font-mono)] text-[var(--color-ink-soft)]">{p.patient?.patientId}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-sm text-[var(--color-ink-soft)] truncate">{p.diagnosis || "Consultation"} · {p.medicines?.length || 0} medicines</p>
                </div>
                <span className="text-xs text-[var(--color-ink-soft)] shrink-0">{p.prescriptionId} · {new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No prescriptions yet" hint="Issued prescriptions will appear here." />}
      </Card>
    </div>
  );
}