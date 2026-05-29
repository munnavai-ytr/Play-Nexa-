import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/layout/BottomNav";
import OfflineIndicator from "@/components/OfflineIndicator";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GROVIX",
  },
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
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const s = JSON.parse(
                  localStorage.getItem('grovix_settings') || '{}'
                );
                const theme = s.theme || 'dark';
                const themes = {
                  dark:   { bg: '#070B14', accent: '#7C5CFF' },
                  amoled: { bg: '#000000', accent: '#7C5CFF' },
                  neon:   { bg: '#070B14', accent: '#00FF88' }
                };
                const t = themes[theme] || themes.dark;
                document.documentElement.style
                  .setProperty('--accent', t.accent);
                document.body.style.backgroundColor = t.bg;
              } catch(e) {}
            `
          }}
        />
      </head>
      <body
        className={`${inter.variable} antialiased bg-grovix-bg text-white min-h-screen`}
      >
        <OfflineIndicator />
        <ServiceWorkerRegistrar />
        <main className="min-h-screen">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
