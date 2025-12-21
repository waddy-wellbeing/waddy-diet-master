import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { Toaster } from "sonner";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { AnalyticsErrorBoundary } from "@/components/analytics/error-boundary";
import { FloatingWidget } from "@/components/floating-widget";
import { getSiteUrl } from "@/lib/utils/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Waddy Diet Master - Your Nutrition Coach",
  description: "Master your diet with personalized meal plans and nutrition tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} antialiased`}
      >
        <AnalyticsErrorBoundary>
          <AnalyticsProvider>
            {children}
            <Toaster richColors position="top-right" />
            <FloatingWidget />
          </AnalyticsProvider>
        </AnalyticsErrorBoundary>
      </body>
    </html>
  );
}
