import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { loginUser } from "../store/slices/authSlice";
import Card, { Button, Field, inputClass } from "../components/ui";
import { IconHeart, IconShield, IconDoctor, IconUsers, IconDroplet, IconWalk, IconMoonStars, IconActivity, IconEye, IconEyeOff, IconSparkle } from "../components/Icons";

const ROLES = [
  { key: "patient", label: "Patient", icon: IconUsers, hint: "Sign in with your Patient ID or mobile number." },
  { key: "staff", label: "Staff", icon: IconDoctor, hint: "Doctors, reception, pharmacy & hospital admins sign in here." },
];

// Rotating healthcare-tip content for the left panel. Purely presentational copy;
// no backend dependency, so it's safe to expand or reorder freely.
const HEALTH_TIPS = [
  {
    category: "Daily Health Tip",
    title: "Stay Hydrated",
    body: "Drinking enough water supports energy, focus, and overall wellbeing throughout the day.",
    stat: { value: "8", label: "glasses recommended / day" },
    Icon: IconDroplet,
  },
  {
    category: "Movement Matters",
    title: "Take a Short Walk",
    body: "Even a brisk 15-minute walk improves circulation and can lift your mood noticeably.",
    stat: { value: "15", label: "minutes a day is enough" },
    Icon: IconWalk,
  },
  {
    category: "Preventive Care",
    title: "Don't Skip Checkups",
    body: "Regular health screenings catch problems early, when they're easiest to treat.",
    stat: { value: "1x", label: "recommended per year" },
    Icon: IconActivity,
  },
  {
    category: "Rest & Recovery",
    title: "Protect Your Sleep",
    body: "Consistent, quality sleep is one of the strongest predictors of long-term health.",
    stat: { value: "7\u20139", label: "hours for most adults" },
    Icon: IconMoonStars,
  },
  {
    category: "Platform Trust",
    title: "Your Records, Protected",
    body: "Every hospital on Missile Health operates in an isolated workspace \u2014 your data never crosses tenant lines.",
    stat: { value: "100%", label: "hospital data isolation" },
    Icon: IconShield,
  },
];

const ROTATE_MS = 5200;

export default function Login() {
  const dispatch = useAppDispatch();
  const { loading, error: rtkError } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();

  const [role, setRole] = useState("patient");
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [remember, setRemember] = useState(false);
  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % HEALTH_TIPS.length), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const field = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const error = localError || rtkError;
  const tip = HEALTH_TIPS[tipIndex];

  const submit = async (e) => {
    e.preventDefault();
    setLocalError("");
    const payload = {
      identifier: form.identifier,
      password: form.password,
      role: role === "patient" ? "patient" : "staff",
      remember,
    };

    const resultAction = await dispatch(loginUser(payload));
    if (loginUser.fulfilled.match(resultAction)) {
      const user = resultAction.payload.user;
      const r = user?.role || role;
      if (r === "superadmin") navigate("/super-admin/dashboard", { replace: true });
      else if (r === "hospital_admin") navigate("/app/hospital/dashboard", { replace: true });
      else navigate(`/app/${r}`, { replace: true });
    }
  };

  return (
    <main className="min-h-screen flex bg-[var(--color-bg)]">
      {/* ---------- Left: rotating healthcare content panel ---------- */}
      <section className="hidden lg:flex relative w-[52%] overflow-hidden flex-col justify-between px-16 py-14 text-white bg-gradient-to-br from-[var(--color-primary-dark)] via-[var(--color-primary)] to-[var(--color-accent)]">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
          <svg viewBox="0 0 200 200" className="w-full h-full" preserveAspectRatio="none">
            <circle cx="15" cy="15" r="34" fill="white" /><circle cx="185" cy="185" r="55" fill="white" /><circle cx="170" cy="18" r="22" fill="white" /><circle cx="25" cy="175" r="22" fill="white" />
          </svg>
        </div>

        {/* Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 grid place-items-center backdrop-blur border border-white/20"><IconHeart className="text-2xl text-white" /></div>
            <div>
              <h1 className="font-[var(--font-display)] text-2xl font-semibold">Missile Health</h1>
              <p className="text-white/70 text-sm">Multi-hospital healthcare platform</p>
            </div>
          </div>
        </div>

        {/* Rotating tip card */}
        <div className="relative z-10 max-w-md">
          <div key={tipIndex} className="animate-blur-in">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 grid place-items-center text-lg"><tip.Icon /></span>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/70">{tip.category}</span>
            </div>
            <h2 className="font-[var(--font-display)] text-4xl leading-tight">{tip.title}</h2>
            <p className="text-white/80 mt-4 text-[15px] leading-relaxed">{tip.body}</p>
            {tip.stat && (
              <div className="mt-6 inline-flex items-baseline gap-2 bg-white/10 border border-white/15 rounded-2xl px-4 py-2.5 backdrop-blur">
                <span className="font-[var(--font-mono)] text-2xl font-bold">{tip.stat.value}</span>
                <span className="text-xs text-white/70">{tip.stat.label}</span>
              </div>
            )}
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mt-9">
            {HEALTH_TIPS.map((_, i) => (
              <div key={i} className="h-1 rounded-full bg-white/20 overflow-hidden flex-1">
                {i === tipIndex && (
                  <div key={tipIndex} className="h-full bg-white rounded-full" style={{ animation: `progress-fill ${ROTATE_MS}ms linear forwards` }} />
                )}
                {i < tipIndex && <div className="h-full bg-white/60 rounded-full w-full" />}
              </div>
            ))}
          </div>
        </div>

        {/* Trust strip */}
        <div className="relative z-10 flex items-center gap-5 text-xs text-white/60">
          <span className="flex items-center gap-1.5"><IconShield className="text-sm" /> Tenant-isolated</span>
          <span className="flex items-center gap-1.5"><IconSparkle className="text-sm" /> Insight-ready</span>
          <span>Secure &middot; Compliant &middot; 24/7</span>
        </div>
      </section>

      {/* ---------- Right: login card ---------- */}
      <section className="flex-1 flex items-center justify-center p-6 min-h-screen">
        <Card className="w-full max-w-md animate-fade-up">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-[var(--color-primary-soft)] grid place-items-center text-[var(--color-primary)]"><IconHeart className="text-2xl" /></div>
            <div>
              <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Welcome back</h1>
              <p className="text-sm text-[var(--color-ink-soft)]">Continue to your healthcare workspace</p>
            </div>
          </div>

          {/* Super Admin separate login link */}
          <div className="mt-3 text-center">
            <Link
              to="/super-admin/login"
              className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline font-medium"
            >
              <IconShield className="text-xs" /> Super Admin login &rarr;
            </Link>
          </div>

          {/* Role selector -- segmented control */}
          <div className="mt-6">
            <p className="text-xs font-semibold text-[var(--color-ink-soft)] mb-2 uppercase tracking-wider">Continue as</p>
            <div className="relative grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)]">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const active = role === r.key;
                return (
                  <button key={r.key} type="button" onClick={() => setRole(r.key)}
                    className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${active ? "bg-[var(--color-primary)] text-white shadow-[0_4px_14px_-4px_var(--color-primary)]" : "text-[var(--color-ink-soft)] hover:text-[var(--color-primary)]"}`}>
                    <Icon className="text-base" /> {r.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[var(--color-ink-soft)] mt-2">{ROLES.find((r) => r.key === role)?.hint}</p>
          </div>

          <form onSubmit={submit} className="space-y-4 mt-5">
            <Field label={role === "patient" ? "Patient ID or Mobile number" : "Email address"}>
              <input required className={inputClass} value={form.identifier} onChange={field("identifier")}
                type={role === "patient" ? "text" : "email"} placeholder={role === "patient" ? "e.g. PAT-2498765432-000 or 9876543210" : "you@hospital.com"} autoComplete="username" />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input required type={showPassword ? "text" : "password"} className={`${inputClass} pr-11`} value={form.password} onChange={field("password")} placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <IconEyeOff className="text-base" /> : <IconEye className="text-base" />}
                </button>
              </div>
            </Field>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-[var(--color-ink-soft)] cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[var(--color-primary)]" />
                Remember me
              </label>
              <a href="#" className="text-[var(--color-primary)] hover:underline" onClick={(e) => { e.preventDefault(); setLocalError("Please contact the hospital helpdesk to reset your password."); }}>Forgot password?</a>
            </div>

            {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2 animate-fade-in">{error}</p>}

            <Button type="submit" size="lg" className="w-full justify-center" disabled={loading}>
              {loading ? "Signing in\u2026" : "Sign in"}
            </Button>
          </form>

          {role === "patient" && (
            <p className="text-sm text-[var(--color-ink-soft)] mt-5 text-center">
              New patient? <Link to="/register" className="text-[var(--color-primary)] font-medium hover:underline">Register here</Link>
            </p>
          )}
        </Card>
      </section>
    </main>
  );
}
