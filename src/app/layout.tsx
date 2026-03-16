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

function GlobalNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 h-10 bg-[#0a0a12]/95 backdrop-blur-sm border-b border-white/5">
      <a href="/" className="text-sm font-bold tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors">
        NEXUS
      </a>
      <div className="flex items-center gap-1">
        <a href="/" className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors">
          Dashboard
        </a>
        <a href="/today" className="px-3 py-1 text-[10px] uppercase tracking-wider text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors">
          Today
        </a>
        <a href="/command" className="px-3 py-1 text-[10px] uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors font-bold">
          Command
        </a>
        <a href="/ops" className="px-3 py-1 text-[10px] uppercase tracking-wider text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors">
          Ops Center
        </a>
        <a href="/game" className="px-3 py-1 text-[10px] uppercase tracking-wider text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded transition-colors">
          Factory
        </a>
        <a href="/oracle" className="px-3 py-1 text-[10px] uppercase tracking-wider text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors">
          Oracle
        </a>
        <a href="/sessions" className="px-3 py-1 text-[10px] uppercase tracking-wider text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded transition-colors">
          Sessions
        </a>
        <a href="/templates" className="px-3 py-1 text-[10px] uppercase tracking-wider text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded transition-colors">
          Templates
        </a>
        <a href="/workflows" className="px-3 py-1 text-[10px] uppercase tracking-wider text-purple-400/60 hover:text-purple-300 hover:bg-purple-500/10 rounded transition-colors">
          Flows
        </a>
        <a href="/fusion" className="px-3 py-1 text-[10px] uppercase tracking-wider text-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/10 rounded transition-colors">
          Fusion
        </a>
        <a href="/achievements" className="px-3 py-1 text-[10px] uppercase tracking-wider text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors">
          Trophies
        </a>
        <a href="/setup" className="px-3 py-1 text-[10px] uppercase tracking-wider text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors">
          Setup
        </a>
        <a href="/settings" className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-500 hover:text-white hover:bg-white/5 rounded transition-colors">
          Settings
        </a>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${jetbrainsMono.variable} antialiased`}>
        <TooltipProvider>
          <GlobalNav />
          <div className="pt-10">{children}</div>
        </TooltipProvider>
      </body>
    </html>
  );
}
