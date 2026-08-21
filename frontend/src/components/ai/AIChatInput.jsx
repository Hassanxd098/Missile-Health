import { useRef } from "react";
import { MAX_MESSAGE } from "./useMissileAI";

function MicIcon({ active = false }) {
  if (active) {
    return (
      <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
        <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M12 19v3M8 22h8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 19v3M8 22h8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export default function AIChatInput({
  value,
  onChange,
  onSend,
  disabled,
  voiceAvailable,
  listening,
  onToggleVoice,
  inputError,
}) {
  const textareaRef = useRef(null);

  const length = value.length;
  const overLimit = length > MAX_MESSAGE;
  const busy = disabled || overLimit || !value.trim();

  const submit = async () => {
    if (busy) return;
    const ok = await onSend(value);
    if (ok) onChange("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const placeholder = listening
    ? "Listening… speak now — nothing will be sent automatically"
    : "Ask Missile AI anything...";

  return (
    <div className="border-t border-[var(--color-line)] bg-[var(--glass-bg)] p-3">
      {inputError && (
        <p className="mb-2 px-1 text-xs font-medium text-[var(--color-danger)]">
          {inputError}
        </p>
      )}

      <div
        className={`flex items-end gap-2 rounded-2xl border bg-[var(--color-surface)] px-3 py-2 transition-all duration-200 focus-within:border-[var(--color-primary)]/60 focus-within:shadow-[0_0_0_3px_var(--color-primary-soft)] ${
          overLimit ? "border-[var(--color-danger)]/50" : "border-[var(--color-line)]"
        }`}
      >
        {voiceAvailable && (
          <button
            type="button"
            onClick={onToggleVoice}
            onMouseDown={(event) => event.preventDefault()}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            title={listening ? "Stop voice input" : "Start voice input"}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all duration-200 active:scale-90 ${
              listening
                ? "animate-pulse-ring bg-[var(--color-danger)] text-white"
                : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-primary)]"
            }`}
          >
            <MicIcon active={listening} />
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_MESSAGE}
          placeholder={placeholder}
          aria-label="Message Missile AI"
          disabled={disabled}
          autoFocus
          className="no-scrollbar max-h-32 min-h-9 w-full flex-1 resize-none bg-transparent py-1.5 text-sm leading-6 text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)] disabled:opacity-60"
        />

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          aria-label="Send message"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white transition-all duration-200 active:scale-90 ${
            busy
              ? "cursor-not-allowed bg-[var(--color-ink-soft)]/40 opacity-60 shadow-none"
              : "bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-dark))] shadow-[0_6px_16px_-6px_var(--color-primary)] hover:scale-[1.04]"
          }`}
        >
          <SendIcon />
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between px-1">
        <p className="text-[10px] text-[var(--color-ink-soft)]">
          Enter to send · Shift + Enter for a new line
        </p>
        <p
          className={`font-mono text-[10px] ${
            overLimit ? "text-[var(--color-danger)]" : "text-[var(--color-ink-soft)]"
          }`}
        >
          {length}/{MAX_MESSAGE}
        </p>
      </div>
    </div>
  );
}