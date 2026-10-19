import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const onest = localFont({
  src: "../assets/fonts/onest.ttf",
  weight: "100 900",
  variable: "--font-onest",
  display: "swap",
});

const golos = localFont({
  src: "../assets/fonts/golos-text.ttf",
  weight: "100 900",
  variable: "--font-golos",
  display: "swap",
});

const jetbrains = localFont({
  src: "../assets/fonts/jetbrains-mono.ttf",
  weight: "100 800",
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AI Recorder — записи встреч",
    template: "%s — AI Recorder",
  },
  description: "Единая база записей AI Recorder: расшифровка, отчёт и ссылки с паролем.",
  applicationName: "AI Recorder",
  robots: { index: false, follow: false, nocache: true },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#f5f5f5",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${onest.variable} ${golos.variable} ${jetbrains.variable}`}>
      <body className="bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
