"use client";

import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { SessionList } from "@/components/session-list";

export default function SessionsPage() {
  return (
    <div
      className="min-h-screen relative"
      style={{ backgroundColor: "#0a0a0f" }}
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Clock className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Session History</h1>
            <p className="text-xs text-zinc-600 uppercase tracking-widest">
              Every Claude Code session tracked with costs & tokens
            </p>
          </div>
        </motion.header>

        {/* Session list */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <SessionList />
        </motion.div>
      </div>
    </div>
  );
}
