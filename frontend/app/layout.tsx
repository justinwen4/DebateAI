import type { Metadata } from "next";
import { Libre_Franklin, Geist_Mono, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { AuthHashHandler } from "@/app/components/AuthHashHandler";
import { AuthProvider } from "@/app/context/AuthContext";

const sansBody = Libre_Franklin({
  variable: "--font-sans-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://debateai.dev";

export const metadata: Metadata = {
  title: "DebateAI",
  description: "Debate Analytics Assistant — elite competitive debate analytics on demand",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "DebateAI",
    description: "Debate Analytics Assistant — elite competitive debate analytics on demand",
    url: siteUrl,
    siteName: "DebateAI",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DebateAI — Debate Assistant",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DebateAI",
    description: "Debate Analytics Assistant — elite competitive debate analytics on demand",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [{ url: "/debate-ai-icon.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sansBody.variable} ${geistMono.variable} ${playfairDisplay.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full">
        <AuthProvider>
          <AuthHashHandler />
          {children}
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
