import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laundrify",
  description: "Laundrify — simple, reliable laundry shop management.",
  icons: { icon: "/laundrify-mark.webp", shortcut: "/laundrify-mark.webp", apple: "/laundrify-mark.webp" },
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
