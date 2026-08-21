import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import Card from "../components/ui";
import { Button, Field, inputClass } from "../components/ui";
import { usePatient } from "../context/PatientContext";
import client from "../api/client";

const STEPS = [
  { field: "name", question: "What's your full name?", placeholder: "e.g. Ravi Kumar" },
  { field: "sex", question: "What's your sex?", type: "select", options: ["male", "female", "other"] },
  { field: "dob", question: "What's your date of birth?", type: "date" },
  { field: "abhaNumber", question: "What's your ABHA number? (optional — 14 digits)", placeholder: "12345678901234", optional: true },
  { field: "address", question: "What's your address?", placeholder: "House no., street, city" },
];

export default function Onboarding() {
  const { login, patient } = usePatient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const current = STEPS[step];

  async function handleNext() {
    const value = answers[current.field] || "";
    if (!current.optional || value) {
      const { data } = await client.post("/onboarding/validate-field", { field: current.field, value });
      if (!data.valid) return setError(data.message);
    }
    setError(null);
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleSubmit();
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await client.post("/onboarding/complete", answers);
      setResult(data);
      login(data.patient);
    } catch (e) {
      setError(e.response?.data?.error || "Something went wrong. Please try again.");
      if (e.response?.data?.details) {
        const firstBadField = Object.keys(e.response.data.details)[0];
        const idx = STEPS.findIndex((s) => s.field === firstBadField);
        if (idx >= 0) setStep(idx);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="AI-Assisted Onboarding" subtitle="Module 1 — a conversation instead of a form" />
      <div className="flex-1 p-8 max-w-2xl">
        {patient && !result && (
          <Card className="mb-6 border-[var(--color-primary)]">
            <p className="text-sm">
              You're already onboarded as <strong>{patient.name}</strong>. Head to{" "}
              <button onClick={() => navigate("/symptoms")} className="text-[var(--color-primary)] underline">
                Symptom Discovery
              </button>{" "}
              to continue the journey, or complete onboarding again to create a new demo patient.
            </p>
          </Card>
        )}

        {result ? (
          <Card>
            <h3 className="font-[var(--font-display)] text-lg text-[var(--color-primary-dark)] mb-2">Welcome, {result.patient.name}.</h3>
            <p className="text-sm text-[var(--color-ink-soft)] mb-4">{result.message}</p>
            <div className="flex items-center gap-2 text-xs font-[var(--font-mono)] text-[var(--color-ink-soft)] mb-6">
              Patient ID: {result.patient.id} · ABHA: {result.patient.abha.status}
            </div>
            <Button onClick={() => navigate("/symptoms")}>Continue to Symptom Discovery →</Button>
          </Card>
        ) : (
          <Card>
            <div className="flex gap-1.5 mb-6">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-[var(--color-primary)]" : "bg-[var(--color-line)]"}`} />
              ))}
            </div>
            <div className="flex items-start gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary-soft)] flex items-center justify-center shrink-0 text-[var(--color-primary-dark)] text-sm font-semibold">AI</div>
              <div className="bg-[var(--color-bg)] rounded-xl rounded-tl-sm px-4 py-3 text-sm">{current.question}</div>
            </div>

            <Field label={current.field}>
              {current.type === "select" ? (
                <select
                  className={inputClass}
                  value={answers[current.field] || ""}
                  onChange={(e) => setAnswers({ ...answers, [current.field]: e.target.value })}
                >
                  <option value="" disabled>Choose one</option>
                  {current.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  className={inputClass}
                  type={current.type || "text"}
                  placeholder={current.placeholder}
                  value={answers[current.field] || ""}
                  onChange={(e) => setAnswers({ ...answers, [current.field]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleNext()}
                />
              )}
            </Field>

            {error && <p className="text-sm text-[var(--color-danger)] mt-3">{error}</p>}

            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Back</Button>
              <Button onClick={handleNext} disabled={submitting}>
                {submitting ? "Creating profile…" : step === STEPS.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
