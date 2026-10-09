import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth, type OAuthProvider } from "./auth";
import { btnGhost, btnPrimary, fieldClass, labelClass, linkClass } from "@/features/digital/components";
import { useT } from "@/i18n";
import { LanguageSwitch } from "@/i18n/LanguageSwitch";

type Mode = "signin" | "signup" | "reset";

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}

/** Full-page frame used by the sign-in screen and the access messages. */
export function AuthFrame({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="theme-legacylift min-h-screen flex flex-col">
      <header className="bg-ll-sidebar px-4 py-4 sm:px-8 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 font-heading text-xl font-extrabold text-ll-sidebar-foreground">
          <span className="inline-block h-5 w-5 rounded-sm bg-ll-highlight" aria-hidden="true" />
          LegacyLift
        </span>
        <LanguageSwitch />
      </header>
      <main className="flex-1 flex items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary mb-2">{eyebrow}</p>
          <h1 className="font-heading text-3xl font-bold mb-6">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthScreen({
  eyebrow,
  title,
  intro,
  deviceOption,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  /** Offer to continue without an account (data stays on this device). */
  deviceOption?: { label: string; onChoose: () => void };
}) {
  const t = useT();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function continueWith(provider: OAuthProvider) {
    setBusy(true);
    setError(null);
    try {
      await auth.signInWith(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Something went wrong. Please try again."));
      setBusy(false);
    }
  }

  if (auth.recovering) return <NewPassword />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signin") await auth.signIn(email, password);
      if (mode === "signup") {
        const mustConfirm = await auth.signUp(email, password, fullName);
        if (mustConfirm) {
          setMessage(t("We sent a confirmation link to {email}. Open it, then sign in here.", { email: email.trim() }));
          setMode("signin");
        }
      }
      if (mode === "reset") {
        await auth.sendPasswordReset(email);
        setMessage(t("If {email} has an account, a link to choose a new password is on its way.", { email: email.trim() }));
        setMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      className={`flex-1 rounded px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </button>
  );

  return (
    <AuthFrame eyebrow={eyebrow} title={title}>
      {intro && <p className="text-sm text-muted-foreground mb-6 -mt-3">{intro}</p>}
      <div className="rounded-lg border border-border bg-card p-6 flex flex-col gap-4">
        {mode !== "reset" && (
          <div role="tablist" aria-label={t("Account")} className="flex gap-1 rounded-md border border-border p-1">
            {tab("signin", t("Sign in"))}
            {tab("signup", t("Create account"))}
          </div>
        )}
        {mode !== "reset" && (
          <div className="flex flex-col gap-2">
            <button type="button" className={`${btnGhost} w-full py-2.5`} disabled={busy} onClick={() => void continueWith("google")}>
              <GoogleLogo /> {t("Continue with Google")}
            </button>
            <button type="button" className={`${btnGhost} w-full py-2.5`} disabled={busy} onClick={() => void continueWith("azure")}>
              <MicrosoftLogo /> {t("Continue with Microsoft")}
            </button>
            <p className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
              {t("or with email")}
            </p>
          </div>
        )}
        {mode === "reset" && <p className="text-sm">{t("Enter your email and we'll send you a link to choose a new password.")}</p>}
        {message && (
          <p role="status" className="rounded-md bg-ll-success/10 border border-ll-success/40 px-3 py-2 text-sm">
            {message}
          </p>
        )}
        <form className="flex flex-col gap-3" onSubmit={submit}>
          {mode === "signup" && (
            <label className={labelClass}>
              {t("Your name")}
              <input id="auth-name" autoComplete="name" className={fieldClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
          )}
          <label className={labelClass}>
            {t("Email")}
            <input id="auth-email" type="email" required autoComplete="email" className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode !== "reset" && (
            <label className={labelClass}>
              {mode === "signup" ? t("Password (at least 8 characters)") : t("Password")}
              <input
                id="auth-password"
                type="password"
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className={fieldClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {mode === "signin" ? t("Sign in") : mode === "signup" ? t("Create account") : t("Send reset link")}
          </button>
        </form>
        {mode === "signup" && (
          <p className="text-xs text-muted-foreground">
            {t("Your account and business data are private: only you and your LegacyLift adviser can see them.")}{" "}
            {t("By creating an account you agree to the")}{" "}
            <Link to="/terms" className={linkClass}>
              {t("Terms of use")}
            </Link>{" "}
            {t("and the")}{" "}
            <Link to="/privacy" className={linkClass}>
              {t("Privacy policy")}
            </Link>
            .
          </p>
        )}
        {mode === "signin" && (
          <button type="button" className={`${linkClass} self-start text-sm`} onClick={() => setMode("reset")}>
            {t("Forgot your password?")}
          </button>
        )}
        {mode === "reset" && (
          <button type="button" className={`${linkClass} self-start text-sm`} onClick={() => setMode("signin")}>
            {t("Back to sign in")}
          </button>
        )}
      </div>
      {deviceOption && (
        <div className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
          <span>{t("Just looking?")}</span>
          <button type="button" className={`${btnGhost} self-start`} onClick={deviceOption.onChoose}>
            {deviceOption.label}
          </button>
        </div>
      )}
    </AuthFrame>
  );
}

function NewPassword() {
  const t = useT();
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthFrame eyebrow={t("Account")} title={t("Choose a new password")}>
      <form
        className="rounded-lg border border-border bg-card p-6 flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await auth.setNewPassword(password);
          } catch (err) {
            setError(err instanceof Error ? err.message : t("Couldn't change the password."));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className={labelClass}>
          {t("New password (at least 8 characters)")}
          <input id="new-password" type="password" required minLength={8} autoComplete="new-password" className={fieldClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button type="submit" className={btnPrimary} disabled={busy}>
          {t("Save new password")}
        </button>
      </form>
    </AuthFrame>
  );
}

/** Spinner shown while the saved session is checked. */
export function AuthLoading({ text }: { text?: string }) {
  const t = useT();
  return (
    <div className="theme-legacylift min-h-screen flex items-center justify-center">
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} aria-hidden="true" /> {text ?? t("Checking your account…")}
      </p>
    </div>
  );
}
