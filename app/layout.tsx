import type { Metadata } from "next";
import Script from "next/script";
import { Cairo, Plus_Jakarta_Sans } from "next/font/google";
import { ClientProviders } from "@/components/ClientProviders";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL)
    : undefined,
  title: "Bedi Delivery",
  description: "I want a delivery — menu & delivery for your business.",
  icons: {
    icon: "/logo.webp",
    apple: "/logo.webp",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bedi Delivery",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Bedi Delivery",
    "viewport": "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cairo.variable} ${plusJakartaSans.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script
          id="customer-pwa-sw"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=typeof location!=='undefined'&&location.pathname||'';var ok=p==='/'||p==='/search'||p==='/my-orders'||p.indexOf('/order')===0||p.indexOf('/resolve')===0||p.indexOf('/join')===0||/^\\/t\\/[^/]+$/.test(p);if(ok&&'serviceWorker' in navigator){navigator.serviceWorker.register('/customer-sw.js',{scope:'/'}).catch(function(){});}})();`,
          }}
        />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}