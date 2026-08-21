import { NavLink } from "react-router-dom";

const MODULES = [
  { n: "01", to: "/onboarding", label: "Onboarding", sub: "Your health profile" },
  { n: "02", to: "/symptoms", label: "Symptom Discovery", sub: "Find the right doctor" },
  { n: "03", to: "/appointments", label: "Appointments", sub: "Book & manage visits" },
  { n: "04", to: "/visit", label: "Visit Documentation", sub: "AI-captured records" },
  { n: "05", to: "/referrals", label: "Referral & 2nd Opinion", sub: "Escalate your care" },
  { n: "06", to: "/orders", label: "Medicine Ordering", sub: "Prescription to cart" },
  { n: "07", to: "/chat", label: "Chat Support", sub: "Ask for any document" },
  { n: "08", to: "/wellness", label: "Wellness Coaching", sub: "Diet & hygiene plan" },
];

export default function Sidebar() {
  return (
    <aside className="w-72 shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-line)] flex flex-col">
      <div className="px-6 pt-7 pb-5">
        <div className="font-[var(--font-display)] text-xl font-semibold tracking-tight text-[var(--color-primary-dark)]">
          Missile Health
        </div>
        <div className="text-xs text-[var(--color-ink-soft)] mt-0.5">AI-guided patient journey</div>
      </div>

      <nav className="relative flex-1 overflow-y-auto pb-6">
        {/* connecting thread */}
        <div className="absolute left-[38px] top-2 bottom-6 w-px bg-[var(--color-line)]" aria-hidden="true" />
        <ul className="relative">
          {MODULES.map((m) => (
            <li key={m.to}>
              <NavLink
                to={m.to}
                className={({ isActive }) =>
                  `group flex items-start gap-4 px-6 py-3.5 relative transition-colors ${
                    isActive ? "bg-[var(--color-primary-soft)]" : "hover:bg-[var(--color-bg)]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative flex items-center justify-center shrink-0 w-4 h-4 mt-0.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isActive ? "bg-[var(--color-accent)]" : "bg-[var(--color-line)] group-hover:bg-[var(--color-primary)]"
                        }`}
                      />
                      {isActive && (
                        <svg className="absolute -inset-2 pulse-line" viewBox="0 0 32 32">
                          <circle cx="16" cy="16" r="10" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-ink-soft)]">{m.n}</span>
                        <span className={`text-sm font-medium ${isActive ? "text-[var(--color-primary-dark)]" : "text-[var(--color-ink)]"}`}>
                          {m.label}
                        </span>
                      </span>
                      <span className="block text-xs text-[var(--color-ink-soft)] mt-0.5">{m.sub}</span>
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
