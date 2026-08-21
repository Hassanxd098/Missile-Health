import { useEffect, useState } from "react";
import { usePatient } from "../../context/PatientContext";

import AIChatHeader from "./AIChatHeader";
import AIChatMessages from "./AIChatMessages";
import AIChatInput from "./AIChatInput";

import useMissileAI, { MAX_MESSAGE } from "./useMissileAI";
import { IconSparkle } from "../Icons";

export default function MissileAIAssistant() {
  const { patient } = usePatient();

  const role = patient?.role || "patient";

  const assistant = useMissileAI();

  const [closing, setClosing] = useState(false);
  const [draft, setDraft] = useState("");

  const {
    open,
    setOpen,
    messages,
    loading,
    listening,
    inputError,
    voiceAvailable,
    sendMessage,
    retryLast,
    clearChat,
    startVoice,
    stopVoice,
  } = assistant;

  /* ---------------------------------------------------------
     ESCAPE CLOSES THE PANEL
  --------------------------------------------------------- */

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") closePanel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closePanel = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setDraft("");
      if (listening) stopVoice();
    }, 260);
  };

  const openPanel = () => {
    setOpen(true);
    setClosing(false);
  };

  const toggleVoice = () => {
    if (listening) {
      stopVoice();
      return;
    }

    startVoice((transcript) => {
      setDraft((previous) =>
        `${previous ? `${previous} ` : ""}${transcript}`.slice(
          0,
          MAX_MESSAGE,
        ),
      );
    });
  };

  const handleSend = (text) => sendMessage(text);

  const handleQuickAction = (prompt) => {
    sendMessage(prompt);
  };

  return (
    <>
      {/* =====================================================
          FLOATING MISSILE AI BUTTON
      ===================================================== */}

      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label="Open Missile AI assistant"
          className="group fixed bottom-5 right-5 z-[90] flex items-center gap-2.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] pr-5 pl-4 py-3 text-sm font-bold text-[var(--color-ink)] shadow-[var(--shadow-xl)] backdrop-blur-xl transition-all duration-300 animate-ai-glow hover:scale-[1.03] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-primary)] active:scale-95 sm:bottom-6 sm:right-6 cursor-pointer"
        >
          <span
            className="animate-ai-attention relative grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] text-white shadow-[0_8px_18px_-6px_var(--color-primary)] transition-transform duration-300"
          >
            <IconSparkle className="text-base transition-transform duration-300 group-hover:rotate-12" />
          </span>

          <span className="flex flex-col items-start leading-tight">
            <span className="text-sm">Missile AI</span>
            <span className="text-[10px] font-semibold text-[var(--color-ink-soft)]">
              Healthcare assistant
            </span>
          </span>

          <span
            className="animate-ai-dot absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-success)]"
            title="Online"
            aria-hidden="true"
          />
        </button>
      )}

      {/* =====================================================
          CHAT PANEL
      ===================================================== */}

      {open && (
        <div
          className={`fixed bottom-3 left-3 right-3 z-[95] sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[400px] ${
            closing ? "animate-ai-panel-out" : "animate-ai-panel-in"
          }`}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Missile AI assistant chat"
            className="glass-card relative flex h-[min(74dvh,640px)] flex-col overflow-hidden rounded-[22px] shadow-[var(--shadow-xl)] sm:h-[620px]"
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px] bg-[linear-gradient(90deg,var(--color-primary),var(--color-accent),transparent)]" />

            {/* HEADER */}
            <AIChatHeader
              name={patient?.name}
              onMinimize={closePanel}
              onClose={closePanel}
            />

            {/* MESSAGES */}
            <AIChatMessages
              messages={messages}
              loading={loading}
              role={role}
              onQuickAction={handleQuickAction}
              onRetry={retryLast}
              onClear={clearChat}
            />

            {/* INPUT */}
            <AIChatInput
              value={draft}
              onChange={setDraft}
              onSend={handleSend}
              disabled={loading}
              voiceAvailable={voiceAvailable}
              listening={listening}
              onToggleVoice={toggleVoice}
              inputError={inputError}
            />
          </div>
        </div>
      )}
    </>
  );
}