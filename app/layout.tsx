import type { Metadata } from "next";
import Script from "next/script";
import { Cairo } from "next/font/google";
import { ClientProviders } from "@/components/ClientProviders";
import "./globals.css";

/** Single UI font — avoids Next.js preloading a second family (Plus Jakarta was never referenced in CSS → browser preload warning). */
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
  weight: ["400", "700"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL)
    : undefined,
  title: {
    default: "Bedi Delivery — Order from Restaurants & Stores Near You",
    template: "%s | Bedi Delivery",
  },
  description:
    "Order food delivery, dine-in menus, and more from local restaurants and supermarkets. Available in Palestine and Israel — choose your city (Ramallah, Nablus, Bethlehem, Jerusalem, Gaza, Hebron & more), browse menus, track orders. Sign up as a Driver or Tenant. مطاعم، سوبرماركت، توصيل.",
  keywords: [
    "delivery",
    "restaurant",
    "food delivery",
    "order food",
    "Bedi",
    "Driver",
    "Business",
    "tenant",
    "supermarket",
    "grocery",
    "توصيل طعام",
    "توصيل",
    "مطاعم",
    "سوبرماركت",
    "بقالة",
    "طلب أونلاين",
    "مقهى",
    "مخبز",
    "فلسطين",
    "إسرائيل",
    "رام الله",
    "القدس",
    "نابلس",
    "بيت لحم",
    "غزة",
    "الخليل",
    "جنين",
  ],
  alternates: {
    canonical: "/",
    languages: { "x-default": "/", en: "/", ar: "/" },
  },
  openGraph: {
    title: "Bedi Delivery — Order from Restaurants & Stores Near You",
    description:
      "Order food delivery, dine-in menus, and more from local restaurants and supermarkets. Palestine & Israel — Ramallah, Nablus, Bethlehem, Jerusalem, Gaza & more. مطاعم، سوبرماركت، توصيل.",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_EG"],
  },
  icons: {
    icon: "/customersLogo.webp",
    apple: "/customersLogo.webp",
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

function WebSiteStructuredData() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.bedi.delivery";
  const logoUrl = `${baseUrl}/customersLogo.webp`;
  const navLinks = [
    { name: "Driver", url: `${baseUrl}/driver`, position: 1 },
    { name: "Tenant", url: `${baseUrl}/join`, position: 2 },
    { name: "Restaurants", url: `${baseUrl}/search?category=restaurant`, position: 3 },
    { name: "Supermarkets", url: `${baseUrl}/search?category=supermarket`, position: 4 },
  ];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        name: "Bedi Delivery",
        url: baseUrl,
        logo: { "@type": "ImageObject", url: logoUrl },
        areaServed: [
          { "@type": "Country", name: "Palestine" },
          { "@type": "Country", name: "Israel" },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        url: baseUrl,
        name: "Bedi Delivery",
        description: "Order food delivery, dine-in menus, and more from local restaurants and stores. Choose your city to see options near you.",
        publisher: { "@id": `${baseUrl}/#organization` },
        inLanguage: ["en", "ar"],
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${baseUrl}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      ...navLinks.map((link) => ({
        "@type": "SiteNavigationElement",
        position: link.position,
        name: link.name,
        url: link.url,
      })),
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cairo.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <WebSiteStructuredData />
        <Script
          id="customer-pwa-sw"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=typeof location!=='undefined'&&location.pathname||'';if(!('serviceWorker' in navigator))return;if(p==='/driver'||p.indexOf('/driver/')===0){navigator.serviceWorker.register('/driver-sw.js',{scope:'/driver/'}).catch(function(){});return;}if(p==='/dashboard'||p.indexOf('/dashboard/')===0||p==='/admin'||p.indexOf('/admin/')===0){navigator.serviceWorker.register('/dashboard-sw.js',{scope:'/dashboard/'}).catch(function(){});return;}var m=p.match(/^\\/t\\/([^/]+)\\/?/);if(m){var slug=m[1];if(p.indexOf('/t/'+slug+'/orders')===0){navigator.serviceWorker.register('/t/'+slug+'/orders/sw.js',{scope:'/t/'+slug+'/orders/'}).catch(function(){});return;}navigator.serviceWorker.register('/customer-sw.js',{scope:'/'}).catch(function(){});return;}var ok=p==='/'||p==='/search'||p==='/my-orders'||p.indexOf('/order')===0||p.indexOf('/resolve')===0||p.indexOf('/join')===0;if(ok){navigator.serviceWorker.register('/customer-sw.js',{scope:'/'}).catch(function(){});}})();`,
          }}
        />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}