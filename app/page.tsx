"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowDownRight, ArrowUpRight, Bell, ChevronDown, CircleHelp,
  Clock3, CreditCard, LayoutDashboard, MessageCircle, MoreHorizontal,
  PackageCheck, Plus, Search, Settings2, Shirt, Users, Wallet,
} from "lucide-react";

const orders = [
  { id: "LD-1024", customer: "Ananya Menon", items: "3 shirts, 2 trousers", status: "Ready", amount: "₹420", time: "10:42 AM", initials: "AM", tone: "lavender" },
  { id: "LD-1023", customer: "Arjun Nair", items: "4 shirts, 1 jacket", status: "Processing", amount: "₹680", time: "10:18 AM", initials: "AN", tone: "peach" },
  { id: "LD-1022", customer: "Meera Thomas", items: "2 sarees", status: "Received", amount: "₹350", time: "9:54 AM", initials: "MT", tone: "mint" },
  { id: "LD-1021", customer: "Rahul Das", items: "6 shirts, 2 trousers", status: "Delivered", amount: "₹560", time: "9:21 AM", initials: "RD", tone: "blue" },
];

const nav = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Orders", icon: Shirt },
  { label: "Customers", icon: Users },
  { label: "Payments & ledger", icon: Wallet },
  { label: "Insights", icon: CreditCard },
];

function MetricCard({ label, value, detail, positive, icon: Icon }: {
  label: string; value: string; detail: string; positive?: boolean; icon: typeof Wallet;
}) {
  return (
    <article className="metric-card">
      <div className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon"><Icon size={18} strokeWidth={1.8} /></span></div>
      <div className="metric-value">{value}</div>
      <div className={`metric-detail ${positive ? "positive" : ""}`}>{positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}<span>{detail}</span></div>
    </article>
  );
}

export default function Home() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    async function checkAccess() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/auth");
        return;
      }

      const { data: memberships, error } = await supabase
        .from("shop_members")
        .select("shop_id")
        .limit(1);

      if (error) {
        console.error("Could not verify shop membership:", error.message);
        if (alive) setCheckingAccess(false);
        return;
      }

      if (!memberships?.length) {
        router.replace("/onboarding");
        return;
      }

      if (alive) setCheckingAccess(false);
    }

    checkAccess();
    return () => { alive = false; };
  }, [router]);

  if (checkingAccess) {
    return <main className="onboarding-loading"><LoaderCircle className="spin" size={24} /><span>Opening your Laundrify workspace…</span></main>;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Shirt size={21} strokeWidth={1.8} /></div><div><div className="brand-name">laundri<span>fy</span></div><div className="brand-caption">LAUNDRY MANAGEMENT</div></div></div>
        <div className="shop-switcher"><div className="shop-avatar">W</div><div className="shop-copy"><strong>Wash & Fold</strong><span>Main branch</span></div><ChevronDown size={16} className="muted-icon" /></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">{nav.map(({ label, icon: Icon, active }) => <button className={`nav-item ${active ? "active" : ""}`} key={label} type="button" onClick={() => { if (label === "Customers") router.push("/customers"); }}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === "Orders" && <span className="nav-count">12</span>}</button>)}</nav>
        <div className="nav-label tools-label">PREFERENCES</div>
        <nav className="nav-list" aria-label="Preferences"><button className="nav-item" type="button"><MessageCircle size={18} /><span>WhatsApp messages</span></button><button className="nav-item" type="button"><Settings2 size={18} /><span>Shop settings</span></button></nav>
        <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><div><strong>Need a hand?</strong><span>Visit the help centre</span></div></div><div className="profile-row"><div className="profile-avatar">R</div><div className="profile-copy"><strong>Shop owner</strong><span>Owner account</span></div><button className="icon-button" aria-label="Account menu" type="button"><MoreHorizontal size={18} /></button></div></div>
      </aside>
      <section className="main-panel">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Overview</strong></div><div className="topbar-actions"><div className="date-pill"><span className="live-dot" /> Tuesday, 21 October</div><button className="icon-button notification-button" aria-label="Notifications" type="button"><Bell size={18} /><i /></button><div className="top-avatar">R</div></div></header>
        <div className="page-content">
          <section className="welcome-row"><div><div className="eyebrow">TUESDAY, OCTOBER 21, 2026</div><h1>Good afternoon<span>,</span> Raihan</h1><p>Here&apos;s what&apos;s happening at your shop today.</p></div><button className="primary-button" type="button"><Plus size={17} /> New order</button></section>
          <section className="metrics-grid" aria-label="Business summary">
            <MetricCard label="Orders today" value="24" detail="18% vs. last Tuesday" positive icon={PackageCheck} />
            <MetricCard label="Collected today" value="₹8,460" detail="12 payments recorded" positive icon={Wallet} />
            <MetricCard label="Awaiting collection" value="12" detail="4 ready for pickup" icon={Clock3} />
            <MetricCard label="Outstanding balance" value="₹12,840" detail="Across 19 customers" icon={CreditCard} />
          </section>
          <section className="content-grid">
            <article className="panel orders-panel">
              <div className="panel-heading"><div><h2>Recent orders</h2><p>Keep track of every garment, from drop-off to pickup.</p></div><button className="text-button" type="button">View all <span>→</span></button></div>
              <div className="table-tools"><div className="search-field"><Search size={16} /><span>Search orders or customers</span><kbd>⌘ K</kbd></div><button className="filter-button" type="button">All statuses <ChevronDown size={15} /></button></div>
              <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>STATUS</th><th>AMOUNT</th><th></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><span className="order-id">{order.id}</span><span className="order-time">{order.time}</span></td><td><div className="customer-cell"><div className={`customer-avatar ${order.tone}`}>{order.initials}</div><div><strong>{order.customer}</strong><span>{order.items}</span></div></div></td><td><span className={`status status-${order.status.toLowerCase()}`}><i />{order.status}</span></td><td><strong className="amount">{order.amount}</strong></td><td><button className="icon-button row-menu" aria-label={`More options for ${order.id}`} type="button"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div>
              <div className="panel-footer"><span>Showing 4 of 24 orders</span><button className="text-button" type="button">All orders <span>→</span></button></div>
            </article>
            <div className="right-column">
              <article className="panel action-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks, right here.</p></div></div>
                <button className="quick-action" type="button"><span className="quick-icon indigo"><Plus size={17} /></span><span><strong>Create an order</strong><small>Register a new drop-off</small></span><span className="quick-arrow">↗</span></button>
                <button className="quick-action" type="button" onClick={() => router.push("/customers")}><span className="quick-icon green"><Users size={17} /></span><span><strong>Add a customer</strong><small>Save customer details</small></span><span className="quick-arrow">↗</span></button>
                <button className="quick-action" type="button"><span className="quick-icon amber"><Wallet size={17} /></span><span><strong>Record a payment</strong><small>Cash, UPI or other</small></span><span className="quick-arrow">↗</span></button>
              </article>
              <article className="whatsapp-card"><div className="whatsapp-top"><div className="whatsapp-icon"><MessageCircle size={18} /></div><span className="whatsapp-tag">INCLUDED</span></div><h2>WhatsApp, made simple.</h2><p>Prepare order updates and payment details, then open WhatsApp to send them yourself.</p><div className="whatsapp-divider" /><div className="whatsapp-foot"><span>Bulk automation available separately</span><ArrowUpRight size={16} /></div></article>
            </div>
          </section>
          <footer className="page-footer"><span>Made for independent laundry businesses.</span><span><span className="footer-dot" /> All systems operational</span></footer>
        </div>
      </section>
    </main>
  );
}
