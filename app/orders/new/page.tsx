"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, ChevronDown, ChevronRight, LoaderCircle, Minus, Plus, Shirt, UserRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand";
import { LoadingScreen } from "@/components/loading-screen";

type Customer={id:string;full_name:string;phone:string};
function errorMessage(error:unknown,fallback:string){if(error&&typeof error==="object"&&"message" in error&&typeof error.message==="string")return error.message;return error instanceof Error?error.message:fallback;}
function normalizePhone(value:string){return value.replace(/[\\s().-]/g,"");}
type Pricing="per_piece"|"per_kg"|"fixed";
type Line={id:string;itemName:string;pricing:Pricing;quantity:string;unitPrice:string;garmentTag:string;notes:string};
const money=(value:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number.isFinite(value)?value:0);
const newLine=(id:string):Line=>({id,itemName:"",pricing:"per_piece",quantity:"1",unitPrice:"",garmentTag:"",notes:""});

export default function NewOrderPage(){
 const router=useRouter();
 const [shopId,setShopId]=useState("");
 const [step,setStep]=useState(0);
 const [customers,setCustomers]=useState<Customer[]>([]);
 const [customerId,setCustomerId]=useState("");
 const [lines,setLines]=useState<Line[]>([newLine("line-1")]);
 const [dueAt,setDueAt]=useState("");
 const [notes,setNotes]=useState("");
 const [discount,setDiscount]=useState("0");
 const [initialPayment,setInitialPayment]=useState("0");
 const [paymentMethod,setPaymentMethod]=useState("cash");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [lineSequence,setLineSequence]=useState(2);
 const [showCustomerForm,setShowCustomerForm]=useState(false);
 const [customerName,setCustomerName]=useState("");
 const [customerPhone,setCustomerPhone]=useState("");
 const [customerAddress,setCustomerAddress]=useState("");
 const [savingCustomer,setSavingCustomer]=useState(false);

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
    const {data:rows,error:customerError}=await supabase.from("customers").select("id,full_name,phone").eq("shop_id",member.shop_id).order("full_name");
    if(customerError)throw customerError;
    if(!active)return;
    setShopId(member.shop_id);setCustomers((rows??[]) as Customer[]);
   }catch(e){if(active)setError(e instanceof Error?e.message:"Could not prepare the order form.");}
   finally{if(active)setLoading(false);}
  }
  init();return()=>{active=false;};
 },[router]);

 const subtotal=useMemo(()=>lines.reduce((sum,line)=>{
  const q=Number(line.quantity),p=Number(line.unitPrice);
  return sum+(q>0&&p>=0&&Number.isFinite(q)&&Number.isFinite(p)?Math.round(q*p*100)/100:0);
 },0),[lines]);
 const discountAmount=Number(discount)||0;
 const total=Math.max(0,subtotal-discountAmount);
 const paymentAmount=Number(initialPayment)||0;
 const outstanding=Math.max(0,total-paymentAmount);

 function patchLine(id:string,patch:Partial<Line>){
  setLines(current=>current.map(line=>line.id===id?{...line,...patch}:line));
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError("");
  if(!shopId){setError("Your shop workspace could not be identified. Please reload and try again.");return;}
  if(!customerId){setError("Choose a customer before creating the order.");return;}
  if(lines.length<1){setError("Add at least one item.");return;}
  for(let i=0;i<lines.length;i++){
   const line=lines[i];
   if(!line.itemName.trim()){setError(`Enter a name for item ${i+1}.`);return;}
   const q=Number(line.quantity),p=Number(line.unitPrice);
   if(!Number.isFinite(q)||q<=0||q>1000000){setError(`Enter a valid quantity for item ${i+1}.`);return;}
   if(line.unitPrice.trim()===""||!Number.isFinite(p)||p<0||p>1000000){setError(`Enter a valid unit price for item ${i+1}.`);return;}
  }
  if(!Number.isFinite(discountAmount)||discountAmount<0||discountAmount>subtotal){setError("Discount must be between ₹0 and the subtotal.");return;}
  if(!Number.isFinite(paymentAmount)||paymentAmount<0||paymentAmount>total){setError("Initial payment cannot exceed the final order total.");return;}
  setSaving(true);
  try{
   const supabase=createClient();
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){router.replace("/auth");return;}
   const {data,error:rpcError}=await supabase.rpc("create_shop_order",{
    p_shop_id:shopId,
    p_customer_id:customerId,
    p_due_at:dueAt?new Date(dueAt).toISOString():null,
    p_notes:notes.trim()||null,
    p_discount_amount:Math.round(discountAmount*100)/100,
    p_items:lines.map(line=>({item_name:line.itemName.trim(),pricing:line.pricing,quantity:Number(line.quantity),unit_price:Number(line.unitPrice),garment_tag:line.garmentTag.trim()||null,notes:line.notes.trim()||null})),
    p_initial_payment:Math.round(paymentAmount*100)/100,
    p_payment_method:paymentMethod
   });
   if(rpcError)throw rpcError;
   const result=Array.isArray(data)?data[0]:data;
   if(!result?.created_order_id)throw new Error("The database did not return an order reference. Refresh the order list before retrying.");
   router.replace("/orders/"+result.created_order_id);
  }catch(e){setError(errorMessage(e,"Could not create this order. Please try again."));}
  finally{setSaving(false);}
 }

 if(loading)return <LoadingScreen variant="new-order"/>;

 return <main className="orders-shell">
  <header className="orders-topbar"><button type="button" className="orders-back" onClick={()=>router.push("/orders")}><ArrowLeft size={16}/> All orders</button><BrandLogo className="compact-header-logo" priority/><span className="orders-top-label">NEW ORDER</span></header>
  <form className="new-order-content" onSubmit={submit}>
   <div className="new-order-heading"><div><div className="orders-eyebrow">NEW ORDER · STEP {String(step+1).padStart(2,"0")} OF 03</div><h1>Create an order<span>.</span></h1><p>{step===0?"Start with the customer and expected collection date.":step===1?"Add garments, services and any special instructions.":"Review the total, apply a discount and record an advance payment."}</p></div><div className="new-order-ref"><span>ORDER REFERENCE</span><strong>Generated on save</strong><small>A unique number is assigned for this shop.</small></div></div>
   
   <nav className="order-wizard-steps" aria-label="Order creation steps">{[{title:"Customer",hint:"Who & when"},{title:"Garments & services",hint:"Items & notes"},{title:"Review & payment",hint:"Total & advance"}].map((item,index)=><button key={item.title} type="button" className={"order-wizard-step "+(step===index?"is-current":step>index?"is-complete":"")} onClick={()=>{if(index<step)setStep(index);}} disabled={index>step}><span className="order-wizard-index">{step>index?<Check size={15}/>:String(index+1).padStart(2,"0")}</span><span><strong>{item.title}</strong><small>{item.hint}</small></span></button>)}</nav>
   {error&&<div className="order-alert error" role="alert">{error}</div>
   {customers.length===0&&!loading&&<div className="order-alert info">Add a customer in the Customer section below to continue. You can do it here without leaving this form.</div>}
   <div className={"new-order-layout "+(step===2?"is-summary-step":"")}>
    <div className={"new-order-main "+(step===2?"is-hidden":"")}>
     {step===0&&({step===1&&({step===1&&(<section className="order-form-card">
      <div className="order-section-heading"><span className="order-section-icon"><UserRound size={18}/></span><div><h2>Customer & collection</h2><p>Who does this order belong to?</p></div><span className="order-step-number">01</span></div>
      <div className="order-form-grid">
       <label className="order-field order-field-wide">Customer <b>*</b><span className="order-select-wrap"><select value={customerId} onChange={e=>setCustomerId(e.target.value)} required><option value="">Choose a customer…</option>{customers.map(c=><option key={c.id} value={c.id}>{c.full_name} · {c.phone}</option>)}</select><ChevronDown size={16}/></span><small>Not listed? <button type="button" className="inline-action" onClick={()=>{setShowCustomerForm(v=>!v);setError("");}}>+ Add customer here</button>.</small></label>
       {showCustomerForm&&<div className="inline-customer-form order-field-wide"><div className="inline-customer-heading"><div><strong>Quick add customer</strong><small>Add their name and phone without leaving this order.</small></div><button type="button" aria-label="Close quick add" onClick={()=>setShowCustomerForm(false)}><X size={17}/></button></div><div className="order-form-grid"><label className="order-field">Full name <b>*</b><input value={customerName} onChange={e=>setCustomerName(e.target.value)} maxLength={160} placeholder="Customer name"/></label><label className="order-field">Phone number <b>*</b><input type="tel" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} maxLength={24} placeholder="+91 98765 43210"/></label><label className="order-field order-field-wide">Address <span className="field-optional">OPTIONAL</span><input value={customerAddress} onChange={e=>setCustomerAddress(e.target.value)} maxLength={300} placeholder="Area, city"/></label></div><button type="button" className="orders-primary inline-customer-save" disabled={savingCustomer} onClick={async()=>{setError("");const name=customerName.trim();const phone=customerPhone.trim();const normalized=normalizePhone(phone);if(!name||normalized.length<7||normalized.length>16){setError("Enter a customer name and a valid phone number.");return;}setSavingCustomer(true);try{const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Your session expired. Please sign in again.");const {data,error:insertError}=await supabase.from("customers").insert({shop_id:shopId,full_name:name,phone,phone_normalized:normalized,address:customerAddress.trim()||null,created_by:user.id}).select("id,full_name,phone").single();if(insertError){if(insertError.code==="23505")throw new Error("A customer with this phone number already exists in your shop.");throw insertError;}const added=data as Customer;setCustomers(current=>[...current,added].sort((a,b)=>a.full_name.localeCompare(b.full_name)));setCustomerId(added.id);setCustomerName("");setCustomerPhone("");setCustomerAddress("");setShowCustomerForm(false);}catch(e){setError(errorMessage(e,"Could not add this customer."));}finally{setSavingCustomer(false);}}}>{savingCustomer?<LoaderCircle className="spin" size={15}/>:<Plus size={15}/>} Save & select customer</button></div>}
       <label className="order-field order-field-wide">Expected collection date <span className="field-optional">OPTIONAL</span><input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/><small>Leave blank if the collection date is not confirmed.</small></label>
      </div>
     </section>)})})}
     <section className="order-form-card">
      <div className="order-section-heading"><span className="order-section-icon"><Shirt size={18}/></span><div><h2>Garments & services</h2><p>Each line can use piece, weight, or fixed pricing.</p></div><span className="order-step-number">02</span></div>
      <div className="order-line-list">{lines.map((line,index)=><div className="order-line-card" key={line.id}>
       <div className="order-line-heading"><span className="order-line-index">{String(index+1).padStart(2,"0")}</span><strong>Item details</strong>{lines.length>1&&<button className="order-remove-line" type="button" onClick={()=>setLines(current=>current.filter(item=>item.id!==line.id))}><Minus size={14}/> Remove</button>}</div>
       <div className="order-form-grid">
        <label className="order-field">Garment / service <b>*</b><input value={line.itemName} onChange={e=>patchLine(line.id,{itemName:e.target.value})} placeholder="e.g. Shirt wash & iron" maxLength={120} required/></label>
        <label className="order-field">Pricing type <span className="order-select-wrap"><select value={line.pricing} onChange={e=>patchLine(line.id,{pricing:e.target.value as Pricing})}><option value="per_piece">Per piece</option><option value="per_kg">Per kilogram</option><option value="fixed">Fixed charge</option></select><ChevronDown size={16}/></span></label>
        <label className="order-field">Quantity <b>*</b><input type="number" min="0.001" max="1000000" step={line.pricing==="per_piece"?"1":"0.001"} value={line.quantity} onChange={e=>patchLine(line.id,{quantity:e.target.value})} required/><small>{line.pricing==="per_piece"?"Number of garments":line.pricing==="per_kg"?"Weight in kilograms":"Quantity for this fixed charge"}</small></label>
        <label className="order-field">Unit price (₹) <b>*</b><input type="number" min="0" max="1000000" step="0.01" value={line.unitPrice} onChange={e=>patchLine(line.id,{unitPrice:e.target.value})} placeholder="0.00" required/><small>Charged {line.pricing==="per_piece"?"per garment":line.pricing==="per_kg"?"per kg":"for each unit"}</small></label>
        <label className="order-field">Garment tag / serial <span className="field-optional">OPTIONAL</span><input value={line.garmentTag} onChange={e=>patchLine(line.id,{garmentTag:e.target.value})} placeholder="e.g. SH-01" maxLength={80}/></label>
        <label className="order-field">Item note <span className="field-optional">OPTIONAL</span><input value={line.notes} onChange={e=>patchLine(line.id,{notes:e.target.value})} placeholder="Stain, delicate fabric…" maxLength={500}/></label>
       </div>
       <div className="order-line-total"><span>{Number(line.quantity)>0&&Number(line.unitPrice)>=0?Number(line.quantity).toLocaleString("en-IN")+" × "+money(Number(line.unitPrice)):"Enter quantity and price"}</span><strong>{money(Math.max(0,Number(line.quantity)||0)*Math.max(0,Number(line.unitPrice)||0))}</strong></div>
      </div>)}</div>
      <button type="button" className="order-add-line" onClick={()=>{setLines(current=>[...current,newLine("line-"+lineSequence)]);setLineSequence(value=>value+1);}} disabled={lines.length>=30}><Plus size={16}/> Add another item <span>{lines.length}/30</span></button>
     </section>
     <section className="order-form-card">
      <div className="order-section-heading"><span className="order-section-icon"><CalendarClock size={18}/></span><div><h2>Order notes</h2><p>Anything the team should remember.</p></div><span className="order-step-number">03</span></div>
      <label className="order-field">Notes for this order <span className="field-optional">OPTIONAL</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions, stain notes, customer requests…" maxLength={2000}/></label>
     </section>
    </div>
    {step===2&&<aside className="order-summary-column">
     <section className="order-summary-card"><div className="order-summary-heading"><span>ORDER SUMMARY</span><span className="summary-live"><i/> Live total</span></div>
      <div className="order-summary-count"><span className="summary-glyph"><Shirt size={19}/></span><div><strong>{lines.length} {lines.length===1?"line item":"line items"}</strong><small>{lines.reduce((s,l)=>s+(Number(l.quantity)>0?Number(l.quantity):0),0).toLocaleString("en-IN")} total units / kg</small></div></div>
      <div className="order-money-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
      <label className="order-discount-field">Discount (₹)<input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)} /></label>
      <div className="order-money-row order-grand-total"><span>Order total</span><strong>{money(total)}</strong></div>
      <div className="order-payment-section"><h3>Record payment now</h3><p>Optional — you can record more payments later.</p><label className="order-field">Amount received (₹)<input type="number" min="0" max={total} step="0.01" value={initialPayment} onChange={e=>setInitialPayment(e.target.value)}/></label>{paymentAmount>0&&<label className="order-field">Payment method<span className="order-select-wrap"><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select><ChevronDown size={15}/></span></label>}</div>
      <div className="order-balance-preview"><span>Balance due after payment</span><strong>{money(outstanding)}</strong></div>
      <button className="orders-primary order-submit" type="submit" disabled={saving||customers.length===0}>{saving?<><LoaderCircle className="spin" size={17}/> Creating order…</>:<><Check size={17}/> Create order</>}</button>
      <p className="order-summary-note">Saving creates the order, item lines, initial status history and any payment together.</p>
     </section>
     <div className="order-trust-note"><span><Check size={15}/></span><p><strong>Made for the counter.</strong><br/>Order numbers are generated per shop, and totals are recalculated by the database.</p></div>
    </aside>}
   </div>
   <div className="order-wizard-actions">{step>0&&<button type="button" className="order-wizard-previous" onClick={()=>{setError("");setStep(value=>value-1);}}><ArrowLeft size={16}/> Previous</button>}<span className="order-wizard-step-caption">STEP {step+1} OF 3</span>{step<2&&<button type="button" className="orders-primary order-wizard-next" onClick={()=>{setError("");if(step===0){if(!customerId){setError("Choose a customer before continuing.");return;}setStep(1);return;}for(let i=0;i<lines.length;i++){const line=lines[i];if(!line.itemName.trim()){setError(`Enter a name for item ${i+1}.`);return;}const q=Number(line.quantity),p=Number(line.unitPrice);if(!Number.isFinite(q)||q<=0||q>1000000){setError(`Enter a valid quantity for item ${i+1}.`);return;}if(line.unitPrice.trim()===""||!Number.isFinite(p)||p<0||p>1000000){setError(`Enter a valid unit price for item ${i+1}.`);return;}}setStep(2);}} >Continue <ChevronRight size={16} className="order-next-arrow"/></button>}</div>
  </form>
 </main>;
}
