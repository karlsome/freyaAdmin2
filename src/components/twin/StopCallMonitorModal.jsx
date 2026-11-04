import { useState } from "react";
import { CALL_THEMES, formatCallWait } from "../../hooks/useFactoryCallMonitor";
import { KOSE_MACHINE_IDS } from "../../data/factoryLayouts/kose";
import { SCNA_MACHINE_IDS, SCNA_TV_GRID } from "../../data/factoryLayouts/scna";
import { effectiveStatus } from "./twinTheme";

// Exact 6 rows x 5 columns grid layout from Kurachi/factory-stopcall-tv.html
const KOSE_TV_GRID = [
  "OZNC01", "OZNC02", "GAP", "OZNC11", "OZNC12",
  "OZNC03", "OZNC04", "GAP", "OZNC13", "OZNC14",
  "OZNC05", "OZNC06", "GAP", "OZNC15", "OZMANAS",
  "OZNC07", "OZNC08", "GAP", "OZNC16", "SPACER",
  "OZNC09", "OZNC10", "GAP", "SPACER", "SPACER",
  "OZNC18", "OZNC17", "GAP", "SPACER", "SPACER",
];

/**
 * Full-screen / modal view of the Factory Stop-Call & Material Request Monitor (`factory-stopcall-tv.html`).
 * Features:
 * 1. Native replica of the 6×5 physical TV board with click-to-focus on 3D machines
 * 2. Interactive 3D Call Animation Simulator (test Leader Red Pulse, 3D Box, 3D Material Roll on any machine)
 * 3. Direct embedded view of `factory-stopcall-tv.html?filter=小瀬`
 */
export default function StopCallMonitorModal({
  factory = "小瀬",
  activeCalls = [],
  callsByMachine = {},
  liveMachines = {},
  machinesById = {},
  isConnected = false,
  now = Date.now(),
  isJa = true,
  hasSimulatedCalls = false,
  onToggleSimulatedCall,
  onClearSimulatedCalls,
  onLoadDemoPreset,
  onSelectMachine,
  onClose,
}) {
  const isScna = String(factory).toUpperCase().includes("SCNA");
  const factoryMachineIds = isScna ? SCNA_MACHINE_IDS : KOSE_MACHINE_IDS;
  const factoryTvGrid = isScna ? SCNA_TV_GRID : KOSE_TV_GRID;

  const [tab, setTab] = useState("board"); // "board" | "simulator" | "iframe"
  const [simMachine, setSimMachine] = useState(() => factoryMachineIds[0] || "OZNC01");
  const [simMatSeb, setSimMatSeb] = useState("7GD-ROLL");

  const tvUrl = `https://karlsome.github.io/Kurachi/factory-stopcall-tv.html?filter=${encodeURIComponent(factory)}`;

  return (
    <div className="twin-tv-modal-backdrop" onClick={onClose}>
      <div className="twin-tv-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="twin-tv-modal__header">
          <div className="twin-tv-modal__brand">
            <span className="material-symbols-outlined twin-tv-modal__icon">tv</span>
            <div>
              <h2 className="twin-tv-modal__title">
                {factory} {isJa ? "呼び出し・部材モニター (Call Monitor TV)" : "Stop-Call & Material Monitor TV"}
              </h2>
              <div className="twin-tv-modal__sub">
                <span className={`twin-tv-card__dot ${isConnected ? "is-online" : ""}`} />
                <span>
                  {isConnected
                    ? isJa
                      ? "リアルタイムSSE接続済み"
                      : "Real-time SSE Connected"
                    : isJa
                      ? "SSE再接続待機中"
                      : "Waiting for SSE stream"}
                </span>
                {activeCalls.length > 0 && (
                  <span className="twin-tv-modal__active-pill">
                    🚨 {activeCalls.length} {isJa ? "台 呼び出し中" : "Calling"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="twin-tv-modal__tabs">
            <button
              type="button"
              className={`twin-tv-modal__tab ${tab === "board" ? "is-active" : ""}`}
              onClick={() => setTab("board")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>grid_view</span>
              {isJa ? "モニター盤面" : "Live Board"}
            </button>
            <button
              type="button"
              className={`twin-tv-modal__tab ${tab === "simulator" ? "is-active" : ""}`}
              onClick={() => setTab("simulator")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>science</span>
              {isJa ? "3Dアニメ テスト" : "Test 3D Calls"}
            </button>
            <button
              type="button"
              className={`twin-tv-modal__tab ${tab === "iframe" ? "is-active" : ""}`}
              onClick={() => setTab("iframe")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>live_tv</span>
              {isJa ? "実機TV画面" : "Physical TV HTML"}
            </button>
          </div>

          <div className="twin-tv-modal__actions">
            <a
              href={tvUrl}
              target="_blank"
              rel="noreferrer"
              className="twin-edit-btn twin-edit-btn--ghost"
              title={isJa ? "新しいタブでfactory-stopcall-tv.htmlを開く" : "Open factory-stopcall-tv.html in new tab"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
              {isJa ? "別タブで開く" : "Open TV URL"}
            </a>
            <button type="button" className="twin-icon-btn" onClick={onClose} aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>

        {/* Quick 3D Simulation Bar (always accessible at top of Board & Simulator tabs) */}
        {tab !== "iframe" && (
          <div className="twin-tv-simbar">
            <div className="twin-tv-simbar__left">
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#f59e0b" }}>
                view_in_ar
              </span>
              <span className="twin-tv-simbar__label">
                {isJa ? "3D呼出シミュレーション (実機ブザーは鳴りません):" : "3D Call Preview (Silent test):"}
              </span>
              <select
                value={simMachine}
                onChange={(e) => setSimMachine(e.target.value)}
                className="twin-tv-simbar__select"
              >
                {factoryMachineIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>

            <div className="twin-tv-simbar__buttons">
              <button
                type="button"
                className={`twin-tv-simbtn twin-tv-simbtn--leader ${callsByMachine[simMachine]?.leader ? "is-on" : ""}`}
                onClick={() => onToggleSimulatedCall?.(simMachine, "leader")}
              >
                🚨 {isJa ? "リーダー呼出 (赤パルス)" : "Leader Call (Red)"}
              </button>
              <button
                type="button"
                className={`twin-tv-simbtn twin-tv-simbtn--box ${callsByMachine[simMachine]?.box ? "is-on" : ""}`}
                onClick={() => onToggleSimulatedCall?.(simMachine, "box")}
              >
                📦 {isJa ? "空箱リクエスト (3D箱アニメ)" : "Need Box (3D Box)"}
              </button>
              <button
                type="button"
                className={`twin-tv-simbtn twin-tv-simbtn--material ${callsByMachine[simMachine]?.material ? "is-on" : ""}`}
                onClick={() => onToggleSimulatedCall?.(simMachine, "material", simMatSeb)}
              >
                🧻 {isJa ? "部材リクエスト (3Dロール)" : "Material (3D Roll)"}
              </button>
              <button
                type="button"
                className={`twin-tv-simbtn twin-tv-simbtn--stop ${callsByMachine[simMachine]?.stop ? "is-on" : ""}`}
                onClick={() => onToggleSimulatedCall?.(simMachine, "stop")}
              >
                🛑 {isJa ? "停止待ち (紫)" : "Stop Queued"}
              </button>
              <button
                type="button"
                className="twin-tv-simbtn twin-tv-simbtn--preset"
                onClick={onLoadDemoPreset}
                title={isJa ? "サンプル3台 (リーダー・空箱・部材) を一括表示" : "Load sample Leader, Box & Material calls"}
              >
                ✨ {isJa ? "サンプル一括" : "Demo Sample"}
              </button>
              {hasSimulatedCalls && (
                <button
                  type="button"
                  className="twin-tv-simbtn twin-tv-simbtn--clear"
                  onClick={onClearSimulatedCalls}
                >
                  {isJa ? "テスト解除" : "Clear Test"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body Content */}
        {tab === "board" && (
          <div className="twin-tv-board">
            {factoryTvGrid.map((cell, idx) => {
              if (cell === "GAP") {
                return <div key={`gap-${idx}`} className="twin-tv-board__gap" />;
              }
              if (cell === "SPACER") {
                return <div key={`spacer-${idx}`} className="twin-tv-board__spacer" />;
              }

              const call = callsByMachine[cell] || null;
              const live = liveMachines[cell] || null;
              const twinMachine = machinesById[cell] || null;
              const mode = live?.mode || effectiveStatus(twinMachine) || "idle";
              const sebanggo = live?.sebanggo || twinMachine?.sebanggo || twinMachine?.activeRun?.sebanggo || "";
              const totalNG = live?.totalNG || 0;
              const shortName = cell.replace(/^OZ/, "");

              let elapsed = "";
              if (call) {
                elapsed = call.waitFormatted;
              } else if (live?.mode === "running") {
                const prod = (live.prodAccumMs || 0) + (live.runSince ? now - live.runSince : 0);
                elapsed = formatCallWait(prod);
              } else if (live?.modeSince && (mode === "break" || mode === "maintenance" || mode === "check")) {
                elapsed = formatCallWait(now - live.modeSince);
              }

              const tileStateClass = call
                ? `is-calling is-calling--${call.primaryCall}`
                : mode === "running"
                  ? "is-running"
                  : mode === "break"
                    ? "is-break"
                    : mode === "maintenance"
                      ? "is-maint"
                      : "is-idle";

              return (
                <div
                  key={cell}
                  className={`twin-tv-tile ${tileStateClass}`}
                  onClick={() => {
                    onSelectMachine?.(cell);
                    onClose?.();
                  }}
                  title={isJa ? `クリックして3Dマップ上の ${cell} にフォーカス` : `Click to focus ${cell} in 3D`}
                >
                  {totalNG > 0 && <span className="twin-tv-tile__ng">NG {totalNG}</span>}

                  <div className="twin-tv-tile__left">
                    <span className="twin-tv-tile__name">{shortName}</span>
                    {call && <span className="twin-tv-tile__rank">#{call.rank}</span>}
                  </div>

                  <div className="twin-tv-tile__right">
                    {call ? (
                      <div className="twin-tv-tile__call-tags">
                        {call.leader && <span className="twin-tv-tile__tag is-leader">CALL</span>}
                        {call.stop && <span className="twin-tv-tile__tag is-stop">STOP</span>}
                        {call.box && <span className="twin-tv-tile__tag is-box">BOX 📦</span>}
                        {call.material && (
                          <span className="twin-tv-tile__tag is-material">
                            ROLL 🧻 {call.zairyoSebanggo || ""}
                          </span>
                        )}
                      </div>
                    ) : mode === "running" ? (
                      <span className="twin-tv-tile__seb">{sebanggo || "RUN"}</span>
                    ) : mode === "break" ? (
                      <span className="twin-tv-tile__mode">休憩中</span>
                    ) : mode === "maintenance" ? (
                      <span className="twin-tv-tile__mode">整備中</span>
                    ) : (
                      <span className="twin-tv-tile__idle">停止 / IDLE</span>
                    )}
                  </div>

                  <div className="twin-tv-tile__footer">
                    <span className="twin-tv-tile__status-text">
                      {call
                        ? isJa
                          ? call.theme.labelJa
                          : call.theme.labelEn
                        : mode === "running"
                          ? "稼働 / RUNNING"
                          : mode === "break"
                            ? `休憩 / BREAK ${sebanggo}`
                            : mode === "maintenance"
                              ? `整備 / MAINT ${sebanggo}`
                              : "停止 / IDLE"}
                    </span>
                    {elapsed && <span className="twin-tv-tile__elapsed">{elapsed}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "simulator" && (
          <div className="twin-tv-simgrid">
            <div className="twin-tv-simgrid__intro">
              <div>
                <h3>
                  {isJa
                    ? "設備別 3D呼出・箱・部材アニメーション テストパネル"
                    : "Per-Machine 3D Call, Box & Material Animation Tester"}
                </h3>
                <p>
                  {isJa
                    ? "各設備のボタンをクリックすると、3Dマップ上の該当設備に「赤パルス（リーダー呼出）」「3D段ボール箱アニメーション（空箱）」「3Dロール回転アニメーション（部材）」が即座に表示されます。"
                    : "Toggle any call type below to immediately see the 3D Red Pulse, 3D Bouncing Cardboard Box, or 3D Rotating Material Roll on that machine in the 3D scene."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-300 font-semibold">
                  {isJa ? "部材背番号 (Material ID):" : "Material ID:"}
                </label>
                <input
                  type="text"
                  value={simMatSeb}
                  onChange={(e) => setSimMatSeb(e.target.value)}
                  className="twin-tv-simbar__select"
                  style={{ width: 110 }}
                  placeholder="7GD-R02"
                />
              </div>
            </div>

            <div className="twin-tv-simgrid__cards">
              {factoryMachineIds.map((mId) => {
                const c = callsByMachine[mId];
                return (
                  <div key={mId} className={`twin-tv-simcard ${c ? "is-active" : ""}`}>
                    <div className="twin-tv-simcard__head">
                      <button
                        type="button"
                        className="twin-tv-simcard__title"
                        onClick={() => {
                          onSelectMachine?.(mId);
                          onClose?.();
                        }}
                      >
                        <span>{mId}</span>
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                          my_location
                        </span>
                      </button>
                      {c && <span className="twin-tv-simcard__rank">#{c.rank} · {c.waitFormatted}</span>}
                    </div>
                    <div className="twin-tv-simcard__btns">
                      <button
                        type="button"
                        className={`twin-tv-mini-btn is-leader ${c?.leader ? "is-on" : ""}`}
                        onClick={() => onToggleSimulatedCall?.(mId, "leader")}
                      >
                        🚨 {isJa ? "呼出" : "Leader"}
                      </button>
                      <button
                        type="button"
                        className={`twin-tv-mini-btn is-box ${c?.box ? "is-on" : ""}`}
                        onClick={() => onToggleSimulatedCall?.(mId, "box")}
                      >
                        📦 {isJa ? "空箱" : "Box"}
                      </button>
                      <button
                        type="button"
                        className={`twin-tv-mini-btn is-material ${c?.material ? "is-on" : ""}`}
                        onClick={() => onToggleSimulatedCall?.(mId, "material", simMatSeb)}
                      >
                        🧻 {isJa ? "部材" : "Roll"}
                      </button>
                      <button
                        type="button"
                        className={`twin-tv-mini-btn is-stop ${c?.stop ? "is-on" : ""}`}
                        onClick={() => onToggleSimulatedCall?.(mId, "stop")}
                      >
                        🛑 {isJa ? "停止" : "Stop"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "iframe" && (
          <div className="twin-tv-modal__iframe-wrap">
            <iframe
              src={tvUrl}
              title="Factory Stop-Call TV Monitor"
              className="twin-tv-modal__iframe"
              allow="autoplay"
            />
          </div>
        )}
      </div>
    </div>
  );
}

