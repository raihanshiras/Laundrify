"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Cake, Check, ChevronRight, LoaderCircle, MessageCircle,
  Search, Send, Tag, Users, WandSparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { LoadingScreen } from "@/components/loading-screen";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  full_name: string;
  phone: string;
  phone_normalized: string;
};

type TemplateId = "inactive" | "festival" | "discount" | "custom";

const templates: {
  id: TemplateId;
  title: string;
  description: string;
  icon: typeof MessageCircle;
  message: string;
}[] = [
  {
    id: "inactive",
    title: "We miss you",
    description: "Welcome a customer back",
    icon: MessageCircle,
    message: "Hi {name}! 👋 It’s been a while since we last saw you at {shop}. We’d love to take care of your laundry again. Drop by whenever you need us — we’ll be happy to help!",
  },
  {
    id: "festival",
    title: "Festival wishes",
    description: "Celebrate a special occasion",
    icon: Cake,
    message: "Hi {name}! 🎉 Happy {festival} from everyone at {shop}. Wishing you and your family happiness and wonderful celebrations. When your festive outfits need a little extra care, we’re here for you!",
  },
  {
    id: "discount",
    title: "Special offer",
    description: "Share a discount",
    icon: Tag,
    message: "Hi {name}! ✨ A little something from {shop}: enjoy {discount}% off your next laundry order. Visit us soon — we look forward to seeing you!",
  },
  {
    id: "custom",
    title: "Write your own",
    description: "Start with a blank message",
    icon: WandSparkles,
    message: "Hi {name}, ",
  },
];

function cleanPhone(value: string) {
  let number = value.replace(/[^\\d]/g, "");
  if (number.length === 10) number = "91" + number;
  if (number.startsWith("0") && number.length === 11) number = "91" + number.slice(1);
  return number;
}

export default function CampaignsPage() {
  const router = useRouter();
  const [shopId, setShopId] = useState("");
  const [shopName, setShopName] = useState("your shop");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<TemplateId>("inactive");
  const [message, setMessage] = useState(templates[0].message);
  const [discount, setDiscount] = useState("10");
  const [festival, setFestival] = useState("Onam");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openedIds, setOpenedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth"); return; }
    const { data: membership, error: membershipError } = await supabase
      .from("shop_members").select("shop_id").limit(1).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership?.shop_id) { router.replace("/onboarding"); return; }

    const id = membership.shop_id as string;
    setShopId(id);
    const [shopRes, customerRes] = await Promise.all([
      supabase.from("shops").select("name").eq("id", id).maybeSingle(),
      supabase.from("customers").select("id,full_name,phone,phone_normalized").eq("shop_id", id).order("full_name", { ascending: true }),
    ]);
    if (shopRes.error) throw shopRes.error;
    if (customerRes.error) throw customerRes.error;
    setShopName(shopRes.data?.name || "your shop");
    setCustomers((customerRes.data ?? []) as Customer[]);
  }, [router]);

  useEffect(() => {
    let alive = true;
    load()
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : "Could not load customers."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter(customer =>
      !term || customer.full_name.toLowerCase().includes(term) || customer.phone.toLowerCase().includes(term)
    );
  }, [customers, search]);

  const selectedCustomers = useMemo(
    () => customers.filter(customer => selectedIds.includes(customer.id)),
    [customers, selectedIds]
  );
  const allSelected = customers.length > 0 && selectedIds.length === customers.length;
  const currentCustomer = selectedCustomers.find(customer => !openedIds.includes(customer.id)) ?? null;

  const renderedMessage = (customer: Customer | null) => {
    const name = customer?.full_name || "there";
    return message
      .replaceAll("{name}", name)
      .replaceAll("{shop}", shopName)
      .replaceAll("{discount}", discount.trim() || "10")
      .replaceAll("{festival}", festival.trim() || "your festival");
  };

  function resetProgress() {
    setOpenedIds([]);
    setNotice("");
    setError("");
  }

  function chooseTemplate(id: TemplateId) {
    setTemplateId(id);
    setMessage(templates.find(item => item.id === id)?.message ?? "");
    resetProgress();
  }

  function toggleCustomer(id: string) {
    setSelectedIds(current => current.includes(id)
      ? current.filter(value => value !== id)
      : [...current, id]);
    resetProgress();
  }

  function toggleVisible() {
    const visibleIds = filteredCustomers.map(customer => customer.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
    setSelectedIds(current => allVisibleSelected
      ? current.filter(id => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])));
    resetProgress();
  }

  function toggleAllCustomers() {
    setSelectedIds(allSelected ? [] : customers.map(customer => customer.id));
    resetProgress();
  }

  async function openNextMessage() {
    if (!currentCustomer) return;
    const number = cleanPhone(currentCustomer.phone);
    if (number.length < 10 || number.length > 15) {
      setError(`Check the phone number saved for ${currentCustomer.full_name} before continuing.`);
      return;
    }

    // Open synchronously from the click to avoid browser popup blockers.
    const opened = window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(renderedMessage(currentCustomer))}`,
      "_blank",
      "noopener,noreferrer"
    );
    if (!opened) {
      setError("Your browser blocked the WhatsApp tab. Allow pop-ups for this site and try again.");
      return;
    }

    setError("");
    setNotice(`WhatsApp opened for ${currentCustomer.full_name}. Review the message and press Send in WhatsApp.`);
    setOpenedIds(current => current.includes(currentCustomer.id) ? current : [...current, currentCustomer.id]);

    // This records a prepared link, not a sent or delivered message.
    if (shopId) {
      setSending(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("notification_logs").insert({
          shop_id: shopId,
          customer_id: currentCustomer.id,
          channel: "whatsapp_redirect",
          message_type: `campaign_${templateId}`,
          outcome: "prepared",
          created_by: user?.id ?? null,
        });
      } catch {
        // Opening WhatsApp remains useful even if optional activity logging is unavailable.
      } finally {
        setSending(false);
      }
    }
  }

  if (loading) return <LoadingScreen variant="customers" />;

  return (
    <main className="campaign-shell">
      <header className="campaign-topbar">
        <button className="campaign-back" type="button" onClick={() => router.push("/")}>
          <ArrowLeft size={17} /> Dashboard
        </button>
        <BrandLogo className="compact-header-logo" priority />
        <span className="campaign-top-label">CUSTOMER MESSAGES</span>
      </header>

      <section className="campaign-content">
        <div className="campaign-heading-row">
          <div>
            <div className="campaign-eyebrow">CAMPAIGNS</div>
            <h1>Message your customers</h1>
            <p>Choose a message, select who receives it, then open each WhatsApp chat to send.</p>
          </div>
          <div className="campaign-customer-count"><Users size={15} /> {customers.length} customers</div>
        </div>

        {error && <div className="campaign-alert error" role="alert">{error}</div>}
        {notice && <div className="campaign-alert success" role="status">{notice}</div>}

        <div className="campaign-layout">
          <div className="campaign-column">
            <section className="campaign-card">
              <div className="campaign-card-heading">
                <div className="campaign-heading-copy">
                  <span className="campaign-step">1</span>
                  <div><h2>Write your message</h2><p>Pick a starting point and edit it to suit your shop.</p></div>
                </div>
                <button className="campaign-reset" type="button" onClick={() => chooseTemplate(templateId)}>Reset</button>
              </div>

              <div className="campaign-template-grid">
                {templates.map(template => {
                  const Icon = template.icon;
                  return (
                    <button key={template.id} type="button" className={`campaign-template ${templateId === template.id ? "selected" : ""}`} onClick={() => chooseTemplate(template.id)} aria-pressed={templateId === template.id}>
                      <span className="campaign-template-icon"><Icon size={17} /></span>
                      <span className="campaign-template-copy"><strong>{template.title}</strong><small>{template.description}</small></span>
                      {templateId === template.id && <Check className="campaign-template-check" size={16} />}
                    </button>
                  );
                })}
              </div>

              {templateId === "festival" && (
                <label className="campaign-field">
                  <span>Festival name</span>
                  <input type="text" value={festival} onChange={event => setFestival(event.target.value)} maxLength={80} placeholder="e.g. Onam, Eid, Christmas" />
                </label>
              )}
              {templateId === "discount" && (
                <label className="campaign-field">
                  <span>Discount percentage</span>
                  <div className="campaign-discount-input"><input type="number" min="1" max="90" value={discount} onChange={event => setDiscount(event.target.value)} /><span>% off</span></div>
                </label>
              )}

              <label className="campaign-field">
                <span>Message text</span>
                <textarea value={message} onChange={event => { setMessage(event.target.value); setNotice(""); }} maxLength={1500} rows={6} placeholder="Write your message..." />
              </label>
              <p className="campaign-help">Personalization: <code>{`{name}`}</code> customer name · <code>{`{shop}`}</code> shop name{templateId === "discount" ? <> · <code>{`{discount}`}</code> discount</> : null}{templateId === "festival" ? <> · <code>{`{festival}`}</code> festival</> : null}</p>
            </section>

            <section className="campaign-card campaign-audience-card">
              <div className="campaign-card-heading">
                <div className="campaign-heading-copy">
                  <span className="campaign-step">2</span>
                  <div><h2>Choose recipients</h2><p>Select specific people or your whole customer list.</p></div>
                </div>
                <span className="campaign-selected-count">{selectedIds.length} selected</span>
              </div>

              <div className="campaign-audience-actions">
                <button type="button" className={`campaign-segment ${allSelected ? "active" : ""}`} onClick={toggleAllCustomers} disabled={customers.length === 0} aria-pressed={allSelected}>
                  {allSelected ? "Deselect all" : "Select all customers"}
                </button>
                <div className="campaign-search-wrap"><Search size={16} /><input className="campaign-search" aria-label="Search customers" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a customer..." /></div>
                <button type="button" className="campaign-select-all" onClick={toggleVisible} disabled={filteredCustomers.length === 0}>
                  {filteredCustomers.length > 0 && filteredCustomers.every(customer => selectedIds.includes(customer.id)) ? "Deselect results" : "Select results"}
                </button>
              </div>

              <div className="campaign-customer-list">
                {filteredCustomers.length === 0
                  ? <div className="campaign-empty">{customers.length ? "No customers match your search." : "No customers yet. Add customers first, then return here to message them."}</div>
                  : filteredCustomers.map(customer => (
                    <label key={customer.id} className="campaign-customer-row">
                      <input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => toggleCustomer(customer.id)} />
                      <span className="campaign-customer-avatar">{customer.full_name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</span>
                      <span className="campaign-customer-copy"><strong>{customer.full_name}</strong><span>{customer.phone || "No phone number"}</span></span>
                      {selectedIds.includes(customer.id) && <Check size={15} className="campaign-row-check" />}
                    </label>
                  ))
                }
              </div>
            </section>
          </div>

          <aside className="campaign-column campaign-column-right">
            <section className="campaign-card campaign-preview-card">
              <div className="campaign-card-heading">
                <div className="campaign-heading-copy">
                  <span className="campaign-step campaign-step-preview"><MessageCircle size={15} /></span>
                  <div><h2>Preview & send</h2><p>Check the message before opening WhatsApp.</p></div>
                </div>
              </div>

              <div className="campaign-preview">
                <div className="campaign-preview-top">
                  <span className="campaign-preview-icon"><MessageCircle size={17} /></span>
                  <div><strong>{shopName}</strong><span>Message preview</span></div>
                </div>
                <div className="campaign-preview-message">{renderedMessage(selectedCustomers[0] ?? customers[0] ?? null) || "Your message preview will appear here."}</div>
                <p className="campaign-preview-note">Names and other placeholders are filled in for each recipient.</p>
              </div>

              <div className="campaign-send-summary">
                <div><strong>{selectedCustomers.length}</strong><span>recipients selected</span></div>
                <div><strong>{openedIds.filter(id => selectedIds.includes(id)).length}</strong><span>WhatsApp chats opened</span></div>
              </div>
              <button className="campaign-primary" type="button" disabled={!currentCustomer || !message.trim() || sending} onClick={openNextMessage}>
                {sending ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />}
                {currentCustomer ? `Open next chat · ${currentCustomer.full_name.split(/\s+/)[0]}` : selectedCustomers.length ? "All chats opened" : "Select recipients first"}
                {currentCustomer && <ChevronRight size={16} />}
              </button>
              {selectedCustomers.length > 0 && !currentCustomer && (
                <button className="campaign-secondary" type="button" onClick={() => { setOpenedIds([]); setNotice(""); setError(""); }}>Start again</button>
              )}
              <p className="campaign-send-help">{currentCustomer ? "Open each chat, check the message, and press Send in WhatsApp. Then return here for the next person." : selectedCustomers.length ? "You’ve opened a chat for everyone selected. You still need to send each message in WhatsApp." : "Choose recipients in step 2 to get started."}</p>
              <div className="campaign-consent-note">Only message customers who agreed to be contacted. WhatsApp opens one chat at a time; Laundrify does not send messages automatically.</div>
            </section>
          </aside>
        </div>

        <footer className="campaign-footer"><span>Made for independent laundry businesses.</span><span>Simple, personal customer outreach.</span></footer>
      </section>
    </main>
  );
}
