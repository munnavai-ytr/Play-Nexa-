import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/layout/BottomNav";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GROVIX — Your Ultimate Media Universe",
  description: "Download, watch, play and manage entertainment — all in one place. Premium futuristic media ecosystem.",
  keywords: ["GROVIX", "Media", "Download", "Movies", "Games", "Music", "Streaming"],
  authors: [{ name: "GROVIX" }],
  openGraph: {
    title: "GROVIX — Your Ultimate Media Universe",
    description: "Download, watch, play and manage entertainment — all in one place.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#070B14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} antialiased bg-grovix-bg text-white min-h-screen`}
      >
        <main className="min-h-screen">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
