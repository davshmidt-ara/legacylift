import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { amIStaff, claimInvites } from "./api";
import { currentLang, translate as tr } from "@/i18n";

/** Sign-in providers besides email: Google and Microsoft (Supabase calls Microsoft "azure"). */
export type OAuthProvider = "google" | "azure";

interface AuthApi {
  /** False until the saved session (if any) has been checked. */
  ready: boolean;
  session: Session | null;
  email: string;
  /** Set when the signed-in user is on our team. */
  staff: { displayName: string } | null;
  /** True while membership and team access are being checked after sign-in. */
  checking: boolean;
  /** True once team access has been checked for the signed-in user. */
  accessReady: boolean;
  /** The user followed a password-reset link and must choose a new password. */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true when the user must confirm their email before signing in. */
  signUp: (email: string, password: string, fullName?: string) => Promise<boolean>;
  /** Leaves the site for Google or Microsoft and comes back signed in. */
  signInWith: (provider: OAuthProvider) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  setNewPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Accept any new invites and re-check team access. */
  refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

const returnUrl = () => `${window.location.origin}${window.location.pathname}`;

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return tr("That email and password don't match. Check them, or reset your password.");
  if (/email not confirmed/i.test(message)) return tr("Please confirm your email first. We sent you a link when you created the account.");
  if (/already registered|already been registered/i.test(message)) return tr("There is already an account with this email. Sign in instead.");
  if (/password should be at least/i.test(message)) return tr("Choose a password with at least 8 characters.");
  if (/rate limit|too many/i.test(message)) return tr("Too many attempts. Please wait a minute and try again.");
  if (/failed to fetch|network/i.test(message)) return tr("Can't reach the server. Check your internet connection.");
  if (/provider is not enabled|unsupported provider/i.test(message)) return tr("This sign-in option isn't switched on yet. Please use your email and password.");
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<AuthApi["staff"]>(null);
  const [checking, setChecking] = useState(false);
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  const refreshAccess = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      setStaff(null);
      return;
    }
    setChecking(true);
    try {
      await claimInvites().catch(() => 0);
      setStaff(await amIStaff(user.id));
    } catch {
      setStaff(null);
    } finally {
      setChecking(false);
      setCheckedFor(user.id);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
      if (data.session) void refreshAccess();
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setStaff(null);
      // Supabase advises against awaiting other calls inside this callback.
      if (event === "SIGNED_IN" || event === "USER_UPDATED") setTimeout(() => void refreshAccess(), 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [refreshAccess]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(friendly(error.message));
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName = "") => {
    if (password.length < 8) throw new Error(tr("Choose a password with at least 8 characters."));
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: returnUrl(), data: { full_name: fullName.trim(), language: currentLang() } },
    });
    if (error) throw new Error(friendly(error.message));
    return !data.session;
  }, []);

  const signInWith = useCallback(async (provider: OAuthProvider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      // Microsoft only shares the email address when asked for it.
      options: { redirectTo: returnUrl(), scopes: provider === "azure" ? "email openid profile" : undefined },
    });
    if (error) throw new Error(friendly(error.message));
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: returnUrl() });
    if (error) throw new Error(friendly(error.message));
  }, []);

  const setNewPassword = useCallback(async (password: string) => {
    if (password.length < 8) throw new Error(tr("Choose a password with at least 8 characters."));
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(friendly(error.message));
    setRecovering(false);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setStaff(null);
  }, []);

  const api = useMemo<AuthApi>(
    () => ({
      ready,
      session,
      email: session?.user.email ?? "",
      staff,
      checking,
      accessReady: Boolean(session) && checkedFor === session?.user.id,
      recovering,
      signIn,
      signUp,
      signInWith,
      sendPasswordReset,
      setNewPassword,
      signOut,
      refreshAccess,
    }),
    [ready, session, staff, checking, checkedFor, recovering, signIn, signUp, signInWith, sendPasswordReset, setNewPassword, signOut, refreshAccess],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

/** The signed-in account, or null when this page has no sign-in (trying LegacyLift without an account). */
export function useOptionalAuth() {
  return useContext(AuthContext);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
