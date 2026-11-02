import type { Metadata } from "next";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "BoxTag",
  description:
    "Pack a box, print one barcode for it and its contents, store it, and ship it later. A proof of concept built on the ScanPower v3 API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 print:max-w-none print:p-0">
          {children}
        </main>
      </body>
    </html>
  );
}
