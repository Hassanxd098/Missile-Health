import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import Card, { Button, inputClass } from "../components/ui";
import client from "../api/client";

export default function SymptomDiscovery() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function analyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.post("/symptoms/analyze", { text, lat: 11.664, lng: 78.146 });
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.error || "Please complete onboarding first.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Symptom Analysis & Specialist Discovery" subtitle="Module 2 — describe symptoms, get routed to the right doctor" />
      <div className="flex-1 p-8 max-w-3xl space-y-6">
        <Card>
          <label className="block text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Describe how you're feeling</label>
          <textarea
            className={`${inputClass} min-h-[100px]`}
            placeholder="e.g. I've had a fever and cough for two days"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end mt-4">
            <Button onClick={analyze} disabled={loading}>{loading ? "Analysing…" : "Analyse symptoms"}</Button>
          </div>
        </Card>

        {error && (
          <Card className="border-[var(--color-danger)]">
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          </Card>
        )}

        {result?.emergency && (
          <Card className="border-[var(--color-danger)] bg-[var(--color-danger-soft)]">
            <p className="text-sm font-medium text-[var(--color-danger)]">{result.message}</p>
          </Card>
        )}

        {result && !result.emergency && (
          <div className="space-y-4">
            <Card className="bg-[var(--color-primary-soft)] border-none">
              <p className="text-sm">
                Suggested: <strong>{result.specialty}</strong> · confidence {(result.confidence * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-[var(--color-ink-soft)] mt-1">{result.disclaimer}</p>
              {result.broadenedSearch && (
                <p className="text-xs text-[var(--color-warning)] mt-2">No nearby match — search radius was broadened.</p>
              )}
            </Card>

            <div className="grid gap-3">
              {result.doctors.map((d) => (
                <Card key={d.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{d.name}</div>
                    <div className="text-xs text-[var(--color-ink-soft)]">{d.specialty} · {d.distanceKm} km away · ★ {d.rating}</div>
                    <div className="text-xs text-[var(--color-primary)] mt-1">Next available: {d.nextAvailable}</div>
                  </div>
                  <Button onClick={() => navigate(`/appointments?doctorId=${d.id}`)}>Book →</Button>
                </Card>
              ))}
              {result.doctors.length === 0 && (
                <Card><p className="text-sm text-[var(--color-ink-soft)]">No specialists available right now.</p></Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
