import type { Metadata, Viewport } from "next";
import { Antonio, Geologica, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/* Operator Console typography:
   - Antonio (display): condensed, instrument-panel labels
   - Geologica (body): clean, distinctive — not Inter or Geist
   - JetBrains Mono (mono): numerics, codes, terminal-grade data */
const display = Antonio({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const body = Geologica({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Store Ops — Afterroar",
  description: "Operator-grade POS + retail OS for friendly local game stores.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo-ring-favicon.png",
    apple: "/logo-ring.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Store Ops",
  },
};

export const viewport: Viewport = {
  themeColor: "#06080c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased dark`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('afterroar-theme')||'dark';var r=t==='system'?window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark':t;document.documentElement.classList.toggle('dark',r==='dark');document.documentElement.classList.toggle('light',r==='light');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
