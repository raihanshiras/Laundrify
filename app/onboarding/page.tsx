"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, LogOut, MapPin, Phone, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/auth");
        return;
      }
      const { data: memberships } = await supabase.from("shop_members").select("shop_id").limit(1);
      if (memberships?.length) {
        router.replace("/");
        return;
      }
      if (alive) setChecking(false);
    }
    check();
    return () => { alive = false; };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/auth");
        return;
      }
      const { data: shopId, error: createError } = await supabase.rpc("create_shop", {
        shop_name: shopName.trim(),
        shop_phone: phone.trim() || null,
      });
      if (createError) throw createError;

      if (address.trim()) {
        const { error: updateError } = await supabase.from("shops")
          .update({ address: address.trim() })
          .eq("id", shopId);
        if (updateError) throw updateError;
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your shop. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/auth");
  }

  if (checking) return <main className="onboarding-loading"><LoaderCircle className="spin" size={24} /><span>Preparing your workspace…</span></main>;

  return (
    <main className="onboarding-shell">
      <header className="onboarding-top"><a className="auth-brand" href="/"><span className="auth-brand-mark"><Store size={21} /></span><span>laundri<b>fy</b></span></a><button className="onboarding-signout" onClick={signOut} type="button"><LogOut size={16} /> Sign out</button></header>
      <section className="onboarding-content">
        <div className="onboarding-step">STEP 01 <span /> YOUR WORKSPACE</div>
        <h1>Let&apos;s set up your shop.</h1>
        <p className="onboarding-intro">This is the workspace where you&apos;ll manage orders, customers and payments. You can update these details later.</p>
        <form className="onboarding-form" onSubmit={handleSubmit}>
          <label>Shop name <span className="required">*</span><div className="onboarding-input"><Store size={18} /><input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Fresh Fold Laundry" required minLength={2} maxLength={120} /></div></label>
          <label>Business phone <span className="optional">OPTIONAL</span><div className="onboarding-input"><Phone size={18} /><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" /></div></label>
          <label>Shop address <span className="optional">OPTIONAL</span><div className="onboarding-input"><MapPin size={18} /><input value={address} onChange={e => setAddress(e.target.value)} placeholder="Area, city" /></div></label>
          {error && <div className="auth-alert error" role="alert">{error}</div>}
          <button className="auth-submit onboarding-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <>Create shop workspace <ArrowRight size={17} /></>}</button>
          <p className="onboarding-note">Your shop starts with a private workspace. Other Laundrify businesses cannot access its data.</p>
        </form>
      </section>
    </main>
  );
}
