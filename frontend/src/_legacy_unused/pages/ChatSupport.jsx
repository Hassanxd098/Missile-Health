import { useState } from "react";
import Topbar from "../components/Topbar";
import Card, { Button, inputClass } from "../components/ui";
import client from "../api/client";

export default function ChatSupport() {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([
    { from: "ai", text: "Ask me for any of your documents — e.g. \"Show my prescription from Dr. Ananya\"." },
  ]);
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!text.trim()) return;
    const query = text;
    setMessages((m) => [...m, { from: "patient", text: query }]);
    setText("");
    setLoading(true);
    try {
      const { data } = await client.post("/chat/query", { text: query });
      let reply;
      if (data.found && !data.ambiguous) {
        reply = `Found it — ${data.document.type} from ${data.document.doctorName || "your record"} dated ${data.document.date}. (ref ${data.document.refId})`;
      } else if (data.ambiguous) {
        reply = `I found ${data.options.length} matching documents — could you narrow it down (e.g. by doctor or date)?`;
      } else {
        reply = data.message + (data.relatedSuggestions?.length ? " Closest related: " + data.relatedSuggestions.map((d) => d.type).join(", ") : "");
      }
      setMessages((m) => [...m, { from: "ai", text: reply }]);
    } catch (e) {
      setMessages((m) => [...m, { from: "ai", text: e.response?.data?.error || "Please complete onboarding first." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="AI Chat Support" subtitle="Module 7 — instant, conversational access to your own records" />
      <div className="flex-1 p-8 max-w-2xl flex flex-col">
        <Card className="flex-1 flex flex-col min-h-[420px]">
          <div className="flex-1 space-y-3 overflow-y-auto mb-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "patient" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                    m.from === "patient" ? "bg-[var(--color-primary)] text-white rounded-tr-sm" : "bg-[var(--color-bg)] rounded-tl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && <div className="text-xs text-[var(--color-ink-soft)]">Searching your records…</div>}
          </div>
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="Ask about a document…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <Button onClick={send}>Send</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
