import { usePatient } from "../context/PatientContext";
import { useNavigate } from "react-router-dom";

export default function Topbar({ title, subtitle }) {
  const { patient, logout } = usePatient();
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface)] px-8 py-5">
      <div>
        <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--color-ink-soft)] mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {patient ? (
          <>
            <div className="text-right">
              <div className="text-sm font-medium">{patient.name}</div>
              <div className="text-xs text-[var(--color-ink-soft)] font-[var(--font-mono)]">{patient.id}</div>
            </div>
            <button
              onClick={() => { logout(); navigate("/onboarding"); }}
              className="text-xs text-[var(--color-ink-soft)] border border-[var(--color-line)] rounded-full px-3 py-1.5 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
            >
              Switch patient
            </button>
          </>
        ) : (
          <span className="text-xs text-[var(--color-warning)] bg-[var(--color-warning-soft)] rounded-full px-3 py-1.5">
            Not onboarded yet
          </span>
        )}
      </div>
    </header>
  );
}
