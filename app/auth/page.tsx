"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Shirt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive || !data.session) return;
      const { data: shops } = await supabase
        .from("shop_members")
        .select("shop_id")
        .limit(1);
      if (alive) router.replace(shops?.length ? "/" : "/onboarding");
    });
    return () => { alive = false; };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: window.location.origin + "/auth",
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.replace("/onboarding");
          return;
        }
        setNotice("Account created. Check your email to confirm your address, then sign in.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        const { data: memberships, error: membershipError } = await supabase
          .from("shop_members")
          .select("shop_id")
          .limit(1);
        if (membershipError) throw membershipError;
        router.replace(memberships?.length ? "/" : "/onboarding");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <div className="auth-grid" />
        <a className="auth-brand" href="/auth"><span className="auth-brand-mark"><Shirt size={22} /></span><span>laundri<b>fy</b></span></a>
        <div className="auth-visual-copy">
          <span className="auth-kicker">A BETTER WAY TO RUN YOUR LAUNDRY</span>
          <h1>Less paperwork.<br /><span>More flow.</span></h1>
          <p>Orders, customers, payments and garment tracking — all in one calm, clear workspace.</p>
        </div>
        <div className="auth-visual-bottom"><span>BUILT FOR EVERYDAY LAUNDRY BUSINESSES</span><span>01 — SIMPLE. ORGANIZED. YOURS.</span></div>
      </section>
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><span className="auth-brand-mark"><Shirt size={20} /></span><span>laundri<b>fy</b></span></div>
          <div className="auth-heading">
            <span className="auth-kicker">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</span>
            <h2>{mode === "login" ? "Sign in to Laundrify" : "Create your account"}</h2>
            <p>{mode === "login" ? "Pick up where you left off." : "Your shop workspace starts here."}</p>
          </div>
          <div className="auth-tabs">
            <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>Sign in</button>
            <button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>Create account</button>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "signup" && <label>Full name<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required minLength={2} /></label>}
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourshop.com" required /></label>
            <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            {error && <div className="auth-alert error" role="alert">{error}</div>}
            {notice && <div className="auth-alert success" role="status">{notice}</div>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <>{mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={17} /></>}</button>
          </form>
          <p className="auth-legal">By continuing, you agree to use Laundrify responsibly and keep your account credentials secure.</p>
        </div>
      </section>
    </main>
  );
}
