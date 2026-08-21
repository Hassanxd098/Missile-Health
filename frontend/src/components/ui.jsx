import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

/* ---------- Glassmorphism Card ---------- */
export default function Card({ children, className = "", interactive = false, ...props }) {
  return (
    <div
      className={`glass-card animate-fade-up ${interactive ? "glass-card-hover cursor-pointer" : ""} rounded-3xl p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/* ---------- Section heading used above cards ---------- */
export function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="font-[var(--font-display)] font-bold text-lg text-[var(--color-ink)] tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------- Modern Button ---------- */
export function Button({ children, variant = "primary", size = "md", className = "", icon, ...props }) {
  const variants = {
    primary: "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white shadow-[0_8px_20px_-6px_var(--color-primary)]",
    accent: "bg-[var(--color-accent)] hover:brightness-95 text-white shadow-[0_8px_20px_-6px_var(--color-accent)]",
    ghost: "bg-transparent border border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]",
    subtle: "bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-primary)]",
    danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger)]/20 hover:brightness-95",
    success: "bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20 hover:brightness-95",
  };
  const sizes = { sm: "px-3.5 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-sm" };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-2xl whitespace-nowrap transition-all duration-200 ease-[var(--ease-soft)] hover:-translate-y-[1px] active:scale-[0.98] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      {children}
    </button>
  );
}

/* ---------- Icon-only button (nav bars, headers, table rows) ---------- */
export function IconButton({ children, className = "", label, ...props }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`w-9 h-9 grid place-items-center rounded-xl border border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:border-[var(--color-line)] transition-all duration-200 active:scale-95 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- Form & Inputs ---------- */
export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5 uppercase tracking-wider">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[var(--color-ink-soft)] mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all duration-200 text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]/70";

export const selectClass =
  "w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all duration-200 text-[var(--color-ink)] cursor-pointer appearance-none pr-10 hover:border-[var(--color-primary)] hover:shadow-md hover:shadow-blue-500/10";

export function TextInput(props) { return <input className={inputClass} {...props} />; }

/* ---------- Extraordinary Custom Select Component ---------- */
export function Select({ value, onChange, children, className = "", placeholder = "Select...", disabled = false, required = false, name, defaultValue, id }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [internalVal, setInternalVal] = useState(value !== undefined ? value : (defaultValue || ""));

  useEffect(() => {
    if (value !== undefined) {
      setInternalVal(value);
    }
  }, [value]);

  const options = [];
  React.Children.forEach(children, (child) => {
    if (child && child.type === "option") {
      const val = child.props.value !== undefined ? child.props.value : child.props.children;
      options.push({
        value: val,
        label: child.props.children,
        disabled: child.props.disabled,
      });
    }
  });

  const currentVal = value !== undefined ? value : internalVal;
  const selectedOption = options.find((o) => String(o.value) === String(currentVal));
  const displayLabel = selectedOption ? selectedOption.label : (options[0]?.label || placeholder);

  const filteredOptions = options.filter((opt) => {
    if (!search) return true;
    return String(opt.label).toLowerCase().includes(search.toLowerCase());
  });

  const handleSelect = (val) => {
    setInternalVal(val);
    setOpen(false);
    setSearch("");
    if (onChange) {
      onChange({ target: { name, value: val, id }, preventDefault: () => {}, stopPropagation: () => {} });
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      {name && <input type="hidden" name={name} value={currentVal || ""} required={required} />}
      
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)] shadow-sm hover:border-[var(--color-primary)] hover:shadow-md hover:shadow-blue-500/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate text-left">
          {displayLabel}
        </span>
        <svg
          className={`w-4 h-4 text-[var(--color-primary)] transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[140]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-2 z-[150] glass-card rounded-2xl border border-[var(--color-line)] p-1.5 shadow-2xl max-h-64 overflow-y-auto animate-blur-in">
            {options.length > 6 && (
              <div className="p-1 mb-1.5 border-b border-[var(--color-line)]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search options..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] outline-none focus:border-[var(--color-primary)] text-[var(--color-ink)]"
                  autoFocus
                />
              </div>
            )}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(currentVal);
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md font-bold"
                        : "text-[var(--color-ink)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
                    } ${opt.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <span className="truncate text-left">{opt.label}</span>
                    {isSelected && <span className="font-bold ml-2">✓</span>}
                  </button>
                );
              })
            ) : (
              <p className="p-3 text-xs text-[var(--color-ink-soft)] text-center">No options found</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Extraordinary Custom Dropdown Component ---------- */
export function CustomDropdown({ options = [], value, onChange, placeholder = "Select option", className = "", icon, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedOption = options.find((o) => (typeof o === "object" ? o.value === value : o === value));
  const displayLabel = selectedOption
    ? typeof selectedOption === "object"
      ? selectedOption.label
      : selectedOption
    : placeholder;

  const filteredOptions = options.filter((opt) => {
    if (!search) return true;
    const lbl = typeof opt === "object" ? opt.label : opt;
    return String(lbl).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)] shadow-sm hover:border-[var(--color-primary)] hover:shadow-md hover:shadow-blue-500/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 truncate">
          {icon && <span className="text-base text-[var(--color-primary)] shrink-0">{icon}</span>}
          <span className={!selectedOption ? "text-[var(--color-ink-soft)]" : ""}>{displayLabel}</span>
        </span>
        <svg
          className={`w-4 h-4 text-[var(--color-primary)] transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[140]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-2 z-[150] glass-card rounded-2xl border border-[var(--color-line)] p-1.5 shadow-2xl max-h-64 overflow-y-auto animate-blur-in">
            {options.length > 6 && (
              <div className="p-1 mb-1.5 border-b border-[var(--color-line)]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search options..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] outline-none focus:border-[var(--color-primary)] text-[var(--color-ink)]"
                  autoFocus
                />
              </div>
            )}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const val = typeof opt === "object" ? opt.value : opt;
                const lbl = typeof opt === "object" ? opt.label : opt;
                const optIcon = typeof opt === "object" ? opt.icon : null;
                const isSelected = val === value;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onChange(val);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md font-bold"
                        : "text-[var(--color-ink)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {optIcon && <span>{optIcon}</span>}
                      {lbl}
                    </span>
                    {isSelected && <span className="font-bold ml-2">✓</span>}
                  </button>
                );
              })
            ) : (
              <p className="p-3 text-xs text-[var(--color-ink-soft)] text-center">No options found</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- StatusBadge ---------- */
const STATUS_STYLES = {
  confirmed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  requested: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "in-progress": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  missed: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  refunded: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  draft: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  "new": "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  "sent-to-pharmacy": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  preparing: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  ready: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  delivered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  dispensed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  blocked: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  normal: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  emergency: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  hospital: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  consultation: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  healthy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  cash: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  upi: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  card: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  insurance: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  online: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
};

export function StatusBadge({ status, className = "" }) {
  const s = String(status || "pending").replaceAll(" ", "-");
  const isEmergency = s === "emergency";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full capitalize whitespace-nowrap border ${STATUS_STYLES[s] || "bg-slate-500/10 text-slate-500 border-slate-500/20"} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${isEmergency ? "animate-pulse-ring" : ""}`} />
      {String(status || "\u2014").replaceAll("_", " ").replaceAll("-", " ")}
    </span>
  );
}

/* ---------- Ice-Blue Stat Card (Reference Screenshot 1) ---------- */
export function StatCard({ label, value, sub, icon, trend = "12.8% the last month", tint = "primary" }) {
  return (
    <div className="glass-card-hover animate-stat-in relative overflow-hidden rounded-3xl p-5 bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm flex flex-col justify-between transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 grid place-items-center text-sm font-semibold">
            {icon || "📊"}
          </div>
          <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{label}</p>
        </div>
        <button className="text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] text-lg leading-none p-1 font-bold" title="Options">⋮</button>
      </div>

      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-3xl font-bold text-[var(--color-ink)] tracking-tight tabular-nums font-[var(--font-mono)]">{value}</span>
        {trend && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] bg-[var(--color-primary-soft)] px-2 py-0.5 rounded-full">
            <span>↗</span> {trend}
          </span>
        )}
      </div>

      {sub && (
        <div className="mt-3 pt-2.5 border-t border-[var(--color-line)] text-xs text-[var(--color-ink-soft)] font-medium flex items-center justify-between">
          <span>{sub}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Empty State ---------- */
export function EmptyState({ icon, title, hint }) {
  return (
    <div className="text-center py-10 animate-fade-in">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-bold text-[var(--color-ink)] text-base">{title || "Nothing here yet"}</p>
      {hint && <p className="text-xs text-[var(--color-ink-soft)] mt-1">{hint}</p>}
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className = "" }) {
  return <div className={`oskeleton rounded-2xl ${className}`} />;
}
export function SkeletonCard() {
  return (
    <Card><Skeleton className="h-4 w-24 mb-4" /><Skeleton className="h-8 w-40" /><Skeleton className="h-3 w-28 mt-3" /></Card>
  );
}

/* ---------- Toast System ---------- */
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const styles = {
    success: "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/90 dark:bg-slate-900/90",
    error: "border-red-500 text-red-600 dark:text-red-400 bg-red-50/90 dark:bg-slate-900/90",
    info: "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/90 dark:bg-slate-900/90",
  };
  return (
    <ToastCtx.Provider value={push}>{children}
      <div className="fixed bottom-5 right-5 z-[110] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`animate-slide-in-right backdrop-blur-xl border-l-4 shadow-2xl rounded-2xl px-4 py-3 text-sm font-semibold max-w-sm border ${styles[t.type]}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const push = useContext(ToastCtx);
  return push || (() => {});
}

/* ---------- Glassmorphism Modal ---------- */
export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  const dialog = (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" onClick={onClose} />
      <div
        className={`relative w-full glass-card rounded-3xl shadow-2xl border border-white/40 dark:border-slate-800
                    overflow-y-auto max-h-[calc(100vh-2rem)] animate-blur-in
                    ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-line)]">
          <h3 className="font-[var(--font-display)] font-bold text-lg text-[var(--color-ink)]">{title}</h3>
          <IconButton label="Close" onClick={onClose} className="bg-[var(--color-surface-2)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]">
            <span className="text-lg leading-none">&times;</span>
          </IconButton>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(dialog, document.body) : null;
}

/* ---------- Simple Interactive Charts ---------- */

/* Exact value formatting (never rounds or drops the currency symbol). */
const chartValue = (value, money) =>
  money
    ? "\u20b9" + Number(value || 0).toLocaleString("en-IN")
    : Number(value || 0).toLocaleString("en-IN");

export function MiniBarChart({ data = [], height = 160, money = false }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const gridLines = [0.25, 0.5, 0.75, 1];

  /* Highlight the tallest bar for visual emphasis (values stay exact). */
  const topIndex = data.reduce(
    (top, d, i) => (d.value > data[top]?.value ? i : top),
    0,
  );

  return (
    <div className="relative" style={{ height }}>
      {/* Soft backdrop band gives the plot depth without affecting layout */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl bg-[linear-gradient(180deg,var(--color-surface-2)/60,transparent)]" />

      {/* Reference gridlines give the eye a scale even with very few bars */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        {gridLines.map((g) => (
          <div key={g} className="border-t border-[var(--color-line)]/70 w-full" />
        ))}
      </div>

      {/* Scrolls horizontally instead of squeezing bars/labels illegible when there are many points;
          justify-center means a handful of bars still sit centered rather than stretched edge-to-edge. */}
      <div className="relative h-full overflow-x-auto no-scrollbar">
        <div className="h-full flex items-end justify-center gap-2 sm:gap-3 min-w-full px-1">
          {data.map((d, i) => {
            const pct = Math.max((d.value / max) * 90, d.value > 0 ? 4 : 0);
            const isTop = d.value === data[topIndex]?.value && data.length > 1;
            const isHighlight = d.highlight === true || (d.highlight === undefined && isTop);

            return (
              <div key={i} className="group relative w-14 shrink-0 flex flex-col items-center gap-1.5 h-full justify-end">
                <span
                  className="text-[10px] font-mono font-semibold tabular-nums whitespace-nowrap transition-colors duration-200 animate-bar-value-in group-hover:text-[var(--color-primary)]"
                  style={{ animationDelay: `${i * 35 + 260}ms` }}
                >
                  {chartValue(d.value, money)}
                </span>

                <div className="relative w-full flex-1 flex items-end">
                  <div
                    className={`origin-bottom w-full rounded-t-lg transition-all duration-300 ${
                      isHighlight
                        ? "shadow-[0_6px_18px_-6px_var(--color-primary)] group-hover:brightness-110"
                        : "opacity-90 group-hover:brightness-115 group-hover:opacity-100"
                    }`}
                    style={{
                      height: `${pct}%`,
                      minHeight: d.value > 0 ? 4 : 0,
                      background: isHighlight
                        ? "linear-gradient(180deg, var(--color-primary), var(--color-primary-dark))"
                        : "linear-gradient(180deg, var(--color-primary), var(--color-accent))",
                      animation: `bar-grow-soft .55s var(--ease-soft) both`,
                      animationDelay: `${i * 35}ms`,
                    }}
                  />
                </div>

                <span className="text-[10px] font-semibold text-[var(--color-ink-soft)] truncate max-w-full">{d.label}</span>

                {/* Hover tooltip — exact value, kept inside the chart so it never overflows */}
                <span
                  className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1 text-[10px] font-bold text-[var(--color-ink)] opacity-0 shadow-[var(--shadow-sm)] backdrop-blur-md transition-all duration-200 group-hover:-translate-y-0.5 group-hover:opacity-100"
                >
                  {chartValue(d.value, money)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DonutChart({ data = [], size = 40 }) {
  const [drawn, setDrawn] = useState(false);
  const [hovered, setHovered] = useState(null);

  /* Sweep the segments in once on mount (ECharts-style draw effect). */
  useEffect(() => {
    const id = window.setTimeout(() => setDrawn(true), 60);
    return () => window.clearTimeout(id);
  }, []);

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const palette = ["var(--color-primary)", "var(--color-accent)", "var(--color-success)", "var(--color-warning)", "var(--color-violet)", "var(--color-teal)"];

  /* Segment layout in 0–100 "circle units" so every slice lands exactly
     where it should and the legend percentages add up to 100%. */
  let acc = 0;
  const segments = data.map((d) => {
    const frac = d.value / total;
    const start = acc * 100;
    acc += frac;
    const gap = data.length > 1 ? 1.8 : 0;
    const dash = Math.max(frac * 100 - gap, 0);
    return { ...d, frac, start, dash };
  });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="animate-donut-pop relative shrink-0" style={{ width: size, height: size }}>
        <svg width="100%" height="100%" viewBox="0 0 40 40" role="img" aria-label="Donut chart">
          <circle cx="20" cy="20" r="15.9" fill="none" stroke="var(--color-line)" strokeWidth="7" />

          {segments.map((s, i) =>
            s.dash <= 0 ? null : (
              <circle
                key={i}
                cx="20"
                cy="20"
                r="15.9"
                fill="none"
                stroke={palette[i % palette.length]}
                strokeWidth={hovered === i ? 9 : 7}
                strokeDasharray={`${s.dash} ${100 - s.dash}`}
                strokeDashoffset={drawn ? -s.start : -(s.start + s.dash)}
                strokeLinecap="butt"
                transform="rotate(-90 20 20)"
                style={{
                  transition: `stroke-dashoffset 900ms var(--ease-soft) ${i * 90 + 120}ms, stroke-width 200ms var(--ease-soft), opacity 200ms var(--ease-soft)`,
                  opacity: hovered === null || hovered === i ? 1 : 0.35,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            ),
          )}
        </svg>

        {/* Exact center total */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center leading-none">
            <p className="font-[var(--font-mono)] font-bold tabular-nums" style={{ fontSize: size * 0.22 }}>
              {total.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 font-semibold tracking-wider uppercase text-[var(--color-ink-soft)]" style={{ fontSize: Math.max(size * 0.08, 7) }}>
              Total
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1 min-w-0 flex-1">
        {segments.map((s, i) => (
          <button
            type="button"
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs transition-all duration-200 ${
              hovered === i ? "bg-[var(--color-surface-2)]" : ""
            }`}
          >
            <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: palette[i % palette.length] }} />
            <span className="truncate text-[var(--color-ink-soft)]">{s.label}</span>
            <span className="ml-auto font-bold text-[var(--color-ink)] tabular-nums">{s.value}</span>
            <span className="w-9 text-right text-[10px] text-[var(--color-ink-soft)] tabular-nums">
              {Math.round(s.frac * 100)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RadialGauge({ value = "1000+", label = "Total Patient", manFrac = 0.35, womanFrac = 0.15 }) {
  return (
    <div className="relative w-full flex flex-col items-center justify-center pt-4 pb-2">
      <div className="relative w-56 h-28 overflow-hidden flex items-end justify-center">
        <div className="w-56 h-56 rounded-full border-[14px] border-blue-500/20 border-t-blue-600 border-r-cyan-400 border-l-blue-600 absolute top-0" style={{ transform: "rotate(-45deg)" }} />
        <div className="w-44 h-44 rounded-full bg-gradient-to-b from-blue-500/10 via-cyan-400/5 to-transparent absolute top-6" />
        <div className="text-center z-10 mb-1">
          <p className="text-[10px] uppercase font-semibold text-[var(--color-ink-soft)] tracking-wider">{label}</p>
          <p className="text-2xl font-bold font-[var(--font-mono)] text-[var(--color-ink)]">{value}</p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-6 mt-3 text-xs font-semibold text-[var(--color-ink-soft)]">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Man <b className="text-[var(--color-ink)]">{Math.round(manFrac * 100)}%</b></span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Woman <b className="text-[var(--color-ink)]">{Math.round(womanFrac * 100)}%</b></span>
      </div>
    </div>
  );
}
