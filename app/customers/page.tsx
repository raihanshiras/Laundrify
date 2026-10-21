"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Plus, Search, Users, X, Phone, MapPin, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  full_name: string;
  phone: string;
  phone_normalized: string;
  address: string | null;
  notes: string | null;
  created_at: string;
};

function normalizePhone(value: string) {
  return value.replace(/[\s().-]/g, "");
}

export default function CustomersPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const loadCustomers = useCallback(async (targetShopId: string) => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from("customers")
      .select("id,full_name,phone,phone_normalized,address,notes,created_at")
      .eq("shop_id", targetShopId)
      .order("full_name", { ascending: true });
    if (queryError) throw queryError;
    setCustomers((data ?? []) as Customer[]);
  }, []);

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace("/auth"); return; }
        const { data: membership, error: membershipError } = await supabase
          .from("shop_members").select("shop_id").limit(1).maybeSingle();
        if (membershipError) throw membershipError;
        if (!membership?.shop_id) { router.replace("/onboarding"); return; }
        if (!alive) return;
        setShopId(membership.shop_id);
        await loadCustomers(membership.shop_id);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load customers.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    init();
    return () => { alive = false; };
  }, [router, loadCustomers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(customer =>
      customer.full_name.toLowerCase().includes(term) ||
      customer.phone.toLowerCase().includes(term) ||
      customer.phone_normalized.toLowerCase().includes(term)
    );
  }, [customers, search]);

  async function handleAddCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const normalized = normalizePhone(cleanPhone);
    if (!cleanName || normalized.length < 7 || normalized.length > 16) {
      setError("Enter a customer name and a valid phone number (7–16 characters after formatting is removed).");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }
      const { error: insertError } = await supabase.from("customers").insert({
        shop_id: shopId,
        full_name: cleanName,
        phone: cleanPhone,
        phone_normalized: normalized,
        address: address.trim() || null,
        notes: notes.trim() || null,
        created_by: user.id,
      });
      if (insertError) {
        if (insertError.code === "23505") throw new Error("A customer with this phone number already exists in your shop.");
        throw insertError;
      }
      await loadCustomers(shopId);
      setName(""); setPhone(""); setAddress(""); setNotes("");
      setShowForm(false);
      setSuccess("Customer added successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this customer.");
    } finally {
      setSaving(false);
    }
  }

  function openWhatsApp(customer: Customer) {
    const number = normalizePhone(customer.phone).replace(/^\+/, "");
    if (!number) return;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(`Hello ${customer.full_name}, this is your laundry shop. How can we help you today?`)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="customers-shell">
      <header className="customers-topbar">
        <button className="customers-back" type="button" onClick={() => router.push("/")}><ArrowLeft size={17} /> Dashboard</button>
        <div className="customers-brand"><span className="customers-brand-mark"><Users size={19} /></span><span>laundri<b>fy</b></span></div>
        <span className="customers-top-label">CUSTOMER MANAGEMENT</span>
      </header>
      <section className="customers-content">
        <div className="customers-heading-row">
          <div><div className="customers-eyebrow">YOUR CUSTOMER DIRECTORY</div><h1>Customers<span>.</span></h1><p>Keep customer details organized and easy to find.</p></div>
          <button className="customers-primary" type="button" onClick={() => { setShowForm(v => !v); setError(""); setSuccess(""); }}><Plus size={17} /> Add customer</button>
        </div>

        {showForm && <form className="customer-form-card" onSubmit={handleAddCustomer}>
          <div className="customer-form-title"><div><h2>Add a customer</h2><p>Save their details for faster repeat visits.</p></div><button type="button" className="customer-close" aria-label="Close form" onClick={() => setShowForm(false)}><X size={18} /></button></div>
          <div className="customer-form-grid">
            <label>Full name *<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ananya Menon" required maxLength={160} /></label>
            <label>Phone number *<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" required maxLength={24} /></label>
            <label className="customer-form-wide">Address <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Area, city (optional)" maxLength={300} /></label>
            <label className="customer-form-wide">Notes <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Preferences or useful details (optional)" rows={2} maxLength={1000} /></label>
          </div>
          {error && <div className="customer-message error" role="alert">{error}</div>}
          <div className="customer-form-actions"><button className="customer-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="customers-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Save customer</button></div>
        </form>}

        {error && !showForm && <div className="customer-message error" role="alert">{error}</div>}
        {success && <div className="customer-message success" role="status">{success}</div>}

        <div className="customers-summary"><div className="customers-summary-icon"><Users size={20} /></div><div><strong>{customers.length}</strong><span>customers in your directory</span></div><div className="customers-summary-divider" /><div className="customers-summary-note">Your customer records are private to your shop.</div></div>
        <section className="customers-list-card">
          <div className="customers-list-heading"><div><h2>Customer directory</h2><p>Search by customer name or phone number.</p></div><span className="customers-count">{filtered.length} {filtered.length === 1 ? "customer" : "customers"}</span></div>
          <div className="customers-search"><Search size={17} /><input aria-label="Search customers" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone number..." />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button>}</div>
          {loading ? <div className="customers-empty"><LoaderCircle className="spin" size={22} /><span>Loading customer records…</span></div> :
            filtered.length === 0 ? <div className="customers-empty"><div className="customers-empty-icon"><Users size={23} /></div><strong>{search ? "No matching customers" : "Your customer list starts here"}</strong><span>{search ? "Try a different name or phone number." : "Add your first customer to start building your directory."}</span>{!search && <button className="customers-primary" type="button" onClick={() => setShowForm(true)}><Plus size={16} /> Add your first customer</button>}</div> :
            <div className="customer-records">{filtered.map(customer => <article className="customer-record" key={customer.id}><div className="customer-record-avatar">{customer.full_name.trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase()).join("")}</div><div className="customer-record-main"><strong>{customer.full_name}</strong><span><Phone size={13} />{customer.phone}</span>{customer.address && <span><MapPin size={13} />{customer.address}</span>}{customer.notes && <small>{customer.notes}</small>}</div><button className="customer-whatsapp" type="button" onClick={() => openWhatsApp(customer)}><MessageCircle size={15} /> WhatsApp</button></article>)}</div>
          }
        </section>
        <p className="customers-footnote">WhatsApp opens with a prepared message. You review it and press Send in WhatsApp.</p>
      </section>
    </main>
  );
}
