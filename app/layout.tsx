import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laundrify",
  description: "Laundrify — simple, reliable laundry shop management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
