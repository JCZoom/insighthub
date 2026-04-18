import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "InsightHub — AI-Powered Dashboard Builder",
  description: "Build, customize, and share rich data dashboards using natural language. Describe what you need and watch AI build it in seconds.",
  metadataBase: new URL("https://dashboards.jeffcoy.net"),
  openGraph: {
    title: "InsightHub — AI-Powered Dashboard Builder",
    description: "Describe your data in plain English. Watch AI build the dashboard in seconds.",
    url: "https://dashboards.jeffcoy.net",
    siteName: "InsightHub",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "InsightHub — AI-Powered Dashboard Builder",
    description: "Describe your data in plain English. Watch AI build the dashboard in seconds.",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
