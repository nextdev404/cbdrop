import React, { useState } from "react";
import { X, Sparkles, LogIn, UserPlus, ArrowRight, Eye, EyeOff, CheckCircle2, Shield, Loader2 } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useLocation } from "wouter";

export function AuthModal() {
  const { user, isAuthModalOpen, closeAuthModal, login, register, demoLogin, logout, loading } = useAuthContext();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await login({ email, password });
      } else {
        if (!name.trim()) {
          toast.error("Please enter your name");
          setSubmitting(false);
          return;
        }
        await register({ name, email, password });
      }
      setEmail("");
      setPassword("");
      setName("");
    } catch {
      // toast is handled in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setSubmitting(true);
    try {
      await demoLogin();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={closeAuthModal}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[#e4e5de] bg-[#fdfdfc] text-[#111318] shadow-2xl dark:border-white/10 dark:bg-[#16181f] dark:text-[#f7f7f2]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Ambient Blobs */}
        <div className="absolute -left-12 -top-12 size-48 rounded-full bg-[#5e5ce6]/25 blur-3xl pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 size-48 rounded-full bg-[#d8ef54]/20 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-black/5 text-[#6c6e79] transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="p-6 sm:p-8">
          {user ? (
            /* Logged-In User Profile Card */
            <div className="text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#5e5ce6] to-[#8d8bff] text-xl font-black text-white shadow-lg shadow-[#5e5ce6]/30">
                {user.name ? user.name.slice(0, 2).toUpperCase() : "CB"}
              </div>
              <h3 className="mt-3 text-xl font-black">{user.name || "Creator"}</h3>
              <p className="text-xs text-[#71737e] dark:text-[#9ea1ad]">{user.email}</p>

              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#d8ef54]/40 bg-[#d8ef54]/15 px-3 py-1 text-xs font-black text-[#56650b] dark:text-[#d8ef54]">
                <Sparkles size={12} />
                <span>{user.plan === "pro" ? "CBdrop Pro Member" : "Free Plan"}</span>
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    closeAuthModal();
                    setLocation("/dashboard");
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#5e5ce6] text-xs font-black text-white shadow transition hover:bg-[#504ed1]"
                >
                  Go to Dashboard & Workspace <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    closeAuthModal();
                  }}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl border border-[#dedfd8] bg-white text-xs font-bold text-[#bd554c] transition hover:bg-[#fff2f0] dark:border-white/10 dark:bg-white/5"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            /* Sign In / Sign Up Form */
            <>
              {/* Header */}
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#111318] text-white dark:bg-white dark:text-[#111318] shadow-md">
                  <Shield size={20} />
                </span>
                <div>
                  <h3 className="text-2xl font-black tracking-[-0.04em]">
                    {mode === "signin" ? "Welcome back" : "Create your account"}
                  </h3>
                  <p className="text-xs text-[#7c7f8a] dark:text-[#9ea1ad]">
                    {mode === "signin"
                      ? "Sign in to access your saved history & Pro perks"
                      : "Start using CBdrop with your personal account"}
                  </p>
                </div>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="mt-5 grid grid-cols-2 rounded-2xl border border-[#dedfd8] bg-[#f0f0ed] p-1 dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                    mode === "signin"
                      ? "bg-white text-[#111318] shadow-xs dark:bg-[#5e5ce6] dark:text-white"
                      : "text-[#71737e] hover:text-[#111318] dark:text-[#9ea1ad] dark:hover:text-white"
                  }`}
                >
                  <LogIn size={13} />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                    mode === "signup"
                      ? "bg-white text-[#111318] shadow-xs dark:bg-[#5e5ce6] dark:text-white"
                      : "text-[#71737e] hover:text-[#111318] dark:text-[#9ea1ad] dark:hover:text-white"
                  }`}
                >
                  <UserPlus size={13} />
                  <span>Register</span>
                </button>
              </div>

              {/* Google / Gmail Single Sign-On Button */}
              <a
                href={`/api/auth/google?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
                className="mt-4 flex h-11 w-full items-center justify-center gap-3 rounded-2xl border border-[#dedfd8] bg-white text-xs font-bold text-[#1f1f1f] shadow-xs transition hover:bg-[#f6f6f3] active:scale-[0.98] dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.34 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.98 0 12s.45 3.84 1.24 5.42l4.04-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Continue with Google (Gmail)</span>
              </a>

              {/* Divider */}
              <div className="relative my-3.5 flex items-center justify-center">
                <div className="h-px w-full bg-[#dedfd8] dark:bg-white/10" />
                <span className="absolute bg-[#fdfdfc] px-2 text-[10px] font-bold uppercase tracking-wider text-[#9395a0] dark:bg-[#16181f] dark:text-[#7d808c]">
                  Or with email
                </span>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "signup" && (
                  <div>
                    <label className="text-[11px] font-bold text-[#686b75] dark:text-[#9ea1ad]">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Creator"
                      className="mt-1 h-11 w-full rounded-xl border border-[#dedfd8] bg-white px-3.5 text-xs font-medium outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-black/20"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-[#686b75] dark:text-[#9ea1ad]">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="mt-1 h-11 w-full rounded-xl border border-[#dedfd8] bg-white px-3.5 text-xs font-medium outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-black/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#686b75] dark:text-[#9ea1ad]">Password</label>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "At least 6 characters..." : "Enter your password..."}
                      className="h-11 w-full rounded-xl border border-[#dedfd8] bg-white pl-3.5 pr-10 text-xs font-medium outline-none focus:border-[#5e5ce6] dark:border-white/10 dark:bg-black/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b8d96] hover:text-[#111318] dark:hover:text-white"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || loading}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5e5ce6] text-xs font-black text-white shadow-[0_8px_20px_rgba(94,92,230,0.3)] transition hover:bg-[#504ed1] active:scale-[0.98] disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>{mode === "signin" ? "Signing in..." : "Creating account..."}</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === "signin" ? "Sign In to CBdrop" : "Create Free Account"}</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>

              {/* 1-Click Demo Login Separator */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="h-px w-full bg-[#dedfd8] dark:bg-white/10" />
                <span className="absolute bg-[#fdfdfc] px-2 text-[10px] font-black uppercase tracking-wider text-[#9395a0] dark:bg-[#16181f] dark:text-[#7d808c]">
                  Or instant test
                </span>
              </div>

              {/* Instant Demo Account Button */}
              <button
                type="button"
                onClick={handleDemo}
                disabled={submitting || loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#d8ef54]/60 bg-[#fbfdea] text-xs font-black text-[#445207] shadow-xs transition hover:bg-[#f6fbd4] active:scale-[0.98] dark:border-[#d8ef54]/30 dark:bg-[#222718] dark:text-[#d8ef54] dark:hover:bg-[#2c331f]"
              >
                <Sparkles size={14} />
                <span>Continue as Demo Creator (1-Click Test)</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
