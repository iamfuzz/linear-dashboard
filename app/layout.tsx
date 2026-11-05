import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Partner SE Dashboard",
  description: "Linear dashboard for the AMER Partner SE Programs initiative",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
