import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "NEXUS | Agent Dashboard",
  description: "Real-time dashboard for watching AI agents work",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${jetbrainsMono.variable} antialiased`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
