import { useState, useRef, useEffect } from "react";

export default function AICopilotPanel({ onReorderCards, onReset, onClose, currentPersona }) {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "ai",
      text: "Hello! I am monitoring real-time telemetry, defect rates, and production lines across Kose & Kurachi. What would you like to inspect today?",
      timestamp: "Just now",
    },
    {
      id: "alert",
      sender: "ai",
      text: "⚠️ **Operational Notice**: Press Line 2 recorded a momentary defect rate of 3.8% (+¥36,400 scrap impact). I can bring up the live camera feed and machine temperatures for you.",
      timestamp: "Just now",
      hasAction: true,
      actionPrompt: "Inspect Line 2 Camera & Telemetry",
    },
  ]);

  const [inputVal, setInputVal] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (textToSend) => {
    const query = (textToSend || inputVal).trim();
    if (!query) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");

    // Simulate intelligent contextual response and dashboard reconfiguration
    setTimeout(() => {
      let aiReply = "I have reconfigured your dashboard to focus on the requested metrics.";
      const lower = query.toLowerCase();

      if (lower.includes("finance") || lower.includes("cost") || lower.includes("scrap") || lower.includes("money")) {
        aiReply = "Prioritizing Financials & Scrap Loss analysis. Gross value generated and defect waste cost are now front and center.";
        onReorderCards(["finance", "defects", "production", "telemetry", "camera", "issues"], "finance");
      } else if (lower.includes("cam") || lower.includes("camera") || lower.includes("video") || lower.includes("telemetry") || lower.includes("sensor")) {
        aiReply = "Bringing up live facility camera feeds and machine telemetry diagnostics side-by-side for inspection.";
        onReorderCards(["camera", "telemetry", "production", "defects", "issues", "finance"], "camera");
      } else if (lower.includes("defect") || lower.includes("ng") || lower.includes("quality")) {
        aiReply = "Highlighting Quality & Defect Diagnostics. You can review non-conformance records and threshold alerts.";
        onReorderCards(["defects", "production", "issues", "finance", "camera", "telemetry"], "defects");
      } else if (lower.includes("plant") || lower.includes("worker") || lower.includes("efficiency") || lower.includes("operations")) {
        aiReply = "Switching to Plant Operations view. Highlighting daily quota attainment and operator efficiency.";
        onReorderCards(["production", "defects", "camera", "telemetry", "issues", "finance"], "production");
      } else if (lower.includes("reset") || lower.includes("default")) {
        aiReply = "Dashboard layout has been reset to your default profile.";
        onReset && onReset();
      } else {
        aiReply = `Understood. I analyzed "${query}" and optimized your card layout to reflect current facility status.`;
        onReorderCards(["defects", "camera", "production", "telemetry", "finance", "issues"], "defects");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: aiReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 600);
  };

  return (
    <aside className="w-full lg:w-80 xl:w-96 flex flex-col h-full rounded-[8px] bg-[var(--surface)] border border-[var(--border)] shadow-sm overflow-hidden">
      {/* ── Copilot Header ── */}
      <div className="p-3.5 border-b border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-[var(--freya-blue-subtle)] border border-[var(--border)] text-[var(--freya-blue)] flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>smart_toy</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] tracking-wide">FREYA Copilot</h3>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">Autonomous Industrial Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onReset && (
            <button
              onClick={onReset}
              title="Reset dashboard layout"
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
      <div className="px-3.5 py-1.5 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>domain</span>
          <span>All Facilities · Today</span>
        </span>
        <span className="font-semibold text-[var(--freya-blue)] capitalize">
          {currentPersona?.replace("_", " ") || "Custom View"}
        </span>
      </div>

      {/* ── Chat Message Stream ── */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-hide text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-[8px] p-3 leading-relaxed ${
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
                  className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[6px] bg-[var(--freya-blue)] text-white font-semibold text-[11px] hover:bg-[var(--freya-blue-hover)] transition-colors shadow-2xs"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>dashboard_customize</span>
                  <span>{msg.actionPrompt}</span>
                </button>
              )}
            </div>
            <span className="text-[9px] text-[var(--text-muted)] mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Intent Prompt Chips ── */}
      <div className="p-3 bg-[var(--surface-hover)] border-t border-[var(--border)]">
        <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-2">
          Suggested Layout Intents
        </span>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "💰 Financials & Scrap", prompt: "Show Financial & Scrap Impact" },
            { label: "📹 Cameras & Sensors", prompt: "Inspect Line 2 Camera & Telemetry" },
            { label: "⚠️ Quality Diagnostics", prompt: "Highlight Quality & Defect Diagnostics" },
            { label: "🏭 Plant Attainment", prompt: "Plant Operations & Attainment" },
          ].map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleSend(chip.prompt)}
              className="text-xs font-medium px-2.5 py-1 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--freya-blue)] hover:text-[var(--freya-blue)] transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input Box (Placeholder) ── */}
      <div className="p-3.5 border-t border-[var(--border)] bg-[var(--surface)]">
        <label className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block mb-1.5">
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
            className="w-full h-10 pl-3 pr-10 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-hidden focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)] transition-all"
          />
          <button
            type="submit"
            disabled={!inputVal.trim()}
            aria-label="Send message to AI assistant"
            className="absolute right-1 w-8 h-8 rounded-[6px] bg-[var(--freya-blue)] text-white hover:bg-[var(--freya-blue-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
          </button>
        </form>

        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mt-2">
          <span>Gemini 2.5 Industrial · UI Preview</span>
          <span className="text-[var(--freya-blue)] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Standby
          </span>
        </div>
      </div>
    </aside>
  );
}
