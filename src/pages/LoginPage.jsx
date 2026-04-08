import { useState } from "react";
import { loginUser } from "../services/authApi";

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

export default function LoginPage({ isDark, onToggleTheme, onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    setError("");
    setBusy(true);

    try {
      const authUser = await loginUser(form);
      onLogin?.(authUser);
    } catch (submitError) {
      setError(submitError?.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background dark:bg-transparent">
      <div className="pointer-events-none absolute inset-0 overflow-hidden dark:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(73,75,214,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,104,123,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.8),rgba(245,247,255,0.94))]" />
        <div className="absolute -left-20 top-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-tertiary/10 blur-3xl" />
      </div>

      <section className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-primary/15 bg-white/80 shadow-[0_40px_120px_rgba(73,75,214,0.14)] backdrop-blur-2xl dark:border-primary/15 dark:bg-[rgba(14,16,28,0.66)] dark:shadow-[0_40px_140px_rgba(0,0,0,0.48)] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative overflow-hidden border-b border-primary/10 px-6 py-8 sm:px-8 lg:border-b-0 lg:border-r lg:px-10 lg:py-10">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(73,75,214,0.1),transparent_34%,rgba(0,104,123,0.09))] dark:bg-[linear-gradient(135deg,rgba(192,193,255,0.08),transparent_34%,rgba(76,214,255,0.08))]" />
            <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.08)_1px,transparent_1px)] [background-size:28px_28px] dark:opacity-40" />

            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-primary dark:border-primary/20 dark:bg-white/5 dark:text-primary">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>shield_lock</span>
                    Auth Gateway
                  </span>
                  <h1 className="mt-5 max-w-md text-4xl font-black tracking-[-0.04em] text-on-surface sm:text-5xl">
                    Freya Admin 2
                  </h1>
                  <p className="mt-4 max-w-lg text-sm leading-6 text-on-surface/70 sm:text-base">
                    Sign in with the same account you use in the original Freya Admin. This React workspace keeps the same login contract while matching the newer control-room interface.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-white/70 text-on-surface transition-all hover:border-primary/30 hover:bg-white dark:bg-white/5 dark:text-on-surface dark:hover:bg-white/10"
                  aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                  title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                >
                  <span className="material-symbols-outlined">{isDark ? "light_mode" : "dark_mode"}</span>
                </button>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3 lg:mt-auto lg:gap-4">
                {FEATURE_CARDS.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-[24px] border border-primary/10 bg-white/72 p-4 shadow-[0_14px_40px_rgba(73,75,214,0.08)] dark:border-white/8 dark:bg-white/5 dark:shadow-none"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-outline">{card.label}</p>
                    <p className="mt-3 text-sm font-black tracking-tight text-on-surface sm:text-base">{card.value}</p>
                    <p className="mt-2 text-xs leading-5 text-on-surface/65">{card.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
            <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-outline">Access</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-on-surface">Login</h2>
                <p className="mt-3 text-sm leading-6 text-on-surface/70">
                  Enter your username and password. Your role and assigned factories are loaded into the same client session used across the rest of Freya Admin 2.
                </p>
              </div>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-outline">Username</span>
                  <div className="group flex items-center gap-3 rounded-[22px] border border-primary/12 bg-white/92 px-4 py-3 shadow-[0_10px_30px_rgba(73,75,214,0.06)] transition-all focus-within:border-primary/30 focus-within:shadow-[0_16px_44px_rgba(73,75,214,0.12)] dark:border-white/8 dark:bg-white/5 dark:shadow-none">
                    <span className="material-symbols-outlined text-outline transition-colors group-focus-within:text-primary">person</span>
                    <input
                      autoComplete="username"
                      className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-outline/70"
                      name="username"
                      onChange={(event) => updateField("username", event.target.value)}
                      placeholder="Enter username"
                      type="text"
                      value={form.username}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-outline">Password</span>
                  <div className="group flex items-center gap-3 rounded-[22px] border border-primary/12 bg-white/92 px-4 py-3 shadow-[0_10px_30px_rgba(73,75,214,0.06)] transition-all focus-within:border-primary/30 focus-within:shadow-[0_16px_44px_rgba(73,75,214,0.12)] dark:border-white/8 dark:bg-white/5 dark:shadow-none">
                    <span className="material-symbols-outlined text-outline transition-colors group-focus-within:text-primary">key</span>
                    <input
                      autoComplete="current-password"
                      className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-outline/70"
                      name="password"
                      onChange={(event) => updateField("password", event.target.value)}
                      placeholder="Enter password"
                      type="password"
                      value={form.password}
                    />
                  </div>
                </label>

                {error ? (
                  <div className="rounded-[20px] border border-error/20 bg-error/8 px-4 py-3 text-sm text-error dark:border-error/25 dark:bg-error/10">
                    {error}
                  </div>
                ) : null}

                <button
                  className="flex w-full items-center justify-center gap-2 rounded-[22px] kinetic-gradient px-4 py-3.5 text-sm font-bold text-white shadow-[0_18px_46px_rgba(73,75,214,0.28)] transition-all hover:translate-y-[-1px] hover:shadow-[0_22px_54px_rgba(73,75,214,0.36)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={busy}
                  type="submit"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {busy ? "hourglass_top" : "login"}
                  </span>
                  {busy ? "Signing in..." : "Login"}
                </button>
              </form>

              <div className="mt-6 rounded-[22px] border border-primary/12 bg-primary/6 px-4 py-4 text-xs leading-5 text-on-surface/70 dark:border-white/8 dark:bg-white/5">
                The session is stored in localStorage under <span className="font-bold text-on-surface">authUser</span>, matching the original admin app so existing role-aware pages continue to work after sign-in.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}