import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BXL Expense Tracker",
  description: "Track bank email alerts and manage monthly spending.",
  icons: {
    icon: "/brand-logo.png",
    apple: "/brand-logo.png",
  },
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
