"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CalendarClock, ChevronRight, CirclePlus, LoaderCircle, Search, Shirt, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status = "received" | "processing" | "ready" | "delivered" | "cancelled";
type Order = { id: string; shop_id: string; customer_id: string; shop_order_number: string; status: Status; received_at: string; due_at: string | null; subtotal: number; discount_amount: number; total_amount: number; notes: string | null };
type Customer = { id: string; full_name: string; phone: string };
type Item = { order_id: string; item_name: string; quantity: number; pricing: "per_piece" | "per_kg" | "fixed" };
const filters: {label:string;value:string}[] = [{label:"All orders",value:"all"},{label:"Received",value:"received"},{label:"Processing",value:"processing"},{label:"Ready",value:"ready"},{label:"Delivered",value:"delivered"},{label:"Cancelled",value:"cancelled"}];
const money = (amount: number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(amount||0));
const shortDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value)) : "No due date";
const statusLabel: Record<Status,string> = {received:"Received",processing:"Processing",ready:"Ready",delivered:"Delivered",cancelled:"Cancelled"};

export default function OrdersPage() {
  const router = useRouter();
  const [orders,setOrders] = useState<Order[]>([]);
  const [customers,setCustomers] = useState<Record<string,Customer>>({});
  const [items,setItems] = useState<Record<string,Item[]>>({});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("all");

  const load = useCallback(async (targetShopId: string) => {
    const supabase = createClient();
    const {data: orderRows,error: orderError} = await supabase.from("orders")
      .select("id,shop_id,customer_id,shop_order_number,status,received_at,due_at,subtotal,discount_amount,total_amount,notes")
      .eq("shop_id",targetShopId).order("received_at",{ascending:false}).limit(250);
    if(orderError) throw orderError;
    const typedOrders = (orderRows ?? []) as Order[];
    const customerIds = [...new Set(typedOrders.map(o=>o.customer_id))];
    if(customerIds.length) {
      const {data: customerRows,error: customerError} = await supabase.from("customers")
        .select("id,full_name,phone").eq("shop_id",targetShopId).in("id",customerIds);
      if(customerError) throw customerError;
      setCustomers(Object.fromEntries(((customerRows??[]) as Customer[]).map(c=>[c.id,c])));
    } else setCustomers({});
    const orderIds = typedOrders.map(o=>o.id);
    if(orderIds.length) {
      const {data: itemRows,error: itemError} = await supabase.from("order_items")
        .select("order_id,item_name,quantity,pricing").eq("shop_id",targetShopId).in("order_id",orderIds);
      if(itemError) throw itemError;
      const grouped: Record<string,Item[]> = {};
      for(const item of (itemRows??[]) as Item[]) (grouped[item.order_id] ||= []).push(item);
      setItems(grouped);
    } else setItems({});
    setOrders(typedOrders);
  },[]);

  useEffect(()=>{
    let active=true;
    async function init(){
      try{
        const supabase=createClient();
        const {data:{session}}=await supabase.auth.getSession();
        if(!session){router.replace("/auth");return;}
        const {data:member,error:memberError}=await supabase.from("shop_members").select("shop_id").limit(1).maybeSingle();
        if(memberError) throw memberError;
        if(!member?.shop_id){router.replace("/onboarding");return;}
        if(!active)return;
        await load(member.shop_id);
      }catch(e){if(active)setError(e instanceof Error?e.message:"Could not load orders.");}
      finally{if(active)setLoading(false);}
    }
    init();return()=>{active=false;};
  },[router,load]);

  const filtered = useMemo(()=>{
    const term=search.trim().toLowerCase();
    return orders.filter(order=>{
      if(filter!=="all" && order.status!==filter)return false;
      if(!term)return true;
      const customer=customers[order.customer_id];
      return order.shop_order_number.toLowerCase().includes(term) || customer?.full_name.toLowerCase().includes(term) || customer?.phone.toLowerCase().includes(term) || (items[order.id]||[]).some(i=>i.item_name.toLowerCase().includes(term));
    });
  },[orders,customers,items,filter,search]);

  const stats = useMemo(()=>({
    today:orders.filter(o=>new Date(o.received_at).toDateString()===new Date().toDateString()).length,
    active:orders.filter(o=>["received","processing","ready"].includes(o.status)).length,
    ready:orders.filter(o=>o.status==="ready").length,
    revenue:orders.filter(o=>o.status!=="cancelled").reduce((sum,o)=>sum+Number(o.total_amount||0),0)
  }),[orders]);

  return <main className="orders-shell">
    <header className="orders-topbar">
      <button type="button" className="orders-back" onClick={()=>router.push("/")}><ArrowLeft size={16}/> Dashboard</button>
      <div className="orders-brand"><span className="orders-brand-mark"><Shirt size={19}/></span><span>laundri<b>fy</b></span></div>
      <span className="orders-top-label">ORDER MANAGEMENT</span>
    </header>
    <section className="orders-content">
      <div className="orders-page-heading"><div><div className="orders-eyebrow">THE DAILY WORKFLOW</div><h1>Orders<span>.</span></h1><p>Track every garment from intake to collection.</p></div><button type="button" className="orders-primary" onClick={()=>router.push("/orders/new")}><CirclePlus size={17}/> New order</button></div>
      {error&&<div className="order-alert error" role="alert">{error}</div>}
      <div className="orders-stats">
        <article className="orders-stat"><span>Orders today</span><strong>{loading?"—":stats.today}</strong><small><CalendarClock size={13}/> Received today</small></article>
        <article className="orders-stat"><span>In workflow</span><strong>{loading?"—":stats.active}</strong><small><ArrowUpRight size={13}/> Not yet collected</small></article>
        <article className="orders-stat"><span>Ready to collect</span><strong>{loading?"—":stats.ready}</strong><small><Shirt size={13}/> Awaiting customer</small></article>
        <article className="orders-stat"><span>Order value</span><strong>{loading?"—":money(stats.revenue)}</strong><small><ArrowDownLeft size={13}/> Excludes cancelled</small></article>
      </div>
      <section className="orders-table-card">
        <div className="orders-list-head"><div><h2>All orders</h2><p>Search orders by reference, customer or garment.</p></div><span className="orders-total-pill">{filtered.length} shown</span></div>
        <div className="orders-toolbar"><div className="orders-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order, customer or item…" aria-label="Search orders"/>{search&&<button type="button" aria-label="Clear search" onClick={()=>setSearch("")}>×</button>}</div><div className="orders-toolbar-label"><SlidersHorizontal size={14}/> Filter status</div></div>
        <div className="orders-filters" role="group" aria-label="Filter orders">{filters.map(f=><button type="button" key={f.value} className={filter===f.value?"selected":""} onClick={()=>setFilter(f.value)}>{f.label}{f.value!=="all"&&<span>{orders.filter(o=>o.status===f.value).length}</span>}</button>)}</div>
        {loading?<div className="orders-empty"><LoaderCircle className="spin" size={22}/><span>Loading orders…</span></div>:
         filtered.length===0?<div className="orders-empty"><div className="orders-empty-icon"><Shirt size={22}/></div><strong>{search||filter!=="all"?"No orders match those filters":"No orders yet"}</strong><span>{search||filter!=="all"?"Try changing the search or status filter.":"Create your first order to start tracking garments."}</span>{orders.length===0&&<button className="orders-primary" type="button" onClick={()=>router.push("/orders/new")}><CirclePlus size={16}/> Create first order</button>}</div>:
         <div className="orders-record-list">{filtered.map(order=>{const customer=customers[order.customer_id];const orderItems=items[order.id]||[];return <button className="orders-record" key={order.id} type="button" onClick={()=>router.push("/orders/"+order.id)}>
          <div className="orders-record-ref"><span className="orders-record-icon"><Shirt size={18}/></span><div><strong>{order.shop_order_number}</strong><small>{new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(order.received_at))}</small></div></div>
          <div className="orders-record-customer"><strong>{customer?.full_name||"Customer"}</strong><span>{customer?.phone||"No phone on file"}</span></div>
          <div className="orders-record-items"><strong>{orderItems.length} {orderItems.length===1?"line item":"line items"}</strong><span>{orderItems.slice(0,2).map(i=>i.item_name).join(", ")}{orderItems.length>2?"…":""}</span></div>
          <div className="orders-record-due"><strong>{order.due_at?shortDate(order.due_at):"No due date"}</strong><span>Due date</span></div>
          <div className="orders-record-value"><strong>{money(order.total_amount)}</strong><span className={"order-status status-"+order.status}>{statusLabel[order.status]}</span></div><ChevronRight size={17} className="orders-record-chevron"/>
         </button>})}</div>}
      </section>
      <p className="orders-footnote">Order references are unique within each shop. Financial records are recorded in Indian rupees (₹).</p>
    </section>
  </main>;
}
