import { IconSparkle, IconX, IconChevronDown } from "../Icons";

function greetingFor(name) {
  const hour = new Date().getHours();
  const period =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name ? String(name).trim().split(/\s+/)[0] : "";
  return `${period}${first ? `, ${first}` : ""} — how can I help?`;
}

export default function AIChatHeader({ name, onMinimize, onClose }) {
  return (
    <div className="relative flex items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--glass-bg)] px-4 py-3">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,var(--color-primary),var(--color-accent),transparent)]" />

      <div className="flex min-w-0 items-center gap-3">
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] text-white shadow-[0_8px_18px_-6px_var(--color-primary)]">
          <IconSparkle className="text-lg" />
          <span
            className="animate-ai-dot absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-success)]"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold leading-tight text-[var(--color-ink)]">
              Missile AI
            </h2>
            <span className="rounded-full bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-[var(--color-success)] uppercase">
              Online
            </span>
          </div>
          <p className="truncate text-[11px] text-[var(--color-ink-soft)]">
            {greetingFor(name)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMinimize}
          aria-label="Minimize Missile AI"
          className="grid h-8 w-8 place-items-center rounded-xl text-[var(--color-ink-soft)] transition-colors duration-200 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
        >
          <IconChevronDown />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Missile AI"
          className="grid h-8 w-8 place-items-center rounded-xl text-[var(--color-ink-soft)] transition-colors duration-200 hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
        >
          <IconX />
        </button>
      </div>
    </div>
  );
}