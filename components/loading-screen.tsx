"use client";

import { BrandLogo } from "@/components/brand";

export type LoadingVariant = "dashboard" | "orders" | "new-order" | "order-detail" | "customers" | "payments" | "auth" | "onboarding";

const variants: Record<LoadingVariant, { eyebrow: string; title: string; description: string; status: string }> = {
  dashboard: { eyebrow: "YOUR WORKSPACE", title: "A clearer view of your day", description: "Bringing your shop activity into focus.", status: "Gathering your workspace" },
  orders: { eyebrow: "ORDER WORKSPACE", title: "Every order, in its place", description: "Getting your latest drop-offs and collections ready.", status: "Arranging order details" },
  "new-order": { eyebrow: "ORDER INTAKE", title: "Ready for the next order", description: "Preparing the customer details you need at the counter.", status: "Preparing order intake" },
  "order-detail": { eyebrow: "ORDER DETAILS", title: "The details matter", description: "Bringing garment, payment and status information together.", status: "Opening order details" },
  customers: { eyebrow: "CUSTOMER DIRECTORY", title: "Your people, at a glance", description: "Preparing your customer records.", status: "Gathering customer records" },
  payments: { eyebrow: "PAYMENTS & LEDGER", title: "Everything accounted for", description: "Bringing your recorded payments into view.", status: "Preparing your ledger" },
  auth: { eyebrow: "A BETTER WAY TO CARE", title: "Welcome back", description: "Making sure your workspace is ready and secure.", status: "Checking your session" },
  onboarding: { eyebrow: "YOUR WORKSPACE", title: "A fresh start for your shop", description: "Setting up a thoughtful, simpler way to manage your day.", status: "Preparing your workspace" },
};

export function LoadingScreen({ variant }: { variant: LoadingVariant }) {
  const copy = variants[variant];

  return (
    <main
      className={`premium-loading premium-loading--${variant}`}
      role="status"
      aria-live="polite"
      aria-label={copy.status}
    >
      <div className="loader-atmosphere" aria-hidden="true">
        <span className="loader-orb loader-orb-one" />
        <span className="loader-orb loader-orb-two" />
        <span className="loader-thread loader-thread-one" />
        <span className="loader-thread loader-thread-two" />
        <span className="loader-grain" />
      </div>

      <div className="loader-topline" aria-hidden="true">
        <BrandLogo variant="mark" className="loader-mini-mark" priority />
        <span>LAUNDRIFY <i /> MADE FOR THE EVERYDAY</span>
      </div>

      <section className="loading-stage">
        <div className="loader-art" aria-hidden="true">
          <div className="loader-halo loader-halo-outer" />
          <div className="loader-halo loader-halo-inner" />
          <div className="loader-ring loader-ring-one" />
          <div className="loader-ring loader-ring-two" />
          <span className="loader-orbit-point loader-orbit-point-one" />
          <span className="loader-orbit-point loader-orbit-point-two" />
          <div className="loader-mark-shell">
            <BrandLogo variant="mark" className="loading-logo-mark" priority />
          </div>
          <span className="loader-spark loader-spark-one" />
          <span className="loader-spark loader-spark-two" />
        </div>

        <BrandLogo className="loading-wordmark" priority />

        <div className="loading-copy">
          <span className="loading-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}<span>.</span></h1>
          <p>{copy.description}</p>
        </div>

        <div className="loader-wait-row">
          <span className="loader-wait-indicator"><i /></span>
          <span>{copy.status}</span>
          <span className="loader-wait-rule" />
          <span className="loader-wait-label">JUST A MOMENT</span>
        </div>
      </section>

      <div className="loading-footer">
        <span>THOUGHTFULLY SIMPLE.</span>
        <span>CARE IN EVERY DETAIL <i /></span>
      </div>
    </main>
  );
}
