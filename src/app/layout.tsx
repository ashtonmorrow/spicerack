import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flavor Pear",
  description: "Predictive flavor pairing — type an ingredient, get suggestions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink">{children}</body>
    </html>
  );
}
