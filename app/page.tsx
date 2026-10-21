"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight, ChevronDown, CircleHelp, Clock3, CreditCard,
  LayoutDashboard, LogOut, MessageCircle, PackageCheck,
  Plus, Search, Shirt, Users, Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand";
import { LoadingScreen } from "@/components/loading-screen";

type Status = "received" | "processing" | "ready" | "delivered" | "cancelled";
type Order = { id: string; shop_id: string; customer_id: string; shop_order_number: string; status: Status; received_at: string; due_at: string | null; total_amount: number; discount_amount: number };
type Customer = { id: string; full_name: string; phone: string };
type Payment = { id: string; order_id: string; kind: "payment" | "refund"; amount: number; recorded_at: string };
type Item = { id: string; order_id: string; item_name: string };
type Shop = { id: string; name: string; address: string | null };

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const statusLabel: Record<Status, string> = { received: "Received", processing: "Processing", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled" };
const nav = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Orders", icon: Shirt },
  { label: "Customers", icon: Users },
  { label: "Payments & ledger", icon: Wallet },
];

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shop, setShop] = useState<Shop | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [recentSearch, setRecentSearch] = useState("");
  const [recentStatus, setRecentStatus] = useState("all");
  const [userLabel, setUserLabel] = useState("Shop owner");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth"); return; }
    setUserLabel(session.user.user_metadata?.full_name || session.user.email || "Shop owner");
    const { data: member, error: memberError } = await supabase.from("shop_members").select("shop_id").limit(1).maybeSingle();
    if (memberError) throw memberError;
    if (!member?.shop_id) { router.replace("/onboarding"); return; }
    const shopId = member.shop_id;
    const [shopRes, orderRes, customerRes, paymentRes] = await Promise.all([
      supabase.from("shops").select("id,name,address").eq("id", shopId).maybeSingle(),
      supabase.from("orders").select("id,shop_id,customer_id,shop_order_number,status,received_at,due_at,total_amount,discount_amount").eq("shop_id", shopId).order("received_at", { ascending: false }).limit(1000),
      supabase.from("customers").select("id,full_name,phone").eq("shop_id", shopId).order("full_name"),
      supabase.from("payments").select("id,order_id,kind,amount,recorded_at").eq("shop_id", shopId).order("recorded_at", { ascending: false }).limit(2000),
    ]);
    if (shopRes.error) throw shopRes.error;
    if (orderRes.error) throw orderRes.error;
    if (customerRes.error) throw customerRes.error;
    if (paymentRes.error) throw paymentRes.error;
    const fetchedOrders = (orderRes.data ?? []) as Order[];
    const ids = fetchedOrders.map(order => order.id);
    let fetchedItems: Item[] = [];
    if (ids.length) {
      const { data, error: itemError } = await supabase.from("order_items").select("id,order_id,item_name").eq("shop_id", shopId).in("order_id", ids);
      if (itemError) throw itemError;
      fetchedItems = (data ?? []) as Item[];
    }
    setShop((shopRes.data as Shop | null) ?? null);
    setOrders(fetchedOrders);
    setCustomers((customerRes.data ?? []) as Customer[]);
    setPayments((paymentRes.data ?? []) as Payment[]);
    setItems(fetchedItems);
  }, [router]);

  useEffect(() => {
    let alive = true;
    load()
      .catch(error => { if (alive) setError(error instanceof Error ? error.message : "Could not load your shop data."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load]);

  const customerMap = useMemo(() => Object.fromEntries(customers.map(customer => [customer.id, customer])), [customers]);
  const todayKey = new Date().toLocaleDateString("en-CA");
  const todayOrders = orders.filter(order => new Date(order.received_at).toLocaleDateString("en-CA") === todayKey);
  const paymentsToday = payments.filter(payment => new Date(payment.recorded_at).toLocaleDateString("en-CA") === todayKey);
  const collectedToday = paymentsToday.reduce((sum, payment) => sum + (payment.kind === "refund" ? -Number(payment.amount) : Number(payment.amount)), 0);
  const outstanding = orders.filter(order => order.status !== "cancelled").reduce((sum, order) => {
    const paid = payments.filter(payment => payment.order_id === order.id).reduce((amount, payment) => amount + (payment.kind === "refund" ? -Number(payment.amount) : Number(payment.amount)), 0);
    return sum + Math.max(0, Number(order.total_amount) - paid);
  }, 0);
  const openOrders = orders.filter(order => ["received", "processing", "ready"].includes(order.status));
  const readyCount = orders.filter(order => order.status === "ready").length;
  const todayLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const visibleOrders = useMemo(() => {
    const term = recentSearch.trim().toLowerCase();
    return orders.filter(order => {
      if (recentStatus !== "all" && order.status !== recentStatus) return false;
      if (!term) return true;
      const customer = customerMap[order.customer_id];
      const itemNames = items.filter(item => item.order_id === order.id).map(item => item.item_name).join(" ");
      return [order.shop_order_number, customer?.full_name, customer?.phone, itemNames].join(" ").toLowerCase().includes(term);
    });
  }, [orders, customerMap, items, recentSearch, recentStatus]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/auth");
  }

  if (loading) return <LoadingScreen variant="dashboard" />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><BrandLogo className="sidebar-brand-logo" priority /><div className="brand-caption">LAUNDRY MANAGEMENT</div></div>
        <div className="shop-switcher"><div className="shop-avatar">{shop?.name?.[0]?.toUpperCase() || "L"}</div><div className="shop-copy"><strong>{shop?.name || "Your shop"}</strong><span>{shop?.address || "Shop workspace"}</span></div></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {nav.map(({ label, icon: Icon, active }) => <button className={"nav-item " + (active ? "active" : "")} key={label} type="button" onClick={() => { if (label === "Customers") router.push("/customers"); else if (label === "Orders") router.push("/orders"); else if (label === "Payments & ledger") router.push("/payments"); }}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === "Orders" && <span className="nav-count">{orders.length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><div><strong>Laundrify</strong><span>Shop management</span></div></div>
          <div className="profile-row"><div className="profile-avatar">{userLabel[0]?.toUpperCase() || "S"}</div><div className="profile-copy"><strong>{userLabel}</strong><span>Signed-in account</span></div><button className="icon-button" aria-label="Sign out" title="Sign out" type="button" onClick={signOut}><LogOut size={17} /></button></div>
        </div>
      </aside>
      <section className="main-panel">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Overview</strong></div><div className="topbar-actions"><div className="date-pill"><span className="live-dot" />{todayLabel}</div><div className="top-avatar">{userLabel[0]?.toUpperCase() || "S"}</div></div></header>
        <div className="page-content">
          <section className="welcome-row"><div><div className="eyebrow">{todayLabel.toUpperCase()}</div><h1>Welcome back<span>,</span> {userLabel.split("@")[0]}</h1><p>Here's what's happening at {shop?.name || "your shop"}.</p></div><button className="primary-button" type="button" onClick={() => router.push("/orders/new")}><Plus size={17} /> New order</button></section>
          {error && <div className="order-alert error" role="alert">{error} <button className="inline-action" type="button" onClick={() => { setLoading(true); setError(""); load().catch(e => setError(e instanceof Error ? e.message : "Could not load shop data.")).finally(() => setLoading(false)); }}>Retry</button></div>}
          <section className="metrics-grid" aria-label="Business summary">
            <article className="metric-card"><div className="metric-top"><span className="metric-label">Orders today</span><span className="metric-icon"><PackageCheck size={18} /></span></div><div className="metric-value">{todayOrders.length}</div><div className="metric-detail">Orders created today</div></article>
            <article className="metric-card"><div className="metric-top"><span className="metric-label">Collected today</span><span className="metric-icon"><Wallet size={18} /></span></div><div className="metric-value">{money(collectedToday)}</div><div className="metric-detail">{paymentsToday.length} payment records today</div></article>
            <article className="metric-card"><div className="metric-top"><span className="metric-label">Open orders</span><span className="metric-icon"><Clock3 size={18} /></span></div><div className="metric-value">{openOrders.length}</div><div className="metric-detail">{readyCount} ready for collection</div></article>
            <article className="metric-card"><div className="metric-top"><span className="metric-label">Outstanding balance</span><span className="metric-icon"><CreditCard size={18} /></span></div><div className="metric-value">{money(outstanding)}</div><div className="metric-detail">Across active orders</div></article>
          </section>
          <section className="content-grid">
            <article className="panel orders-panel">
              <div className="panel-heading"><div><h2>Recent orders</h2><p>Real orders from your shop.</p></div><button className="text-button" type="button" onClick={() => router.push("/orders")}>View all <span>→</span></button></div>
              <div className="table-tools"><div className="search-field dashboard-search-field"><Search size={16} /><input aria-label="Search recent orders" value={recentSearch} onChange={event => setRecentSearch(event.target.value)} placeholder="Search order, customer or garment…" />{recentSearch && <button type="button" aria-label="Clear search" onClick={() => setRecentSearch("")}>×</button>}</div><label className="filter-button dashboard-status-filter"><select aria-label="Filter recent orders by status" value={recentStatus} onChange={event => setRecentStatus(event.target.value)}><option value="all">All statuses</option><option value="received">Received</option><option value="processing">Processing</option><option value="ready">Ready</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select><ChevronDown size={15} /></label></div>
              {orders.length === 0 ? <div className="orders-empty"><div className="orders-empty-icon"><Shirt size={22} /></div><strong>No orders yet</strong><span>Use the New order button above to register your first drop-off.</span></div> : visibleOrders.length === 0 ? <div className="orders-empty dashboard-no-results"><div className="orders-empty-icon"><Search size={22} /></div><strong>No matching orders</strong><span>Try another search or clear the selected status.</span><button className="text-button" type="button" onClick={() => { setRecentSearch(""); setRecentStatus("all"); }}>Clear search and filter</button></div> : <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>STATUS</th><th>AMOUNT</th></tr></thead><tbody>{visibleOrders.slice(0, 5).map(order => { const customer = customerMap[order.customer_id]; const orderItems = items.filter(item => item.order_id === order.id); return <tr key={order.id}><td><button className="order-id" type="button" onClick={() => router.push("/orders/" + order.id)}>{order.shop_order_number}</button><span className="order-time">{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(order.received_at))}</span></td><td><button className="customer-cell dashboard-customer-button" type="button" onClick={() => router.push("/customers")}><div className="customer-avatar blue">{customer?.full_name.split(/\s+/).slice(0, 2).map(name => name[0]).join("").toUpperCase() || "?"}</div><div><strong>{customer?.full_name || "Unknown customer"}</strong><span>{orderItems.map(item => item.item_name).join(", ") || "No item details"}</span></div></button></td><td><span className={"status status-" + order.status}><i />{statusLabel[order.status]}</span></td><td><strong className="amount">{money(order.total_amount)}</strong></td></tr>; })}</tbody></table></div>}
              <div className="panel-footer"><span>Showing {Math.min(5, visibleOrders.length)} of {visibleOrders.length}{recentSearch || recentStatus !== "all" ? " matching" : ""} orders</span></div>
            </article>
            <div className="right-column">
              <article className="panel action-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks, right here.</p></div></div>
                {readyCount > 0 && <button className="quick-action" type="button" onClick={() => router.push("/orders?status=ready")}><span className="quick-icon indigo"><Clock3 size={17} /></span><span><strong>Ready for collection</strong><small>{readyCount} {readyCount === 1 ? "order" : "orders"} waiting for pickup</small></span><span className="quick-arrow">↗</span></button>}
                <button className="quick-action" type="button" onClick={() => router.push("/customers")}><span className="quick-icon green"><Users size={17} /></span><span><strong>Add a customer</strong><small>Save customer details</small></span><span className="quick-arrow">↗</span></button>
                <button className="quick-action" type="button" onClick={() => router.push("/payments")}><span className="quick-icon amber"><Wallet size={17} /></span><span><strong>Payments & balances</strong><small>Review recorded transactions</small></span><span className="quick-arrow">↗</span></button>
              </article>
              <article className="whatsapp-card"><div className="whatsapp-top"><div className="whatsapp-icon"><MessageCircle size={18} /></div><span className="whatsapp-tag">INCLUDED</span></div><h2>WhatsApp, made simple.</h2><p>Prepare order updates with totals, discounts, advance and balance, then send them yourself in WhatsApp.</p><div className="whatsapp-divider" /><button className="whatsapp-foot" type="button" onClick={() => router.push("/orders")}><span>Open orders to prepare a message</span><ArrowUpRight size={16} /></button></article>
            </div>
          </section>
          <footer className="page-footer"><span>Made for independent laundry businesses.</span><span><span className="footer-dot" /> Live shop data</span></footer>
        </div>
      </section>
    </main>
  );
}
