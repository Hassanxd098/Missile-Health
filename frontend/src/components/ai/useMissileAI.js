import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import client from "../../api/client";

export const MAX_MESSAGE = 2000;
const HISTORY_TO_SEND = 8;

let sequence = 0;
const createId = () => `mai-${Date.now().toString(36)}-${(sequence += 1)}`;

const getSpeechRecognition = () => {
  if (typeof window === "undefined") return null;
  return (
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    null
  );
};

const FEELING_CONNECT_ERROR =
  "Sorry, I'm having trouble connecting right now. Please try again.";

const TOO_FAST_ERROR =
  "You're asking too quickly. Please wait a moment and try again.";

export default function useMissileAI() {
  const [open, setOpen] = useState(false);

  const [messages, setMessages] = useState(
    () => [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hi 👋 I'm Missile AI.\nHow can I help you today?",
        at: Date.now(),
        meta: true,
      },
    ],
  );

  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [attention, setAttention] = useState(false);
  const [inputError, setInputError] = useState("");

  const recognitionRef = useRef(null);
  const lastUserRef = useRef(null);
  const lastErrorRef = useRef(null);
  const retryContentRef = useRef("");

  const voiceAvailable = useMemo(
    () => Boolean(getSpeechRecognition()),
    [],
  );

  /* ---------------------------------------------------------
     ONE-TIME ATTENTION ON THE FLOATING BUTTON
  --------------------------------------------------------- */

  useEffect(() => {
    if (sessionStorage.getItem("missile_ai_attention") === "1") {
      return undefined;
    }

    const show = window.setTimeout(() => {
      setAttention(true);
      sessionStorage.setItem("missile_ai_attention", "1");
    }, 1200);

    const hide = window.setTimeout(
      () => setAttention(false),
      3200,
    );

    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  /* ---------------------------------------------------------
     CLEANUP SPEECH / TIMERS
  --------------------------------------------------------- */

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  /* ---------------------------------------------------------
     SEND
  --------------------------------------------------------- */

  const sendMessage = useCallback(
    async (raw) => {
      const content = String(raw || "").trim();

      if (!content) {
        setInputError("Please type a message first.");
        return false;
      }

      if (content.length > MAX_MESSAGE) {
        setInputError(`Messages are limited to ${MAX_MESSAGE} characters.`);
        return false;
      }

      if (loading) return false;

      setInputError("");
      retryContentRef.current = content;

      const userId = createId();
      lastUserRef.current = userId;

      setMessages((previous) => [
        ...previous,
        { id: userId, role: "user", content, at: Date.now() },
      ]);

      setLoading(true);

      /*
       * Send a bounded recent history so follow-up
       * questions keep context without unbounded tokens.
       */
      const history = messages
        .filter((turn) => !turn.meta && !turn.error)
        .slice(-HISTORY_TO_SEND)
        .map((turn) => ({
          role: turn.role,
          content: turn.content,
        }));

      try {
        const { data } = await client.post(
          "/ai/dashboard-assistant",
          { message: content, history },
        );

        const reply = String(data?.reply || "").trim();

        if (reply) {
          lastErrorRef.current = null;
          setMessages((previous) => [
            ...previous,
            {
              id: createId(),
              role: "assistant",
              content: reply,
              at: Date.now(),
            },
          ]);
        } else {
          throw new Error("empty-reply");
        }
      } catch (error) {
        const status = error?.response?.status;
        const serverMessage = String(
          error?.response?.data?.error || "",
        ).trim();

        const failed = {
          id: createId(),
          role: "assistant",
          content:
            serverMessage ||
            (status === 429 ? TOO_FAST_ERROR : FEELING_CONNECT_ERROR),
          at: Date.now(),
          error: true,
        };

        lastErrorRef.current = failed.id;
        setMessages((previous) => [...previous, failed]);
      } finally {
        setLoading(false);
      }

      return true;
    },
    [loading, messages],
  );

  /* ---------------------------------------------------------
     RETRY THE LAST FAILED SEND
  --------------------------------------------------------- */

  const retryLast = useCallback(() => {
    const content = retryContentRef.current;
    if (!content || loading) return;

    setMessages((previous) =>
      previous.filter(
        (turn) =>
          turn.id !== lastErrorRef.current &&
          turn.id !== lastUserRef.current,
      ),
    );

    lastErrorRef.current = null;
    lastUserRef.current = null;

    sendMessage(content);
  }, [loading, sendMessage]);

  /* ---------------------------------------------------------
     CLEAR CONVERSATION
  --------------------------------------------------------- */

  const clearChat = useCallback(() => {
    lastUserRef.current = null;
    lastErrorRef.current = null;
    retryContentRef.current = "";
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hi 👋 I'm Missile AI.\nHow can I help you today?",
        at: Date.now(),
        meta: true,
      },
    ]);
  }, []);

  /* ---------------------------------------------------------
     VOICE TRANSCRIPTION (never auto-submits)
  --------------------------------------------------------- */

  const startVoice = useCallback((onResult) => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";

    let finalText = "";

    recognition.onresult = (event) => {
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        if (result.isFinal) {
          finalText +=
            `${result[0]?.transcript || ""} `.replace(/\s+/g, " ");
        }
      }

      const clean = finalText.trim();
      if (clean && typeof onResult === "function") {
        onResult(clean);
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event) => {
      console.error("Missile AI voice error:", event.error);
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stopVoice = useCallback(() => {
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  return {
    open,
    setOpen,
    messages,
    loading,
    listening,
    attention,
    inputError,
    voiceAvailable,
    sendMessage,
    retryLast,
    clearChat,
    startVoice,
    stopVoice,
  };
}