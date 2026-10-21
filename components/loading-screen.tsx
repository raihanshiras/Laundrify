"use client";

import { BrandLogo } from "@/components/brand";

export type LoadingVariant = "dashboard" | "orders" | "new-order" | "order-detail" | "customers" | "payments" | "auth" | "onboarding";

const variants: Record<LoadingVariant, { eyebrow: string; title: string; description: string; status: string }> = {
  dashboard: { eyebrow: "YOUR WORKSPACE", title: "Bringing it all together", description: "Gathering today's orders, payments and shop activity.", status: "Syncing shop activity" },
  orders: { eyebrow: "ORDER WORKSPACE", title: "Getting things in order", description: "Preparing your latest drop-offs and collection statuses.", status: "Organizing orders" },
  "new-order": { eyebrow: "ORDER INTAKE", title: "Preparing the counter", description: "Getting your customer list and order form ready.", status: "Preparing a fresh order" },
  "order-detail": { eyebrow: "ORDER DETAILS", title: "Opening your order", description: "Putting garment, payment and status details together.", status: "Gathering order details" },
  customers: { eyebrow: "CUSTOMER DIRECTORY", title: "One moment, please", description: "Bringing your customer records into view.", status: "Loading customer records" },
  payments: { eyebrow: "PAYMENTS & LEDGER", title: "Balancing the books", description: "Gathering recorded payments and refunds.", status: "Preparing the ledger" },
  auth: { eyebrow: "SECURE ACCESS", title: "Welcome to Laundrify", description: "Preparing a calm, secure start to your workspace.", status: "Checking your session" },
  onboarding: { eyebrow: "YOUR WORKSPACE", title: "Setting up your shop", description: "Getting everything ready for your first day with Laundrify.", status: "Preparing your workspace" },
};

export function LoadingScreen({ variant }: { variant: LoadingVariant }) {
  const copy = variants[variant];
  return (
    <main className={`premium-loading premium-loading--${variant}`} role="status" aria-live="polite" aria-label={copy.status}>
      <div className="loading-aura loading-aura-one" />
      <div className="loading-aura loading-aura-two" />
      <div className="loading-grid-texture" />
      <div className="loading-stage">
        <div className="loading-emblem">
          <span className="loading-orbit loading-orbit-one" />
          <span className="loading-orbit loading-orbit-two" />
          <span className="loading-orbit-dot" />
          <BrandLogo variant="mark" className="loading-logo-mark" priority />
          <span className="loading-tile loading-tile-one" />
          <span className="loading-tile loading-tile-two" />
        </div>
        <BrandLogo className="loading-wordmark" priority />
        <div className="loading-copy">
          <span className="loading-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}<span>.</span></h1>
          <p>{copy.description}</p>
        </div>
        <div className="loading-progress" aria-hidden="true"><span /></div>
        <div className="loading-status"><i />{copy.status}<span className="loading-status-dots"><i /><i /><i /></span></div>
      </div>
      <div className="loading-footer"><span>LAUNDRIFY</span><span>CARE IN EVERY DETAIL</span></div>
    </main>
  );
}
