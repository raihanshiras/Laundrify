"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft,ArrowUpRight,LoaderCircle,ReceiptText,Search,Shirt,Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand";
import { LoadingScreen } from "@/components/loading-screen";

type Payment={id:string;shop_id:string;order_id:string;kind:"payment"|"refund";method:string;amount:number;notes:string|null;recorded_at:string};
type Order={id:string;customer_id:string;shop_order_number:string;total_amount:number;status:string};
type Customer={id:string;full_name:string;phone:string};
const money=(v:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v||0));
const dateTime=(v:string)=>new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
const methods:Record<string,string>={cash:"Cash",upi:"UPI",card:"Card",bank_transfer:"Bank transfer",other:"Other"};

export default function PaymentsPage(){
 const router=useRouter();
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [payments,setPayments]=useState<Payment[]>([]);
 const [orders,setOrders]=useState<Order[]>([]);
 const [customers,setCustomers]=useState<Customer[]>([]);
 const [query,setQuery]=useState("");
 const [kind,setKind]=useState("all");
 const load=useCallback(async()=>{
  const supabase=createClient();
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){router.replace("/auth");return;}
  const {data:member,error:memberError}=await supabase.from("shop_members").select("shop_id").limit(1).maybeSingle();
  if(memberError)throw memberError;
  if(!member?.shop_id){router.replace("/onboarding");return;}
  const shopId=member.shop_id;
  const [paymentResult,orderResult,customerResult]=await Promise.all([
   supabase.from("payments").select("id,shop_id,order_id,kind,method,amount,notes,recorded_at").eq("shop_id",shopId).order("recorded_at",{ascending:false}).limit(2000),
   supabase.from("orders").select("id,customer_id,shop_order_number,total_amount,status").eq("shop_id",shopId).order("received_at",{ascending:false}).limit(2000),
   supabase.from("customers").select("id,full_name,phone").eq("shop_id",shopId).order("full_name")
  ]);
  if(paymentResult.error)throw paymentResult.error;if(orderResult.error)throw orderResult.error;if(customerResult.error)throw customerResult.error;
  setPayments((paymentResult.data??[]) as Payment[]);setOrders((orderResult.data??[]) as Order[]);setCustomers((customerResult.data??[]) as Customer[]);
 },[router]);
 useEffect(()=>{let alive=true;load().catch(e=>{if(alive)setError(e instanceof Error?e.message:"Could not load payment records.");}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[load]);
 const orderMap=useMemo(()=>Object.fromEntries(orders.map(o=>[o.id,o])),[orders]);
 const customerMap=useMemo(()=>Object.fromEntries(customers.map(c=>[c.id,c])),[customers]);
 const filtered=useMemo(()=>payments.filter(p=>{const o=orderMap[p.order_id];const customer=o?customerMap[o.customer_id]:null;const hay=[o?.shop_order_number,customer?.full_name,customer?.phone,p.method,p.notes].join(" ").toLowerCase();return (kind==="all"||p.kind===kind)&&hay.includes(query.toLowerCase().trim());}),[payments,orderMap,customerMap,kind,query]);
 const received=payments.reduce((s,p)=>s+(p.kind==="refund"?-Number(p.amount):Number(p.amount)),0);
 const today=new Date().toLocaleDateString("en-CA");
 const todayTotal=payments.filter(p=>new Date(p.recorded_at).toLocaleDateString("en-CA")===today).reduce((s,p)=>s+(p.kind==="refund"?-Number(p.amount):Number(p.amount)),0);
 if(loading)return <LoadingScreen variant="payments"/>;
 return <main className="orders-shell">
  <header className="orders-topbar"><button type="button" className="orders-back" onClick={()=>router.push("/")}><ArrowLeft size={16}/> Dashboard</button><BrandLogo className="compact-header-logo" priority/><span className="orders-top-label">PAYMENTS & LEDGER</span></header>
  <section className="orders-content">
   <div className="orders-page-heading"><div><div className="orders-eyebrow">FINANCE WORKSPACE</div><h1>Payments & ledger<span>.</span></h1><p>Review recorded payments and refunds across your shop.</p></div><button className="orders-primary" onClick={()=>router.push("/orders")}><Wallet size={15}/> Open orders</button></div>
   {error&&<div className="order-alert error">{error}</div>}
   <div className="orders-stats"><article className="orders-stat"><span>Net payments recorded</span><strong>{money(received)}</strong><small>Payments less recorded refunds</small></article><article className="orders-stat"><span>Recorded today</span><strong>{money(todayTotal)}</strong><small>Based on payment record date</small></article><article className="orders-stat"><span>Payment records</span><strong>{payments.length}</strong><small>All recorded transactions</small></article><article className="orders-stat"><span>Orders with payments</span><strong>{new Set(payments.map(p=>p.order_id)).size}</strong><small>Distinct orders</small></article></div>
   <section className="orders-table-card"><div className="orders-list-head"><div><h2>Transaction history</h2><p>These are manual records, not bank-verified transactions.</p></div><span className="orders-total-pill">{filtered.length} records</span></div>
    <div className="orders-toolbar"><label className="orders-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search order, customer, phone…"/>{query&&<button type="button" onClick={()=>setQuery("")}>×</button>}</label><label className="orders-toolbar-label">Type <select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All records</option><option value="payment">Payments</option><option value="refund">Refunds</option></select></label></div>
    {filtered.length===0?<div className="orders-empty"><div className="orders-empty-icon"><ReceiptText size={22}/></div><strong>{payments.length?"No matching transactions":"No payments recorded yet"}</strong><span>{payments.length?"Try another search or transaction type.":"Payments will appear here after you record them on an order."}</span>{!payments.length&&<button className="orders-primary" onClick={()=>router.push("/orders")}>Open orders</button>}</div>:<div className="orders-record-list">{filtered.map(p=>{const o=orderMap[p.order_id];const customer=o?customerMap[o.customer_id]:null;return <button className="payment-ledger-row" type="button" key={p.id} onClick={()=>o&&router.push("/orders/"+o.id)}><span className="orders-record-icon"><Wallet size={16}/></span><span className="ledger-primary"><strong>{o?.shop_order_number||"Order unavailable"}</strong><small>{customer?.full_name||"Unknown customer"}{customer?.phone?" · "+customer.phone:""}</small></span><span className="ledger-method"><strong>{p.kind==="refund"?"Refund":"Payment"} · {methods[p.method]||p.method}</strong><small>{dateTime(p.recorded_at)}{p.notes?" · "+p.notes:""}</small></span><strong className={"ledger-amount "+(p.kind==="refund"?"refund-amount":"")}>{p.kind==="refund"?"−":"+"}{money(Number(p.amount))}</strong><ArrowUpRight size={16} className="ledger-arrow"/></button>})}</div>}
   </section>
   <p className="orders-footnote">Selecting a transaction opens its order, where you can review the balance and payment history.</p>
  </section>
 </main>;
}
