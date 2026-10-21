"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, Clock3, LoaderCircle, MessageCircle, PackageCheck, ReceiptText, RotateCcw, Shirt, UserRound, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand";
import { LoadingScreen } from "@/components/loading-screen";

type Status="received"|"processing"|"ready"|"delivered"|"cancelled";
type Order={id:string;shop_id:string;customer_id:string;shop_order_number:string;status:Status;received_at:string;due_at:string|null;ready_at:string|null;delivered_at:string|null;notes:string|null;subtotal:number;discount_amount:number;total_amount:number};
type Customer={id:string;full_name:string;phone:string;address:string|null};
type Item={id:string;item_name:string;pricing:"per_piece"|"per_kg"|"fixed";quantity:number;unit_price:number;line_total:number;garment_tag:string|null;notes:string|null};
type Payment={id:string;kind:"payment"|"refund";method:string;amount:number;notes:string|null;recorded_at:string};
type History={id:string;old_status:Status|null;new_status:Status;note:string|null;changed_at:string};
const money=(v:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v||0));
const dateTime=(v:string|null)=>v?new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v)):"Not set";
const statusLabel:Record<Status,string>={received:"Received",processing:"Processing",ready:"Ready",delivered:"Delivered",cancelled:"Cancelled"};
const statusDescription:Record<Status,string>={received:"Order has been accepted and is waiting to be processed.",processing:"Garments are currently being cleaned or handled.",ready:"The order is ready for the customer to collect.",delivered:"The order has been handed over to the customer.",cancelled:"This order has been cancelled."};
const methodLabel:Record<string,string>={cash:"Cash",upi:"UPI",card:"Card",bank_transfer:"Bank transfer",other:"Other"};
const pricingLabel:Record<string,string>={per_piece:"per piece",per_kg:"per kg",fixed:"fixed charge"};

export default function OrderDetailPage(){
 const params=useParams<{id:string}>();
 const router=useRouter();
 const orderId=params.id;
 const [shopId,setShopId]=useState("");
 const [order,setOrder]=useState<Order|null>(null);
 const [customer,setCustomer]=useState<Customer|null>(null);
 const [items,setItems]=useState<Item[]>([]);
 const [payments,setPayments]=useState<Payment[]>([]);
 const [history,setHistory]=useState<History[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [paymentAmount,setPaymentAmount]=useState("");
 const [paymentMethod,setPaymentMethod]=useState("cash");
 const [paymentNote,setPaymentNote]=useState("");

 const load=useCallback(async(targetShopId:string)=>{
  const supabase=createClient();
  const {data:orderRow,error:orderError}=await supabase.from("orders").select("id,shop_id,customer_id,shop_order_number,status,received_at,due_at,ready_at,delivered_at,notes,subtotal,discount_amount,total_amount").eq("shop_id",targetShopId).eq("id",orderId).maybeSingle();
  if(orderError)throw orderError;
  if(!orderRow)throw new Error("This order could not be found in your shop.");
  const current=orderRow as Order;
  const [customerResult,itemResult,paymentResult,historyResult]=await Promise.all([
   supabase.from("customers").select("id,full_name,phone,address").eq("shop_id",targetShopId).eq("id",current.customer_id).maybeSingle(),
   supabase.from("order_items").select("id,item_name,pricing,quantity,unit_price,line_total,garment_tag,notes").eq("shop_id",targetShopId).eq("order_id",orderId).order("created_at"),
   supabase.from("payments").select("id,kind,method,amount,notes,recorded_at").eq("shop_id",targetShopId).eq("order_id",orderId).order("recorded_at",{ascending:false}),
   supabase.from("order_status_history").select("id,old_status,new_status,note,changed_at").eq("shop_id",targetShopId).eq("order_id",orderId).order("changed_at",{ascending:false})
  ]);
  if(customerResult.error)throw customerResult.error;
  if(itemResult.error)throw itemResult.error;
  if(paymentResult.error)throw paymentResult.error;
  if(historyResult.error)throw historyResult.error;
  setOrder(current);setCustomer((customerResult.data as Customer|null)??null);
  setItems((itemResult.data??[]) as Item[]);setPayments((paymentResult.data??[]) as Payment[]);setHistory((historyResult.data??[]) as History[]);
 },[orderId]);

 useEffect(()=>{
  let active=true;
  async function init(){
   try{
    const supabase=createClient();
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){router.replace("/auth");return;}
    const {data:member,error:memberError}=await supabase.from("shop_members").select("shop_id").limit(1).maybeSingle();
    if(memberError)throw memberError;
    if(!member?.shop_id){router.replace("/onboarding");return;}
    if(!active)return;
    setShopId(member.shop_id);
    await load(member.shop_id);
   }catch(e){if(active)setError(e instanceof Error?e.message:"Could not load this order.");}
   finally{if(active)setLoading(false);}
  }
  init();return()=>{active=false;};
 },[router,load]);

 const paid=useMemo(()=>payments.reduce((sum,p)=>sum+(p.kind==="refund"?-Number(p.amount):Number(p.amount)),0),[payments]);
 const outstanding=Math.max(0,Number(order?.total_amount||0)-paid);
 const nextStatuses:Status[]=order?.status==="received"?["processing","cancelled"]:order?.status==="processing"?["ready","cancelled"]:order?.status==="ready"?["delivered"]:[];
 const whatsappUrl=customer&&order?"https://wa.me/"+customer.phone.replace(/[^0-9]/g,"")+"?text="+encodeURIComponent("Hello "+customer.full_name+", your laundry order "+order.shop_order_number+" is "+statusLabel[order.status].toLowerCase()+".\n\nOrder total: "+money(Number(order.total_amount))+(Number(order.discount_amount)>0?"\nDiscount: "+money(Number(order.discount_amount)):"")+"\nAdvance paid: "+money(Math.max(0,paid))+"\nBalance due: "+money(outstanding)+"\nExpected collection: "+(order.due_at?dateTime(order.due_at):"Not scheduled")+"\n\n"+(order.status==="ready"?"Your order is ready for collection. ":"")+"Thank you!"):"";

 async function changeStatus(next:Status){
  if(!order||!shopId)return;
  if(next==="cancelled"&&!window.confirm("Cancel this order? This status change will be recorded in order history."))return;
  if(next==="delivered"&&outstanding>0&&!window.confirm("There is an outstanding balance of "+money(outstanding)+". Mark this order delivered anyway?"))return;
  setBusy(true);setError("");setSuccess("");
  try{
   const {error:rpcError}=await createClient().rpc("update_shop_order_status",{p_shop_id:shopId,p_order_id:order.id,p_new_status:next,p_note:null});
   if(rpcError)throw rpcError;
   await load(shopId);setSuccess("Order status updated to "+statusLabel[next]+".");
  }catch(e){setError(e instanceof Error?e.message:"Could not update order status.");}
  finally{setBusy(false);}
 }

 async function recordPayment(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!order||!shopId)return;
  const amount=Number(paymentAmount);
  if(!Number.isFinite(amount)||amount<=0||amount>outstanding){setError("Enter a payment between ₹0.01 and "+money(outstanding)+".");return;}
  setBusy(true);setError("");setSuccess("");
  try{
   const {error:rpcError}=await createClient().rpc("record_shop_order_payment",{p_shop_id:shopId,p_order_id:order.id,p_amount:Math.round(amount*100)/100,p_method:paymentMethod,p_notes:paymentNote.trim()||null});
   if(rpcError)throw rpcError;
   await load(shopId);setPaymentAmount("");setPaymentNote("");setSuccess("Payment recorded successfully.");
  }catch(e){setError(e instanceof Error?e.message:"Could not record this payment.");}
  finally{setBusy(false);}
 }

 if(loading)return <LoadingScreen variant="order-detail"/>;
 if(!order)return <main className="orders-shell"><header className="orders-topbar"><button className="orders-back" onClick={()=>router.push("/orders")}><ArrowLeft size={16}/> All orders</button><BrandLogo className="compact-header-logo" priority/><span className="orders-top-label">ORDER DETAILS</span></header><section className="orders-content"><div className="order-alert error">{error||"Order not found."}</div><button className="orders-primary" onClick={()=>router.push("/orders")}><ArrowLeft size={15}/> Back to orders</button></section></main>;

 return <main className="orders-shell">
  <header className="orders-topbar"><button type="button" className="orders-back" onClick={()=>router.push("/orders")}><ArrowLeft size={16}/> All orders</button><div className="orders-brand"><span className="orders-brand-mark"><Shirt size={19}/></span><span>laundri<b>fy</b></span></div><span className="orders-top-label">ORDER DETAILS</span></header>
  <section className="order-detail-content">
   <button className="order-detail-back" type="button" onClick={()=>router.push("/orders")}><ArrowLeft size={15}/> All orders</button>
   <div className="order-detail-heading"><div><div className="orders-eyebrow">ORDER REFERENCE</div><h1>{order.shop_order_number}<span>.</span></h1><p>Created {dateTime(order.received_at)}</p></div><span className={"order-status order-status-large status-"+order.status}>{statusLabel[order.status]}</span></div>
   {error&&<div className="order-alert error" role="alert">{error}</div>}{success&&<div className="order-alert success" role="status">{success}</div>}
   <div className="order-detail-layout">
    <div className="order-detail-main">
     <section className="order-detail-card order-status-card"><div className="detail-card-heading"><div><h2>Order progress</h2><p>{statusDescription[order.status]}</p></div><Clock3 size={19}/></div>
      <div className="order-progress">{(["received","processing","ready","delivered"] as Status[]).map((status,index)=>{const isCancelled=order.status==="cancelled";const states=["received","processing","ready","delivered"];const currentIndex=states.indexOf(order.status);const done=!isCancelled&&index<=currentIndex;return <div className={"order-progress-step "+(done?"done":"")+(order.status===status?" current":"")} key={status}><span className="order-progress-dot">{done?<Check size={13}/>:index+1}</span><strong>{statusLabel[status]}</strong>{index<3&&<i className={done&&index<currentIndex?"filled":""}/>}</div>})}</div>
      {order.status==="cancelled"&&<div className="order-cancelled-banner">This order was cancelled. It remains in your history for reference.</div>}
      {nextStatuses.length>0&&<div className="order-status-actions">{nextStatuses.map(next=><button key={next} type="button" disabled={busy} className={next==="cancelled"?"order-cancel-action":next==="processing"?"order-secondary-action":"orders-primary"} onClick={()=>changeStatus(next)}>{busy?<LoaderCircle className="spin" size={15}/>:next==="processing"?<RotateCcw size={15}/>:next==="cancelled"?null:<Check size={15}/>} {next==="processing"?"Move to processing":next==="cancelled"?"Cancel order":next==="ready"?"Mark ready for collection":"Mark as delivered"}</button>)}</div>}
     </section>
     <section className="order-detail-card"><div className="detail-card-heading"><div><h2>Garments & services</h2><p>{items.length} {items.length===1?"line item":"line items"}</p></div><Shirt size={19}/></div>
      <div className="order-detail-items">{items.map(item=><article className="order-detail-item" key={item.id}><span className="detail-item-icon"><Shirt size={16}/></span><div className="detail-item-copy"><strong>{item.item_name}</strong><span>{Number(item.quantity).toLocaleString("en-IN")} {item.pricing==="per_piece"?"piece":item.pricing==="per_kg"?"kg":"unit"} × {money(Number(item.unit_price))} · {pricingLabel[item.pricing]}</span>{item.garment_tag&&<small>Tag: {item.garment_tag}</small>}{item.notes&&<small>{item.notes}</small>}</div><strong className="detail-item-price">{money(Number(item.line_total))}</strong></article>)}</div>
      {order.notes&&<div className="order-notes-block"><strong>Order notes</strong><p>{order.notes}</p></div>}
      <div className="order-total-breakdown"><div><span>Subtotal</span><strong>{money(Number(order.subtotal))}</strong></div>{Number(order.discount_amount)>0&&<div><span>Discount</span><strong>−{money(Number(order.discount_amount))}</strong></div>}<div className="order-total-final"><span>Order total</span><strong>{money(Number(order.total_amount))}</strong></div></div>
     </section>
     <section className="order-detail-card"><div className="detail-card-heading"><div><h2>Payment history</h2><p>Manual records; this does not verify bank transfers.</p></div><ReceiptText size={19}/></div>
      <div className="payment-balance-strip"><div><span>Paid so far</span><strong>{money(paid)}</strong></div><div><span>Balance due</span><strong className={outstanding>0?"balance-warning":""}>{money(outstanding)}</strong></div></div>
      {payments.length===0?<p className="order-no-history">No payments recorded yet.</p>:<div className="order-payment-list">{payments.map(payment=><div className="order-payment-row" key={payment.id}><span className="payment-method-icon"><Wallet size={15}/></span><div><strong>{payment.kind==="refund"?"Refund":"Payment"} · {methodLabel[payment.method]||payment.method}</strong><small>{dateTime(payment.recorded_at)}{payment.notes?" · "+payment.notes:""}</small></div><strong className={payment.kind==="refund"?"refund-amount":""}>{payment.kind==="refund"?"−":""}{money(Number(payment.amount))}</strong></div>)}</div>}
      {outstanding>0&&order.status!=="cancelled"&&<form className="record-payment-form" onSubmit={recordPayment}><h3>Record a payment</h3><div className="payment-entry-grid"><label className="order-field">Amount received (₹)<input type="number" min="0.01" max={outstanding} step="0.01" required value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} placeholder={outstanding.toFixed(2)}/></label><label className="order-field">Method<span className="order-select-wrap"><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></span></label><label className="order-field payment-note-field">Note <span className="field-optional">OPTIONAL</span><input value={paymentNote} onChange={e=>setPaymentNote(e.target.value)} placeholder="Reference or short note" maxLength={500}/></label></div><button className="orders-primary" type="submit" disabled={busy||!paymentAmount.trim()}>{busy?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>} Record payment</button></form>}
     </section>
     <section className="order-detail-card"><div className="detail-card-heading"><div><h2>Status history</h2><p>Every workflow change is recorded.</p></div><Clock3 size={19}/></div><div className="order-history-list">{history.map(entry=><div className="order-history-entry" key={entry.id}><span className="history-dot"/><div><strong>{entry.old_status?statusLabel[entry.old_status]+" → "+statusLabel[entry.new_status]:"Order created · "+statusLabel[entry.new_status]}</strong>{entry.note&&<p>{entry.note}</p>}<small>{dateTime(entry.changed_at)}</small></div></div>)}</div></section>
    </div>
    <aside className="order-detail-side">
     <section className="order-detail-card customer-detail-card"><div className="detail-card-heading"><div><h2>Customer</h2><p>Attached to this order</p></div><UserRound size={19}/></div><div className="detail-customer-avatar">{customer?.full_name.split(/\s+/).slice(0,2).map(n=>n[0]?.toUpperCase()).join("")||"?"}</div><strong className="detail-customer-name">{customer?.full_name||"Customer record"}</strong><span className="detail-customer-phone">{customer?.phone||"No phone number"}</span>{customer?.address&&<span className="detail-customer-address">{customer.address}</span>}{customer?.phone&&<a className="order-whatsapp-link" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={16}/> Prepare WhatsApp message</a>}<button className="order-secondary-action customer-view-button" type="button" onClick={()=>router.push("/customers")}>View customer directory</button></section>
     <section className="order-detail-card order-milestones"><h2><CalendarClock size={17}/> Important dates</h2><div><span>Received</span><strong>{dateTime(order.received_at)}</strong></div><div><span>Expected collection</span><strong>{dateTime(order.due_at)}</strong></div>{order.ready_at&&<div><span>Marked ready</span><strong>{dateTime(order.ready_at)}</strong></div>}{order.delivered_at&&<div><span>Delivered</span><strong>{dateTime(order.delivered_at)}</strong></div>}</section>
     <div className="order-safety-note"><PackageCheck size={18}/><p><strong>Audit-friendly workflow</strong><br/>Status changes and payments are written through database functions with access checks.</p></div>
    </aside>
   </div>
  </section>
 </main>;
}
