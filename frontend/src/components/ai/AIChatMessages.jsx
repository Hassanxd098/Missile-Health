import { useEffect, useRef } from "react";
import { IconSparkle } from "../Icons";
import AIQuickActions from "./AIQuickActions";

const formatTime = (at) =>
  new Date(at || Date.now()).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

function MessageAvatar() {
  return (
    <div
      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
      aria-hidden="true"
    >
      <IconSparkle className="text-sm" />
    </div>
  );
}

function AssistantBubble({ content, error, onRetry, at }) {
  return (
    <div className="animate-ai-msg flex items-end gap-2 max-w-[85%]">
      <MessageAvatar />
      <div className="min-w-0">
        <div
          className={`rounded-2xl rounded-bl-sm border px-3.5 py-2.5 text-sm leading-6 ${
            error
              ? "border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] text-[var(--color-ink)]"
              : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{content}</p>

          {error && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:bg-[var(--color-primary-dark)] active:scale-95"
            >
              Retry
            </button>
          )}
        </div>
        {!error && (
          <time className="mt-1.5 pl-1 text-[10px] text-[var(--color-ink-soft)]">
            {formatTime(at)}
          </time>
        )}
      </div>
    </div>
  );
}

function UserBubble({ content, at }) {
  return (
    <div className="animate-ai-msg flex flex-col items-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-dark))] px-3.5 py-2.5 text-sm leading-6 text-white shadow-[0_6px_16px_-6px_var(--color-primary)]">
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
      <time className="mt-1.5 pr-1 text-[10px] text-[var(--color-ink-soft)]">
        {formatTime(at)}
      </time>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="animate-ai-msg flex items-end gap-2">
      <MessageAvatar />

      <div className="rounded-2xl rounded-bl-sm border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-ink-soft)]">
            Missile AI is thinking
          </span>

          <span className="flex items-center gap-1" aria-hidden="true">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="animate-ai-typing h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
                style={{ animationDelay: `${dot * 0.16}s` }}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AIChatMessages({
  messages,
  loading,
  role,
  onQuickAction,
  onRetry,
  onClear,
}) {
  const scrollRef = useRef(null);

  const started = messages.some((message) => !message.meta);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, loading]);

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-label="Chat with Missile AI"
      className="no-scrollbar flex-1 space-y-3 overflow-y-auto bg-[var(--color-surface)]/40 px-4 py-4"
    >
      {started && (
        <div className="flex justify-center pt-0.5">
          <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1 text-[10px] font-semibold tracking-widest text-[var(--color-ink-soft)] uppercase">
            Conversation started
          </span>
        </div>
      )}

      {messages.map((message) =>
        message.role === "user" ? (
          <UserBubble
            key={message.id}
            content={message.content}
            at={message.at}
          />
        ) : (
          <AssistantBubble
            key={message.id}
            content={message.content}
            error={Boolean(message.error)}
            onRetry={message.error ? onRetry : undefined}
            at={message.at}
          />
        ),
      )}

      {loading && <TypingIndicator />}

      {!started && !loading && (
        <AIQuickActions role={role} onSelect={onQuickAction} />
      )}

      {started && !loading && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold text-[var(--color-ink-soft)] transition-colors duration-200 hover:text-[var(--color-danger)]"
          >
            Start a new conversation
          </button>
        </div>
      )}
    </div>
  );
}