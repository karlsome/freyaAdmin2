import { useEffect, useRef, useState } from "react";
import { loginUser } from "../services/authApi";
import { useLanguage } from "../contexts/LanguageContext";

const FEATURE_CARDS = [
  {
    label: "Same backend",
    value: "/login",
    note: "Uses the original Freya Admin authentication endpoint.",
  },
  {
    label: "Role-aware",
    value: "Admin · 班長 · 課長",
    note: "The stored session keeps the fields the React workspaces already rely on.",
  },
  {
    label: "Session key",
    value: "authUser",
    note: "Compatible with the legacy app's localStorage contract.",
  },
];

const LOGIN_BACKGROUND_IMAGE =
  "https://cdnb.artstation.com/p/assets/images/images/061/856/493/large/yan-ru-b2.jpg?1681803254";

const LOGIN_VIEW_TRANSITION_PREP_MS = 220;
const LOGIN_FALLBACK_MORPH_MS = 440;
const REDUCED_MOTION_EXIT_DURATION_MS = 60;

function supportsViewTransitions() {
  return typeof document !== "undefined" && typeof document.startViewTransition === "function";
}

function getLoginExitDelay() {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return REDUCED_MOTION_EXIT_DURATION_MS;
  }

  return supportsViewTransitions() ? LOGIN_VIEW_TRANSITION_PREP_MS : LOGIN_FALLBACK_MORPH_MS;
}

export default function LoginPage({ isDark, onToggleTheme, onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transitionState, setTransitionState] = useState("idle");
  const { t } = useLanguage();
  const handoffTimerRef = useRef(null);
  const canUseViewTransitions = supportsViewTransitions();
  const isHandingOff = transitionState === "success";
  const isLocked = busy || isHandingOff;

  useEffect(() => () => {
    if (handoffTimerRef.current) {
      window.clearTimeout(handoffTimerRef.current);
    }
  }, []);

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isLocked) return;

    setError("");
    setBusy(true);

    try {
      const authUser = await loginUser(form);
      setBusy(false);
      setTransitionState("success");

      handoffTimerRef.current = window.setTimeout(() => {
        handoffTimerRef.current = null;

        Promise.resolve(onLogin?.(authUser)).catch((transitionError) => {
          setTransitionState("idle");
          setError(transitionError?.message || "Unable to open the workspace.");
        });
      }, getLoginExitDelay());
    } catch (submitError) {
      setTransitionState("idle");
      setError(submitError?.message || "Unable to sign in.");
      setBusy(false);
    }
  }

  return (
    <div className={`login-scene relative h-[100svh] overflow-x-hidden overflow-y-auto bg-background dark:bg-transparent ${isHandingOff ? "login-scene--handoff" : ""} ${isHandingOff && !canUseViewTransitions ? "login-scene--handoff-fallback" : ""}`}>
      <div className="login-backdrop pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${LOGIN_BACKGROUND_IMAGE})` }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(245,248,255,0.38),rgba(235,243,255,0.18),rgba(15,23,42,0.12))] dark:bg-[linear-gradient(135deg,rgba(8,10,18,0.58),rgba(8,10,18,0.42),rgba(8,10,18,0.76))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(73,75,214,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,104,123,0.1),transparent_32%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(192,193,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(76,214,255,0.12),transparent_28%)]" />
        <div className="absolute -left-20 top-12 h-64 w-64 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-tertiary/12 blur-3xl" />
      </div>

      <section className="login-stage relative z-10 flex min-h-[100svh] items-start justify-center px-3 py-4 sm:px-6 sm:py-8 lg:min-h-screen lg:items-center lg:px-8">
        <div className={`login-frost-card relative grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/28 bg-white/[0.14] shadow-[0_40px_120px_rgba(15,23,42,0.18)] backdrop-blur-[30px] backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.08] dark:shadow-[0_40px_140px_rgba(0,0,0,0.44)] sm:rounded-[36px] lg:grid-cols-[0.92fr_1.08fr] ${isHandingOff && canUseViewTransitions ? "login-frost-card--handoff" : ""}`}>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.24),rgba(255,255,255,0.1)_42%,rgba(255,255,255,0.16))] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03)_42%,rgba(255,255,255,0.06))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.04),transparent_34%)]" />
            <div className="absolute inset-px rounded-[35px] border border-white/18 dark:border-white/8" />
          </div>

          <div className="login-frost-card__content order-2 relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8 lg:order-2 lg:px-10 lg:py-10">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.22),rgba(255,255,255,0.06)_38%,rgba(73,75,214,0.08))] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)_38%,rgba(192,193,255,0.06))]" />
            <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:28px_28px] dark:opacity-15" />

            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/24 bg-white/18 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary dark:border-white/12 dark:bg-white/8 dark:text-primary">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>shield_lock</span>
                    Auth Gateway
                  </span>
                  <h1 className="mt-5 max-w-md text-3xl font-semibold tracking-[-0.04em] text-on-surface sm:text-4xl xl:text-5xl">
                    Freya Admin 2
                  </h1>
                  <p className="mt-4 max-w-lg text-sm leading-6 text-on-surface/70 dark:text-white/82 sm:text-base">
                    Sign in with the same account you use in the original Freya Admin. This React workspace keeps the same login contract while matching the newer control-room interface.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/24 bg-white/16 text-on-surface backdrop-blur-xl transition-all hover:border-white/40 hover:bg-white/26 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/12 dark:bg-white/8 dark:text-on-surface dark:hover:bg-white/12"
                  disabled={isLocked}
                  aria-label={isDark ? t("switchToLight") : t("switchToDark")}
                  title={isDark ? t("switchToLight") : t("switchToDark")}
                >
                  <span className="material-symbols-outlined">{isDark ? "light_mode" : "dark_mode"}</span>
                </button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:mt-auto lg:gap-4">
                {FEATURE_CARDS.map((card) => (
                  <div
                    key={card.label}
                    className="login-feature-card rounded-[24px] border border-white/18 bg-white/[0.2] p-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/12 dark:bg-[rgba(7,11,20,0.2)] dark:shadow-none"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-outline dark:text-white/78">{card.label}</p>
                    <p className="mt-3 text-sm font-semibold tracking-tight text-on-surface dark:text-white sm:text-base">{card.value}</p>
                    <p className="mt-2 text-xs leading-5 text-on-surface/65 dark:text-white/88">{card.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="login-frost-card__content order-1 relative border-b border-white/14 px-5 py-6 sm:px-8 sm:py-8 lg:order-1 lg:border-b-0 lg:border-r lg:border-white/12 lg:px-10 lg:py-10">
            <div className="mx-auto flex h-full w-full max-w-none flex-col justify-center sm:max-w-md lg:max-w-[29rem]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline dark:text-white/72">Access</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-on-surface sm:text-3xl">{t("loginTitle")}</h2>
                <p className="login-status-copy mt-3 text-sm leading-6 text-on-surface/70 dark:text-white/82">
                  {isHandingOff
                    ? "Credentials verified. Syncing your dashboard surface and restoring your assigned access now."
                    : "Enter your username and password. Your role and assigned factories are loaded into the same client session used across the rest of Freya Admin 2."}
                </p>
              </div>

              <form className="login-form-stack mt-6 space-y-4 sm:mt-8 sm:space-y-5" onSubmit={handleSubmit} aria-busy={isLocked}>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-outline dark:text-white/80">{t("username")}</span>
                  <div className="group flex items-center gap-3 rounded-[22px] border border-primary/12 bg-white/92 px-4 py-3 shadow-[0_10px_30px_rgba(73,75,214,0.06)] transition-all focus-within:border-primary/30 focus-within:shadow-[0_16px_44px_rgba(73,75,214,0.12)] dark:border-white/14 dark:bg-[rgba(7,11,20,0.18)] dark:shadow-none">
                    <span className="material-symbols-outlined text-outline transition-colors group-focus-within:text-primary dark:text-white/72 dark:group-focus-within:text-white">person</span>
                    <input
                      autoComplete="username"
                      className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-outline/70 dark:text-white dark:placeholder:text-white/72"
                      disabled={isLocked}
                      name="username"
                      onChange={(event) => updateField("username", event.target.value)}
                      placeholder={t("enterUsername")}
                      type="text"
                      value={form.username}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-outline dark:text-white/80">{t("password")}</span>
                  <div className="group flex items-center gap-3 rounded-[22px] border border-primary/12 bg-white/92 px-4 py-3 shadow-[0_10px_30px_rgba(73,75,214,0.06)] transition-all focus-within:border-primary/30 focus-within:shadow-[0_16px_44px_rgba(73,75,214,0.12)] dark:border-white/14 dark:bg-[rgba(7,11,20,0.18)] dark:shadow-none">
                    <span className="material-symbols-outlined text-outline transition-colors group-focus-within:text-primary dark:text-white/72 dark:group-focus-within:text-white">key</span>
                    <input
                      autoComplete="current-password"
                      className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-outline/70 dark:text-white dark:placeholder:text-white/72"
                      disabled={isLocked}
                      name="password"
                      onChange={(event) => updateField("password", event.target.value)}
                      placeholder={t("enterPassword")}
                      type="password"
                      value={form.password}
                    />
                  </div>
                </label>

                {error ? (
                  <div className="rounded-[20px] border border-error/20 bg-white/50 px-4 py-3 text-sm text-error backdrop-blur-lg dark:border-error/25 dark:bg-error/10">
                    {error}
                  </div>
                ) : null}

                <button
                  className="flex w-full items-center justify-center gap-2 rounded-[22px] kinetic-gradient px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_46px_rgba(73,75,214,0.28)] transition-all hover:translate-y-[-1px] hover:shadow-[0_22px_54px_rgba(73,75,214,0.36)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isLocked}
                  type="submit"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {busy ? "hourglass_top" : isHandingOff ? "check_circle" : "login"}
                  </span>
                  {busy ? t("loading") : isHandingOff ? t("loading") : t("loginTitle")}
                </button>
              </form>

              <div className="login-status-card mt-5 rounded-[22px] border border-white/18 bg-white/[0.18] px-4 py-4 text-xs leading-5 text-on-surface/72 backdrop-blur-xl dark:border-white/12 dark:bg-[rgba(7,11,20,0.2)] dark:text-white/90 sm:mt-6">
                The session is stored in localStorage under <span className="font-semibold text-on-surface dark:text-white">authUser</span>, matching the original admin app so existing role-aware pages continue to work after sign-in.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}