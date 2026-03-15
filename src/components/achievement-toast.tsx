"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Rocket,
  Star,
  Crown,
  Monitor,
  Timer,
  Shield,
  Wrench,
  Zap,
  Factory,
  Coins,
  DollarSign,
  Gem,
  Layers,
  Briefcase,
  Sparkles,
} from "lucide-react";
import type { Achievement } from "@/lib/achievements";
import { playSound, playAchievementSound } from "@/lib/audio";

const ICON_MAP: Record<string, React.ReactNode> = {
  rocket: <Rocket className="w-5 h-5" />,
  star: <Star className="w-5 h-5" />,
  crown: <Crown className="w-5 h-5" />,
  trophy: <Trophy className="w-5 h-5" />,
  monitor: <Monitor className="w-5 h-5" />,
  timer: <Timer className="w-5 h-5" />,
  shield: <Shield className="w-5 h-5" />,
  wrench: <Wrench className="w-5 h-5" />,
  zap: <Zap className="w-5 h-5" />,
  factory: <Factory className="w-5 h-5" />,
  coins: <Coins className="w-5 h-5" />,
  dollar: <DollarSign className="w-5 h-5" />,
  gem: <Gem className="w-5 h-5" />,
  layers: <Layers className="w-5 h-5" />,
  briefcase: <Briefcase className="w-5 h-5" />,
  sparkles: <Sparkles className="w-5 h-5" />,
};

interface AchievementToastProps {
  achievements: Achievement[];
  onDismiss: () => void;
}

export function AchievementToast({
  achievements,
  onDismiss,
}: AchievementToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (achievements.length > 0) {
      playSound(playAchievementSound);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [achievements, onDismiss]);

  if (achievements.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[300] space-y-2">
      <AnimatePresence>
        {visible &&
          achievements.map((achievement) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              className="bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30 rounded-xl px-5 py-4 shadow-xl shadow-amber-500/10 backdrop-blur-sm max-w-sm"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  {ICON_MAP[achievement.icon] || (
                    <Trophy className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-400/70">
                    Achievement Unlocked
                  </p>
                  <p className="text-sm font-bold text-white">
                    {achievement.title}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {achievement.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
