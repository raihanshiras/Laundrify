"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowUpRight, Bell, ChevronDown, CircleHelp, Clock3, CreditCard,
  LayoutDashboard, MessageCircle, MoreHorizontal, PackageCheck, Plus,
  Search, Settings2, Shirt, Users, Wallet,
} from "lucide-react";

type Status="received"|"processing"|"ready"|"delivered"|"cancelled";
type Order={id:string;shop_id:string;customer_id:string;shop_order_number:string;status:Status;received_at:string;due_at:string|null;total_amount:number;discount_amount:number};
type Customer={id:string;full_name:string;phone:string};
type Payment={id:string;order_id:string;kind:"payment"|"refund";amount:number;recorded_at:string};
type Item={id:string;order_id:string;item_name:string};
type Shop={id:string;name:string;address?:string|null};
const money=(value:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(value||0));
const statusLabel:Record<Status,string>={received:"Received",processing:"Processing",ready:"Ready",delivered:"Delivered",cancelled:"Cancelled"};
const nav=[{label:"Overview",icon:LayoutDashboard,active:true},{label:"Orders",icon:Shirt},{label:"Customers",icon:Users},{label:"Payments & ledger",icon:Wallet},{label:"Insights",icon:CreditCard}];

export default function Home(){
 const router=useRouter();
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [shop,setShop]=useState<Shop|null>(null);
 const [orders,setOrders]=useState<Order[]>([]);
 const [customers,setCustomers]=useState<Customer[]>([]);
 const [payments,setPayments]=useState<Payment[]>([]);
 const [items,setItems]=useState<Item[]>([]);
 const [userLabel,setUserLabel]=useState("Shop owner");
 const load=useCallback(async()=>{
  const supabase=createClient();
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){router.replace("/auth");return;}
  setUserLabel(session.user.user_metadata?.full_name||session.user.email||"Shop owner");
  const {data:member,error:memberError}=await supabase.from("shop_members").select("shop_id").limit(1).maybeSingle();
  if(memberError)throw memberError;
  if(!member?.shop_id){router.replace("/onboarding");return;}
  const shopId=member.shop_id;
  const [shopRes,orderRes,customerRes,paymentRes]=await Promise.all([
   supabase.from("shops").select("id,name,address").eq("id",shopId).maybeSingle(),
   supabase.from("orders").select("id,shop_id,customer_id,shop_order_number,status,received_at,due_at,total_amount,discount_amount").eq("shop_id",shopId).order("received_at",{ascending:false}).limit(1000),
   supabase.from("customers").select("id,full_name,phone").eq("shop_id",shopId).order("full_name"),
   supabase.from("payments").select("id,order_id,kind,amount,recorded_at").eq("shop_id",shopId).order("recorded_at",{ascending:false}).limit(2000)
  ]);
  if(shopRes.error)throw shopRes.error;if(orderRes.error)throw orderRes.error;if(customerRes.error)throw customerRes.error;if(paymentRes.error)throw paymentRes.error;
  const fetchedOrders=(orderRes.data??[]) as Order[];
  const fetchedPayments=(paymentRes.data??[]) as Payment[];
  const ids=fetchedOrders.map(o=>o.id);
  let fetchedItems:Item[]=[];
  if(ids.length){const {data,error:itemError}=await supabase.from("order_items").select("id,order_id,item_name").eq("shop_id",shopId).in("order_id",ids);if(itemError)throw itemError;fetchedItems=(data??[]) as Item[];}
  setShop((shopRes.data as Shop|null)??null);setOrders(fetchedOrders);setCustomers((customerRes.data??[]) as Customer[]);setPayments(fetchedPayments);setItems(fetchedItems);
 },[router]);
 useEffect(()=>{let alive=true;load().catch(e=>{if(alive)setError(e instanceof Error?e.message:"Could not load your shop data.");}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[load]);
 const customerMap=useMemo(()=>Object.fromEntries(customers.map(c=>[c.id,c])),[customers]);
 const paymentsToday=useMemo(()=>{const today=new Date().toLocaleDateString("en-CA");return payments.filter(p=>new Date(p.recorded_at).toLocaleDateString("en-CA")===today);},[payments]);
 const todayOrders=useMemo(()=>{const today=new Date().toLocaleDateString("en-CA");return orders.filter(o=>new Date(o.received_at).toLocaleDateString("en-CA")===today);},[orders]);
 const collectedToday=paymentsToday.reduce((sum,p)=>sum+(p.kind==="refund"?-Number(p.amount):Number(p.amount)),0);
 const outstanding=orders.filter(o=>o.status!=="cancelled").reduce((sum,o)=>sum+Math.max(0,Number(o.total_amount)-payments.filter(p=>p.order_id===o.id).reduce((s,p)=>s+(p.kind==="refund"?-Number(p.amount):Number(p.amount)),0)),0);
 const waiting=orders.filter(o=>["received","processing","ready"].includes(o.status));
 const readyCount=orders.filter(o=>o.status==="ready").length;
 const todayLabel=new Intl.DateTimeFormat("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());
 if(loading)return <main className="onboarding-loading"><LoaderCircle className="spin" size={24}/><span>Loading your real shop data…</span></main>;
 return <main className="app-shell">
  <aside className="sidebar">
   <div className="brand"><div className="brand-mark"><Shirt size={21} strokeWidth={1.8}/></div><div><div className="brand-name">laundri<span>fy</span></div><div className="brand-caption">LAUNDRY MANAGEMENT</div></div></div>
   <div className="shop-switcher"><div className="shop-avatar">{shop?.name?.[0]?.toUpperCase()||"L"}</div><div className="shop-copy"><strong>{shop?.name||"Your shop"}</strong><span>{shop?.address||"Shop workspace"}</span></div><ChevronDown size={16} className="muted-icon"/></div>
   <div className="nav-label">WORKSPACE</div>
   <nav className="nav-list" aria-label="Main navigation">{nav.map(({label,icon:Icon,active})=><button className={`nav-item ${active?"active":""}`} key={label} type="button" onClick={()=>{if(label==="Customers")router.push("/customers");else if(label==="Orders")router.push("/orders");else if(label==="Payments & ledger")router.push("/payments");else if(label==="Insights")router.push("/orders");}}><Icon size={18} strokeWidth={1.8}/><span>{label}</span>{label==="Orders"&&<span className="nav-count">{orders.length}</span>}</button>)}</nav>
   <div className="nav-label tools-label">PREFERENCES</div>
   <nav className="nav-list" aria-label="Preferences"><button className="nav-item" type="button" onClick={()=>router.push("/orders")}><MessageCircle size={18}/><span>WhatsApp messages</span></button><button className="nav-item" type="button" onClick={()=>router.push("/onboarding")}><Settings2 size={18}/><span>Shop settings</span></button></nav>
   <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><div><strong>Laundrify</strong><span>Shop management</span></div></div><div className="profile-row"><div className="profile-avatar">{userLabel[0]?.toUpperCase()||"S"}</div><div className="profile-copy"><strong>{userLabel}</strong><span>Signed-in account</span></div><button className="icon-button" aria-label="Account menu" type="button" onClick={async()=>{await createClient().auth.signOut();router.replace("/auth");}}><MoreHorizontal size={18}/></button></div></div>
  </aside>
  <section className="main-panel">
   <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Overview</strong></div><div className="topbar-actions"><div className="date-pill"><span className="live-dot"/>{todayLabel}</div><button className="icon-button notification-button" aria-label="Orders" type="button" onClick={()=>router.push("/orders")}><Bell size={18}/></button><div className="top-avatar">{userLabel[0]?.toUpperCase()||"S"}</div></div></header>
   <div className="page-content">
    <section className="welcome-row"><div><div className="eyebrow">{todayLabel.toUpperCase()}</div><h1>Welcome back<span>,</span> {userLabel.split("@")[0]}</h1><p>Here's what's happening at {shop?.name||"your shop"}.</p></div><button className="primary-button" type="button" onClick={()=>router.push("/orders/new")}><Plus size={17}/> New order</button></section>
    {error&&<div className="order-alert error" role="alert">{error}<button className="inline-action" type="button" onClick={()=>{setLoading(true);setError("");load().catch(e=>setError(e instanceof Error?e.message:"Could not load shop data.")).finally(()=>setLoading(false));}}>Retry</button></div>}
    <section className="metrics-grid" aria-label="Business summary">
     <article className="metric-card"><div className="metric-top"><span className="metric-label">Orders today</span><span className="metric-icon"><PackageCheck size={18}/></span></div><div className="metric-value">{todayOrders.length}</div><div className="metric-detail">Orders created today</div></article>
     <article className="metric-card"><div className="metric-top"><span className="metric-label">Collected today</span><span className="metric-icon"><Wallet size={18}/></span></div><div className="metric-value">{money(collectedToday)}</div><div className="metric-detail">{paymentsToday.length} payment records today</div></article>
     <article className="metric-card"><div className="metric-top"><span className="metric-label">Open orders</span><span className="metric-icon"><Clock3 size={18}/></span></div><div className="metric-value">{waiting.length}</div><div className="metric-detail">{readyCount} ready for collection</div></article>
     <article className="metric-card"><div className="metric-top"><span className="metric-label">Outstanding balance</span><span className="metric-icon"><CreditCard size={18}/></span></div><div className="metric-value">{money(outstanding)}</div><div className="metric-detail">Across active orders</div></article>
    </section>
    <section className="content-grid">
     <article className="panel orders-panel"><div className="panel-heading"><div><h2>Recent orders</h2><p>Real orders from your shop.</p></div><button className="text-button" type="button" onClick={()=>router.push("/orders")}>View all <span>→</span></button></div>
      <div className="table-tools"><button className="search-field dashboard-search-button" type="button" onClick={()=>router.push("/orders")}><Search size={16}/><span>Search orders or customers</span><kbd>Open orders</kbd></button><button className="filter-button" type="button" onClick={()=>router.push("/orders")}>All statuses <ChevronDown size={15}/></button></div>
      {orders.length===0?<div className="orders-empty"><div className="orders-empty-icon"><Shirt size={22}/></div><strong>No orders yet</strong><span>Create your first order to see it here.</span><button className="primary-button" type="button" onClick={()=>router.push("/orders/new")}><Plus size={16}/> Create first order</button></div>:<div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>STATUS</th><th>AMOUNT</th><th></th></tr></thead><tbody>{orders.slice(0,5).map(order=>{const customer=customerMap[order.customer_id];const orderItems=items.filter(i=>i.order_id===order.id);return <tr key={order.id}><td><button className="order-id" type="button" onClick={()=>router.push("/orders/"+order.id)}>{order.shop_order_number}</button><span className="order-time">{new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(order.received_at))}</span></td><td><button className="customer-cell dashboard-customer-button" type="button" onClick={()=>router.push("/customers")}><div className="customer-avatar blue">{customer?.full_name.split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()||"?"}</div><div><strong>{customer?.full_name||"Unknown customer"}</strong><span>{orderItems.map(i=>i.item_name).join(", ")||"No item details"}</span></div></button></td><td><span className={`status status-${order.status}`}><i/>{statusLabel[order.status]}</span></td><td><strong className="amount">{money(order.total_amount)}</strong></td><td><button className="icon-button row-menu" aria-label={`Open order ${order.shop_order_number}`} type="button" onClick={()=>router.push("/orders/"+order.id)}><MoreHorizontal size={17}/></button></td></tr>})}</tbody></table></div>}
      <div className="panel-footer"><span>Showing {Math.min(5,orders.length)} of {orders.length} orders</span><button className="text-button" type="button" onClick={()=>router.push("/orders")}>All orders <span>→</span></button></div>
     </article>
     <div className="right-column"><article className="panel action-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks, right here.</p></div></div>
      <button className="quick-action" type="button" onClick={()=>router.push("/orders/new")}><span className="quick-icon indigo"><Plus size={17}/></span><span><strong>Create an order</strong><small>Register a new drop-off</small></span><span className="quick-arrow">↗</span></button>
      <button className="quick-action" type="button" onClick={()=>router.push("/customers")}><span className="quick-icon green"><Users size={17}/></span><span><strong>Add a customer</strong><small>Save customer details</small></span><span className="quick-arrow">↗</span></button>
      <button className="quick-action" type="button" onClick={()=>router.push("/orders")}><span className="quick-icon amber"><Wallet size={17}/></span><span><strong>Payments & balances</strong><small>Open an order to record payment</small></span><span className="quick-arrow">↗</span></button>
     </article><article className="whatsapp-card"><div className="whatsapp-top"><div className="whatsapp-icon"><MessageCircle size={18}/></div><span className="whatsapp-tag">INCLUDED</span></div><h2>WhatsApp, made simple.</h2><p>Prepare order updates with totals, discounts, advance and balance, then send them yourself in WhatsApp.</p><div className="whatsapp-divider"/><button className="whatsapp-foot" type="button" onClick={()=>router.push("/orders")}><span>Open orders to prepare a message</span><ArrowUpRight size={16}/></button></article></div>
    </section>
    <footer className="page-footer"><span>Made for independent laundry businesses.</span><span><span className="footer-dot"/> Live shop data</span></footer>
   </div>
  </section>
 </main>;
}
