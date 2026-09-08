import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FLAC Downloader — Lossless Music for iOS & Android",
  description:
    "Search any artist and download their tracks as true lossless FLAC audio, right from your phone. Installable PWA — works on iOS and Android.",
  keywords: [
    "FLAC",
    "lossless audio",
    "music downloader",
    "iOS",
    "Android",
    "PWA",
    "mobile app",
  ],
  authors: [{ name: "FLAC Downloader" }],
  applicationName: "FLAC Downloader",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FLAC Downloader",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
  openGraph: {
    title: "FLAC Downloader — Lossless Music for iOS & Android",
    description:
      "Search any artist and download their tracks as true lossless FLAC audio, right from your phone.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FLAC Downloader",
    description: "Lossless music downloader for iOS and Android",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f97316" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1410" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
