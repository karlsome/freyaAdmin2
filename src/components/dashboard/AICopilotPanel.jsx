import { useState, useRef, useEffect } from "react";
import { askAICopilot } from "../../services/api";

const INITIAL_MESSAGES = [
  {
    id: "welcome",
    sender: "ai",
    text: "Hello! I am connected to Gemini 3.6 Flash with direct live query access to your MongoDB manufacturing records across Kose (小瀬) & Kurachi (倉知). What would you like to inspect today?",
    timestamp: "Just now",
  },
  {
    id: "alert",
    sender: "ai",
    text: "💡 **Quick Actions**: Ask about defect spikes, machine downtime, camera feeds, or scrap cost impact, and I will query the database and reconfigure the cards for you.",
    timestamp: "Just now",
    hasAction: true,
    actionPrompt: "Highlight Quality & Defect Diagnostics",
  },
];

export default function AICopilotPanel({ onReorderCards, onReset, onClose, currentPersona, kpiContext }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputVal, setInputVal] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleNewSession = () => {
    setMessages(INITIAL_MESSAGES);
    setInputVal("");
    setIsThinking(false);
    if (onReset) {
      onReset();
    }
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputVal).trim();
    if (!query || isThinking) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setIsThinking(true);

    try {
      // Pass clean conversational turns for active session memory
      const sessionHistory = messages
        .filter((m) => m.id !== "welcome" && m.id !== "alert")
        .slice(-8)
        .map((m) => ({
          role: m.sender === "user" ? "user" : "model",
          text: m.text,
        }));

      console.log("[AICopilotPanel] Prompt submitted:", query);
      console.log("[AICopilotPanel] History sent:", sessionHistory);

      const data = await askAICopilot({
        prompt: query,
        currentPersona,
        kpiContext,
        history: sessionHistory
      });

      console.log("[AICopilotPanel] Full response received from server:", data);
      console.log("[AICopilotPanel] uiAction payload:", data.uiAction);
      console.log("[AICopilotPanel] spotlight data:", data.uiAction?.spotlight);

      if (data.uiAction?.cardOrder) {
        onReorderCards(data.uiAction.cardOrder, data.uiAction.highlightCard, data.uiAction);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: data.reply || "I analyzed your request and reorganized the dashboard layout.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error("[AICopilotPanel] Error calling AI Copilot:", err);
      // Fallback local heuristic so UI still updates smoothly even if network/offline
      const lower = query.toLowerCase();
      let fallbackReply = `I encountered a connection issue reaching the AI service (${err.message}). Reconfiguring dashboard layout based on keyword intent:`;

      if (lower.includes("finance") || lower.includes("cost") || lower.includes("scrap") || lower.includes("money")) {
        onReorderCards(["finance", "defects", "production", "telemetry", "camera", "issues"], "finance");
        fallbackReply += " Focus on Financials & Scrap.";
      } else if (lower.includes("cam") || lower.includes("camera") || lower.includes("video")) {
        onReorderCards(["camera", "telemetry", "production", "defects", "issues", "finance"], "camera");
        fallbackReply += " Focus on Cameras & Telemetry.";
      } else if (lower.includes("defect") || lower.includes("ng") || lower.includes("quality")) {
        onReorderCards(["defects", "production", "issues", "finance", "camera", "telemetry"], "defects");
        fallbackReply += " Focus on Quality & Defects.";
      } else {
        onReorderCards(["production", "defects", "camera", "telemetry", "issues", "finance"], "production");
        fallbackReply += " Focus on Plant Operations.";
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          text: fallbackReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <aside className="w-full flex flex-col h-full max-h-full rounded-[8px] bg-[var(--surface)] border border-[var(--border)] shadow-sm overflow-hidden">
      {/* ── Copilot Header ── */}
      <div className="p-3 border-b border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[6px] bg-[var(--freya-blue-subtle)] border border-[var(--border)] text-[var(--freya-blue)] flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>smart_toy</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] tracking-wide">FREYA Copilot</h3>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">Autonomous Industrial AI</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleNewSession}
            title="Start a new session (clears conversation memory)"
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border border-transparent hover:border-[var(--border)] rounded-[4px] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add_comment</span>
            <span className="hidden sm:inline">New Session</span>
          </button>

          {onReset && (
            <button
              onClick={onReset}
              title="Reset dashboard card layout"
              className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              title="Collapse assistant panel"
              className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>dock_to_right</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Active Scope Banner ── */}
      <div className="px-3.5 py-1.5 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--text-muted)] flex-shrink-0">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>domain</span>
          <span>All Facilities · Today</span>
        </span>
        <span className="font-semibold text-[var(--freya-blue)] capitalize">
          {currentPersona?.replace("_", " ") || "Custom View"}
        </span>
      </div>

      {/* ── Chat Message Stream (Takes flexible height and scrolls internally) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-[8px] p-2.5 leading-relaxed ${
                msg.sender === "user"
                  ? "bg-[var(--freya-blue)] text-white shadow-xs"
                  : "bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] shadow-2xs"
              }`}
            >
              {msg.text.split("\n").map((line, i) => (
                <p key={i} className={i > 0 ? "mt-1" : ""}>
                  {line}
                </p>
              ))}

              {msg.hasAction && msg.actionPrompt && (
                <button
                  onClick={() => handleSend(msg.actionPrompt)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[6px] bg-[var(--freya-blue)] text-white font-semibold text-[11px] hover:bg-[var(--freya-blue-hover)] transition-colors shadow-2xs"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>dashboard_customize</span>
                  <span>{msg.actionPrompt}</span>
                </button>
              )}
            </div>
            <span className="text-[9px] text-[var(--text-muted)] mt-0.5 px-1">{msg.timestamp}</span>
          </div>
        ))}
        {isThinking && (
          <div className="flex flex-col items-start">
            <div className="max-w-[90%] rounded-[8px] p-2.5 leading-relaxed bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)] shadow-2xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--freya-blue)] animate-ping flex-shrink-0" />
              <span className="text-xs italic">Gemini 3.6 analyzing manufacturing telemetry...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Intent Prompt Chips ── */}
      <div className="p-2.5 bg-[var(--surface-hover)] border-t border-[var(--border)] flex-shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-1.5">
          Suggested Layout Intents
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: "💰 Financials", prompt: "Show Financial & Scrap Impact" },
            { label: "📹 Cameras", prompt: "Inspect Line 2 Camera & Telemetry" },
            { label: "⚠️ Quality", prompt: "Highlight Quality & Defect Diagnostics" },
            { label: "🏭 Operations", prompt: "Plant Operations & Attainment" },
          ].map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleSend(chip.prompt)}
              className="text-[11px] font-medium py-1 px-2 text-left truncate rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--freya-blue)] hover:text-[var(--freya-blue)] transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input Box ── */}
      <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <label className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-1">
          Prompt Copilot
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Ask AI to reorder cards or inspect issues..."
            className="w-full h-9 pl-3 pr-9 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-hidden focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)] transition-all"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isThinking}
            aria-label="Send message to AI assistant"
            className="absolute right-1 w-7 h-7 rounded-[4px] bg-[var(--freya-blue)] text-white hover:bg-[var(--freya-blue-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>send</span>
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-1.5">
          <span>Gemini 3.6 Flash · MongoDB Atlas</span>
          <span className="text-[var(--freya-blue)] font-semibold flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isThinking ? "bg-sky-500 animate-ping" : "bg-emerald-500"}`} />
            {isThinking ? "Analyzing" : "Live"}
          </span>
        </div>
      </div>
    </aside>
  );
}

