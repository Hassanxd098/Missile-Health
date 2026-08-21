import { IconSparkle } from "../Icons";

const QUICK_ACTIONS = {
  patient: [
    {
      label: "Book an appointment",
      prompt: "How do I book an appointment?",
    },
    {
      label: "My prescription",
      prompt: "Where can I see my prescription?",
    },
    {
      label: "Payment help",
      prompt: "How does pharmacy payment work?",
    },
  ],
  doctor: [
    {
      label: "Today's workflow",
      prompt: "How does today's consultation workflow work?",
    },
    {
      label: "AI Medical Scribe",
      prompt: "How does AI Medical Scribe work?",
    },
    {
      label: "Prescription help",
      prompt: "How do I send a prescription to the pharmacy?",
    },
  ],
  pharmacy: [
    {
      label: "Process prescription",
      prompt: "How do I process an incoming prescription?",
    },
    {
      label: "Create bill",
      prompt: "How do I create a medicine bill?",
    },
    {
      label: "Payment help",
      prompt: "How do I handle cash payments?",
    },
  ],
  admin: [
    {
      label: "Register doctor",
      prompt: "How do I register a doctor?",
    },
    {
      label: "Manage appointments",
      prompt: "How do I manage appointments?",
    },
    {
      label: "Dashboard help",
      prompt: "How do I read the dashboard analytics?",
    },
  ],
  hospital_admin: [
    {
      label: "Manage staff",
      prompt: "How do I manage hospital staff?",
    },
    {
      label: "Manage appointments",
      prompt: "How do I manage appointments?",
    },
    {
      label: "Reports help",
      prompt: "How do I use the reports and revenue page?",
    },
  ],
};

export default function AIQuickActions({ role, onSelect }) {
  const actions = QUICK_ACTIONS[role] || QUICK_ACTIONS.patient;

  return (
    <div className="animate-ai-msg flex items-start gap-2">
      <div
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
        aria-hidden="true"
      >
        <IconSparkle className="text-sm" />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="mb-2 text-[10px] font-bold tracking-widest text-[var(--color-ink-soft)] uppercase">
          Suggested
        </p>

        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onSelect(action.prompt)}
              className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--color-ink)] shadow-[var(--shadow-xs)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] hover:shadow-[var(--shadow-sm)] active:scale-95"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}