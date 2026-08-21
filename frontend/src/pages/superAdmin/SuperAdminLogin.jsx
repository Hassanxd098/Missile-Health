import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../../api/client";
import { usePatient } from "../../context/PatientContext";
import Card, { Button, Field, inputClass } from "../../components/ui";
import { IconShield, IconHospital, IconChart, IconEye, IconEyeOff } from "../../components/Icons";

export default function SuperAdminLogin() {
  const { login } = usePatient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const field = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await client.post("/super-admin/login", form);
      login({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user }, {});
      navigate("/super-admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Unable to sign in. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen flex bg-[var(--color-bg)]">
      {/* ---------- Left: platform-scoped panel, deliberately distinct from hospital login ---------- */}
      <section className="hidden lg:flex relative w-[46%] overflow-hidden flex-col justify-between px-14 py-14 text-white bg-gradient-to-br from-[#100C2B] via-[#241D4A] to-[var(--color-violet)]">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
          <svg viewBox="0 0 200 200" className="w-full h-full" preserveAspectRatio="none">
            <circle cx="10" cy="190" r="46" fill="white" /><circle cx="190" cy="10" r="34" fill="white" />
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/12 grid place-items-center backdrop-blur border border-white/20"><IconShield className="text-2xl text-white" /></div>
            <div>
              <h1 className="font-[var(--font-display)] text-2xl font-semibold">Missile Health</h1>
              <p className="text-white/60 text-sm">Platform Control Center</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-sm">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/60 mb-4">
            <IconShield className="text-sm" /> Super Admin
          </span>
          <h2 className="font-[var(--font-display)] text-3xl leading-tight">Manage every hospital on the platform, from one place.</h2>
          <p className="text-white/70 mt-4 text-[15px] leading-relaxed">
            Create tenants, monitor platform-wide growth, and keep every hospital's
            data cleanly isolated from the rest.
          </p>

          <div className="mt-8 grid gap-3">
            <div className="glass-card !bg-white/8 !border-white/12">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/12 grid place-items-center"><IconHospital /></div>
                <div>
                  <p className="text-sm font-medium">Multi-hospital oversight</p>
                  <p className="text-xs text-white/65">Onboard, activate, or pause hospitals in seconds.</p>
                </div>
              </div>
            </div>
            <div className="glass-card !bg-white/8 !border-white/12">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/12 grid place-items-center"><IconChart /></div>
                <div>
                  <p className="text-sm font-medium">Platform analytics</p>
                  <p className="text-xs text-white/65">Growth, revenue, and utilization across every tenant.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-white/45 text-xs">Platform-level credentials only &middot; not for hospital staff</p>
      </section>

      {/* ---------- Right: login card ---------- */}
      <section className="flex-1 flex items-center justify-center p-6 min-h-screen">
        <Card className="w-full max-w-md animate-fade-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-[var(--color-violet-soft)] grid place-items-center text-[var(--color-violet)]"><IconShield className="text-2xl" /></div>
            <div>
              <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Super Admin Login</h1>
              <p className="text-sm text-[var(--color-ink-soft)]">Platform-level access &mdash; manage hospitals and tenant accounts</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4 mt-5">
            <Field label="Email address">
              <input required type="email" className={inputClass} value={form.email} onChange={field("email")} placeholder="you@missile.health" autoComplete="username" />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input required type={showPassword ? "text" : "password"} className={`${inputClass} pr-11`} value={form.password} onChange={field("password")} placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-soft)] hover:text-[var(--color-violet)] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <IconEyeOff className="text-base" /> : <IconEye className="text-base" />}
                </button>
              </div>
            </Field>

            {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2 animate-fade-in">{error}</p>}

            <Button type="submit" size="lg" className="w-full justify-center bg-[var(--color-violet)] hover:brightness-95 shadow-[0_8px_20px_-6px_var(--color-violet)]" disabled={loading}>
              {loading ? "Signing in\u2026" : "Sign in as Super Admin"}
            </Button>
          </form>

          <p className="text-sm text-[var(--color-ink-soft)] mt-5 text-center">
            Hospital staff? <Link to="/login" className="text-[var(--color-primary)] font-medium hover:underline">Back to hospital login</Link>
          </p>
        </Card>
      </section>
    </main>
  );
}
