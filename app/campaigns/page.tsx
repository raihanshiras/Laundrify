"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Cake, Check, ChevronRight, Gift, LoaderCircle, MessageCircle,
  Megaphone, Search, Send, Sparkles, Tag, Users, WandSparkles,
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
    description: "Welcome back a customer who has been away.",
    icon: MessageCircle,
    message: "Hi {name}! 👋 It’s been a while since we last saw you at {shop}. We’d love to take care of your laundry again. Drop by whenever you need us — we’ll be happy to help!",
  },
  {
    id: "festival",
    title: "Festival greetings",
    description: "Send warm wishes for a special occasion.",
    icon: Cake,
    message: "Hi {name}! 🎉 Happy {festival} from everyone at {shop}. Wishing you and your family happiness and wonderful celebrations. When your festive outfits need a little extra care, we’re here for you!",
  },
  {
    id: "discount",
    title: "Special discount",
    description: "Share an offer with your customers.",
    icon: Tag,
    message: "Hi {name}! ✨ A little something from {shop}: enjoy {discount}% off your next laundry order. Visit us soon and let us take care of the laundry while you enjoy your day. We look forward to seeing you!",
  },
  {
    id: "custom",
    title: "Custom message",
    description: "Write a message in your own words.",
    icon: WandSparkles,
    message: "Hi {name}, ",
  },
];

function cleanPhone(value: string) {
  let number = value.replace(/[^\d]/g, "");
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
  const [nextIndex, setNextIndex] = useState(0);
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

  const currentCustomer = selectedCustomers[nextIndex] ?? null;
  const renderedMessage = (customer: Customer | null) => {
    const name = customer?.full_name || "there";
    return message
      .replaceAll("{name}", name)
      .replaceAll("{shop}", shopName)
      .replaceAll("{discount}", discount.trim() || "10")
      .replaceAll("{festival}", festival.trim() || "your festival");
  };

  function chooseTemplate(id: TemplateId) {
    setTemplateId(id);
    const template = templates.find(item => item.id === id);
    if (template) setMessage(template.message);
    setNotice("");
    setError("");
  }

  function toggleCustomer(id: string) {
    setSelectedIds(current => {
      const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
      setNextIndex(0);
      setOpenedIds([]);
      return next;
    });
    setNotice("");
  }

  function toggleVisible() {
    const visibleIds = filteredCustomers.map(customer => customer.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
    setSelectedIds(current => {
      const next = allVisibleSelected
        ? current.filter(id => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]));
      setNextIndex(0);
      setOpenedIds([]);
      return next;
    });
    setNotice("");
  }

  async function openNextMessage() {
    if (!currentCustomer) {
      setNotice("You’ve prepared a WhatsApp message for every selected customer.");
      return;
    }
    const number = cleanPhone(currentCustomer.phone);
    if (number.length < 10 || number.length > 15) {
      setError(`Check the phone number saved for ${currentCustomer.full_name} before continuing.`);
      return;
    }

    // Open synchronously from the click to avoid browser popup blockers.
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(renderedMessage(currentCustomer))}`, "_blank", "noopener,noreferrer");
    setError("");
    setNotice(`WhatsApp opened for ${currentCustomer.full_name}. Review the message and press Send in WhatsApp.`);
    setOpenedIds(current => current.includes(currentCustomer.id) ? current : [...current, currentCustomer.id]);
    setNextIndex(index => Math.min(index + 1, selectedCustomers.length));

    // This records that a click-to-chat message was prepared, not that it was sent or delivered.
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
        <span className="campaign-top-label">CUSTOMER OUTREACH</span>
      </header>

      <section className="campaign-content">
        <div className="campaign-heading-row">
          <div>
            <div className="campaign-eyebrow">STAY CONNECTED</div>
            <h1>Customer campaigns<span>.</span></h1>
            <p>Send thoughtful updates, festive wishes and offers to the people who keep your shop going.</p>
          </div>
          <div className="campaign-customer-count"><Users size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />{customers.length} customers available</div>
        </div>

        {error && <div className="campaign-alert error" role="alert">{error}</div>}
        {notice && <div className="campaign-alert success" role="status">{notice}</div>}

        <div className="campaign-layout">
          <div className="campaign-column">
            <section className="campaign-card">
              <div className="campaign-card-heading">
                <div><h2>Choose a message template</h2><p>Start with a template, then personalize every word.</p></div>
                <span className="campaign-step">01</span>
              </div>
              <div className="campaign-template-grid">
                {templates.map(template => {
                  const Icon = template.icon;
                  return (
                    <button key={template.id} type="button" className={`campaign-template ${templateId === template.id ? "selected" : ""}`} onClick={() => chooseTemplate(template.id)} aria-pressed={templateId === template.id}>
                      <span className="campaign-template-icon"><Icon size={17} /></span>
                      <span><strong>{template.title}</strong><small>{template.description}</small></span>
                      {templateId === template.id && <Check size={15} color="#0787ff" />}
                    </button>
                  );
                })}
              </div>
              {templateId === "festival" && (
                <label className="campaign-field"><span>Festival or occasion name</span><input type="text" value={festival} onChange={event => setFestival(event.target.value)} maxLength={80} placeholder="e.g. Onam, Eid, Christmas" /><small className="campaign-field-hint">This name will be inserted wherever {`{festival}`} appears in the message.</small></label>
              )}
              {templateId === "discount" && (
                <label className="campaign-field"><span>Discount percentage</span><input type="number" min="1" max="90" value={discount} onChange={event => setDiscount(event.target.value)} /><small className="campaign-field-hint">Adjust the offer before preparing messages.</small></label>
              )}
              <label className="campaign-field">
                <span>Customize your message</span>
                <textarea value={message} onChange={event => { setMessage(event.target.value); setNotice(""); }} maxLength={1500} rows={7} placeholder="Write your message..." />
                <small className="campaign-field-hint">Personalize with these placeholders. They’ll be replaced for each customer.</small>
              </label>
              <div className="campaign-editor-actions">
                <div className="campaign-token-row">
                  {["{name}", "{shop}", ...(templateId === "discount" ? ["{discount}"] : []), ...(templateId === "festival" ? ["{festival}"] : [])].map(token => <button key={token} type="button" className="campaign-token" onClick={() => setMessage(current => current + token)}>{token}</button>)}
                </div>
                <button className="campaign-reset" type="button" onClick={() => chooseTemplate(templateId)}>Reset template</button>
              </div>
            </section>

            <section className="campaign-card">
              <div className="campaign-card-heading">
                <div><h2>Select your audience</h2><p>Choose individual customers, or use All customers to select or deselect your entire directory.</p></div>
                <span className="campaign-step">02</span>
              </div>
              <div className="campaign-segment-row">
                <button
                  type="button"
                  className={`campaign-segment ${customers.length > 0 && selectedIds.length === customers.length ? "active" : ""}`}
                  onClick={() => {
                    const allSelected = customers.length > 0 && selectedIds.length === customers.length;
                    setSelectedIds(allSelected ? [] : customers.map(customer => customer.id));
                    setNextIndex(0);
                    setOpenedIds([]);
                    setNotice("");
                    setError("");
                  }}
                  disabled={customers.length === 0}
                  aria-pressed={customers.length > 0 && selectedIds.length === customers.length}
                >
                  {customers.length > 0 && selectedIds.length === customers.length ? "Deselect all customers" : "All customers"}
                </button>
                <span className="campaign-customer-count">{selectedIds.length} selected</span>
              </div>
              <div className="campaign-customer-tools">
                <div className="campaign-search-wrap"><Search size={16} /><input className="campaign-search" aria-label="Search customers" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customer name or phone..." /></div>
                <button type="button" className="campaign-select-all" onClick={toggleVisible}>{filteredCustomers.length > 0 && filteredCustomers.every(customer => selectedIds.includes(customer.id)) ? "Deselect shown" : "Select shown"}</button>
              </div>
              <div className="campaign-customer-list">
                {filteredCustomers.length === 0 ? <div className="campaign-empty">{customers.length ? "No customers match that search." : "Add customers to your directory before starting a campaign."}</div> :
                  filteredCustomers.map(customer => (
                    <label key={customer.id} className="campaign-customer-row">
                      <input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => toggleCustomer(customer.id)} />
                      <span className="campaign-customer-avatar">{customer.full_name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</span>
                      <span className="campaign-customer-copy"><strong>{customer.full_name}</strong><span>{customer.phone}</span></span>
                      {selectedIds.includes(customer.id) && <Check size={15} color="#0787ff" />}
                    </label>
                  ))
                }
              </div>
            </section>
          </div>

          <div className="campaign-column campaign-column-right">
            <section className="campaign-card campaign-preview-card">
              <div className="campaign-card-heading">
                <div><h2>Message preview</h2><p>Preview changes for a sample customer.</p></div>
                <span className="campaign-step"><Sparkles size={14} /></span>
              </div>
              <div className="campaign-preview">
                <div className="campaign-preview-top">
                  <span className="campaign-preview-icon"><MessageCircle size={17} /></span>
                  <div><strong>{shopName}</strong><span>WhatsApp message preview</span></div>
                </div>
                <div className="campaign-preview-message">{renderedMessage(selectedCustomers[0] ?? customers[0] ?? null) || "Your message preview will appear here."}</div>
                <p className="campaign-preview-note">This is a preview only. Each recipient gets their own personalized message.</p>
              </div>
              <div className="campaign-send-row">
                <div className="campaign-progress">
                  {selectedCustomers.length === 0
                    ? "Select customers to prepare messages."
                    : openedIds.length >= selectedCustomers.length
                      ? `Prepared WhatsApp links for all ${selectedCustomers.length} selected customers.`
                      : `${openedIds.length} of ${selectedCustomers.length} WhatsApp links opened. Messages still need to be sent in WhatsApp.`}
                </div>
                <button className="campaign-primary" type="button" disabled={!currentCustomer || !message.trim() || sending} onClick={openNextMessage}>
                  {sending ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />}
                  {currentCustomer ? `Open WhatsApp for ${currentCustomer.full_name.split(/\s+/)[0]}` : "All selected messages prepared"}
                  {currentCustomer && <ChevronRight size={16} />}
                </button>
                {selectedCustomers.length > 0 && openedIds.length >= selectedCustomers.length && <button className="campaign-secondary" type="button" onClick={() => { setNextIndex(0); setOpenedIds([]); setNotice(""); }}>Start this campaign again</button>}
              </div>
              <div className="campaign-consent-note"><strong>Before you send:</strong> Contact customers who have agreed to receive promotional messages, keep offers accurate, and respect anyone who asks not to be contacted. Laundrify opens a pre-filled WhatsApp chat for each customer; you review and send it yourself.</div>
            </section>

            <section className="campaign-card">
              <div className="campaign-card-heading">
                <div><h2>How it works</h2><p>Simple, controlled outreach for your shop.</p></div>
                <span className="campaign-step"><Megaphone size={14} /></span>
              </div>
              <div className="campaign-empty" style={{ textAlign: "left", padding: "0 0 8px" }}>
                <p><strong>1.</strong> Choose a template and customize it.</p>
                <p><strong>2.</strong> Select the customers you want to reach.</p>
                <p><strong>3.</strong> Open each WhatsApp chat, review the message, and press Send.</p>
                <p><strong>4.</strong> Return here to prepare the next customer’s message.</p>
              </div>
            </section>
          </div>
        </div>
        <footer className="campaign-footer"><span>Built for independent laundry businesses.</span><span><Gift size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />Thoughtful messages. Stronger customer relationships.</span></footer>
      </section>
    </main>
  );
}
