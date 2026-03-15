"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { TemplateLibrary } from "@/components/template-library";
import { SpawnModal } from "@/components/spawn-modal";
import type { MissionTemplate } from "@/lib/collector-types";

export default function TemplatesPage() {
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<MissionTemplate | null>(null);

  const handleLaunch = (template: MissionTemplate) => {
    setSelectedTemplate(template);
    setSpawnOpen(true);
  };

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
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <FileText className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Mission Templates
            </h1>
            <p className="text-xs text-zinc-600 uppercase tracking-widest">
              Reusable goals for one-click agent deployment
            </p>
          </div>
        </motion.header>

        {/* Template library */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <TemplateLibrary onLaunch={handleLaunch} />
        </motion.div>
      </div>

      {/* Spawn modal for launching templates */}
      <SpawnModal
        open={spawnOpen}
        onClose={() => {
          setSpawnOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
      />
    </div>
  );
}
