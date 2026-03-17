"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", color: "text-zinc-400" },
  { href: "/today", label: "Today", color: "text-amber-400" },
  { href: "/command", label: "Command", color: "text-red-400" },
  { href: "/ops", label: "Ops Center", color: "text-emerald-400" },
  { href: "/game", label: "Factory", color: "text-cyan-400" },
  { href: "/oracle", label: "Oracle", color: "text-amber-400" },
  { href: "/sessions", label: "Sessions", color: "text-purple-400" },
  { href: "/templates", label: "Templates", color: "text-orange-400" },
  { href: "/workflows", label: "Flows", color: "text-purple-400/60" },
  { href: "/fusion", label: "Fusion", color: "text-cyan-400/60" },
  { href: "/achievements", label: "Trophies", color: "text-amber-400/60" },
  { href: "/setup", label: "Setup", color: "text-emerald-400/60" },
  { href: "/settings", label: "Settings", color: "text-zinc-500" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-cyan-500/30 transition-colors md:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-zinc-400" />
        </button>
      </SheetTrigger>
      <SheetContent className="w-[280px] sm:w-[320px]">
        <SheetHeader>
          <SheetTitle className="text-cyan-400 text-2xl font-bold tracking-wider">
            NEXUS
          </SheetTitle>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
            Agent Operations
          </p>
        </SheetHeader>
        <nav className="mt-8 flex flex-col gap-2">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`px-4 py-3 text-sm font-medium rounded-lg ${link.color} hover:bg-white/5 transition-colors uppercase tracking-wider border border-transparent hover:border-white/10`}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
