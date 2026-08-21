import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import Card, { Button, Field, inputClass } from "../components/ui";
import client from "../api/client";

export default function Wellness() {
  const [bmi, setBmi] = useState(24);
  const [conditions, setConditions] = useState("");
  const [result, setResult] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const { data } = await client.get("/wellness/mine");
      setPlans(data);
    } catch { /* not onboarded */ }
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    setError(null);
    try {
      const conditionList = conditions.split(",").map((c) => c.trim()).filter(Boolean);
      const { data } = await client.post("/wellness/generate", { bmi: Number(bmi), conditions: conditionList });
      setResult(data);
      load();
    } catch (e) { setError(e.response?.data?.error || "Please complete onboarding first."); }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="AI Personal Hygiene & Diet Coaching" subtitle="Module 8 — proactive wellness guidance from your health profile" />
      <div className="flex-1 p-8 max-w-2xl space-y-6">
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <Field label="BMI">
              <input type="number" className={inputClass} value={bmi} onChange={(e) => setBmi(e.target.value)} />
            </Field>
            <Field label="Known conditions (comma-separated, optional)">
              <input className={inputClass} placeholder="e.g. diabetic" value={conditions} onChange={(e) => setConditions(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={generate}>Generate my plan</Button>
          </div>
          {error && <p className="text-sm text-[var(--color-danger)] mt-2">{error}</p>}
        </Card>

        {result && (
          <Card className={result.flaggedForReview ? "border-[var(--color-warning)] bg-[var(--color-warning-soft)]" : "bg-[var(--color-primary-soft)] border-none"}>
            {result.flaggedForReview ? (
              <p className="text-sm text-[var(--color-warning)]">{result.note}</p>
            ) : (
              <>
                <p className="text-sm font-medium mb-1 capitalize">{result.category} — plan generated</p>
                <p className="text-sm">{result.plan}</p>
                <p className="text-xs text-[var(--color-ink-soft)] mt-2">{result.disclaimer}</p>
              </>
            )}
          </Card>
        )}

        <div>
          <h3 className="font-[var(--font-display)] text-lg mb-3">Your plan history</h3>
          <div className="grid gap-3">
            {plans.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-[var(--font-mono)] text-[var(--color-ink-soft)]">BMI {p.bmi}</span>
                  <span className="text-xs text-[var(--color-ink-soft)]">reminders: {p.reminderFrequency}</span>
                </div>
                <p className="text-sm">{p.flaggedForReview ? "Flagged for dietitian/doctor review." : p.plan}</p>
              </Card>
            ))}
            {plans.length === 0 && <Card><p className="text-sm text-[var(--color-ink-soft)]">No plans generated yet.</p></Card>}
          </div>
        </div>
      </div>
    </div>
  );
}
