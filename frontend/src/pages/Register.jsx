import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import { usePatient } from "../context/PatientContext";
import Card, { Button, Field, inputClass } from "../components/ui";
import { IconHeart } from "../components/Icons";

export default function Register() {
  const { login } = usePatient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", mobile: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const field = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await client.post("/auth/register", form);
      login(data, { remember: false });
      navigate("/app/patient/profile", { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || "Unable to register. Please try again.";
      setError(msg);
      if (err.response?.data?.alreadyPatient) {
        setTimeout(() => navigate("/login", { replace: true }), 1600);
      }
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
      <Card className="w-full max-w-md animate-fade-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-[var(--color-primary-soft)] grid place-items-center text-[var(--color-primary)]"><IconHeart className="text-2xl" /></div>
          <div>
            <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Patient registration</h1>
            <p className="text-sm text-[var(--color-ink-soft)]">Register once — we generate your Patient ID</p>
          </div>
        </div>

        <p className="text-xs text-[var(--color-ink-soft)] bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-xl px-3 py-2 mb-4 mt-3">
          A unique Patient ID is generated automatically from your mobile number (e.g. PAT-2498765432-001) — you'll use it to log in instead of your mobile. You choose the hospital when you book an appointment.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name">
            <input required className={inputClass} value={form.name} onChange={field("name")} placeholder="As per government ID" autoComplete="name" />
          </Field>

          <Field label="Mobile number" hint="This is your login ID and cannot be registered twice.">
            <input required type="tel" pattern="[0-9+0-9 ()-]{10,15}" className={inputClass} value={form.mobile} onChange={field("mobile")} placeholder="e.g. 9876543210" autoComplete="tel" />
          </Field>

          <Field label="Email (optional)">
            <input type="email" className={inputClass} value={form.email} onChange={field("email")} placeholder="you@example.com" autoComplete="email" />
          </Field>

          <Field label="Password" hint="At least 8 characters">
            <input required minLength="8" type="password" className={inputClass} value={form.password} onChange={field("password")} placeholder="••••••••" autoComplete="new-password" />
          </Field>

          {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}

          <Button type="submit" size="lg" className="w-full justify-center" disabled={loading}>
            {loading ? "Creating your account…" : "Register as patient"}
          </Button>
        </form>

        <p className="text-sm text-[var(--color-ink-soft)] mt-5 text-center">
          Already registered? <Link to="/login" className="text-[var(--color-primary)] font-medium hover:underline">Sign in</Link>
        </p>
      </Card>
    </main>
  );
}
