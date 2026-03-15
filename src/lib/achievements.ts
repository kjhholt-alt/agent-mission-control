"use client";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: "missions" | "sessions" | "cost" | "tools" | "milestones";
  condition: (stats: AchievementStats) => boolean;
  unlocked_at?: string;
}

export interface AchievementStats {
  total_missions: number;
  completed_missions: number;
  failed_missions: number;
  total_sessions: number;
  total_cost: number;
  total_tools: number;
  total_tokens: number;
  projects_used: number;
}

const ACHIEVEMENTS: Achievement[] = [
  // Missions
  {
    id: "first-mission",
    title: "First Contact",
    description: "Spawn your first mission",
    icon: "rocket",
    category: "missions",
    condition: (s) => s.total_missions >= 1,
  },
  {
    id: "ten-missions",
    title: "Mission Commander",
    description: "Spawn 10 missions",
    icon: "star",
    category: "missions",
    condition: (s) => s.total_missions >= 10,
  },
  {
    id: "fifty-missions",
    title: "Fleet Admiral",
    description: "Spawn 50 missions",
    icon: "crown",
    category: "missions",
    condition: (s) => s.total_missions >= 50,
  },
  {
    id: "hundred-missions",
    title: "Swarm Lord",
    description: "Spawn 100 missions",
    icon: "trophy",
    category: "missions",
    condition: (s) => s.total_missions >= 100,
  },

  // Sessions
  {
    id: "first-session",
    title: "Online",
    description: "Record your first Claude Code session",
    icon: "monitor",
    category: "sessions",
    condition: (s) => s.total_sessions >= 1,
  },
  {
    id: "marathon",
    title: "Marathon Runner",
    description: "Complete 25 sessions",
    icon: "timer",
    category: "sessions",
    condition: (s) => s.total_sessions >= 25,
  },
  {
    id: "hundred-sessions",
    title: "Session Veteran",
    description: "Complete 100 sessions",
    icon: "shield",
    category: "sessions",
    condition: (s) => s.total_sessions >= 100,
  },

  // Tools
  {
    id: "hundred-tools",
    title: "Tool Time",
    description: "Use 100 tool calls across all sessions",
    icon: "wrench",
    category: "tools",
    condition: (s) => s.total_tools >= 100,
  },
  {
    id: "thousand-tools",
    title: "Power User",
    description: "Use 1,000 tool calls",
    icon: "zap",
    category: "tools",
    condition: (s) => s.total_tools >= 1000,
  },
  {
    id: "ten-k-tools",
    title: "Automation Engine",
    description: "Use 10,000 tool calls",
    icon: "factory",
    category: "tools",
    condition: (s) => s.total_tools >= 10000,
  },

  // Cost
  {
    id: "penny-pincher",
    title: "Penny Pincher",
    description: "Complete a session under $0.10",
    icon: "coins",
    category: "cost",
    condition: (s) => s.total_sessions >= 1 && s.total_cost < 0.1,
  },
  {
    id: "ten-dollar",
    title: "Investor",
    description: "Spend $10 total on API calls",
    icon: "dollar",
    category: "cost",
    condition: (s) => s.total_cost >= 10,
  },
  {
    id: "hundred-dollar",
    title: "High Roller",
    description: "Spend $100 total on API calls",
    icon: "gem",
    category: "cost",
    condition: (s) => s.total_cost >= 100,
  },

  // Milestones
  {
    id: "multi-project",
    title: "Multi-Tasker",
    description: "Work across 3+ different projects",
    icon: "layers",
    category: "milestones",
    condition: (s) => s.projects_used >= 3,
  },
  {
    id: "five-projects",
    title: "Portfolio Manager",
    description: "Work across 5+ different projects",
    icon: "briefcase",
    category: "milestones",
    condition: (s) => s.projects_used >= 5,
  },
  {
    id: "million-tokens",
    title: "Million Token Club",
    description: "Process 1 million tokens",
    icon: "sparkles",
    category: "milestones",
    condition: (s) => s.total_tokens >= 1_000_000,
  },
];

const STORAGE_KEY = "nexus-achievements";

function loadUnlocked(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveUnlocked(unlocked: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
}

/**
 * Check achievements against current stats.
 * Returns newly unlocked achievements (not previously unlocked).
 */
export function checkAchievements(
  stats: AchievementStats
): Achievement[] {
  const unlocked = loadUnlocked();
  const newlyUnlocked: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlocked[achievement.id]) continue; // Already unlocked

    if (achievement.condition(stats)) {
      const now = new Date().toISOString();
      unlocked[achievement.id] = now;
      newlyUnlocked.push({ ...achievement, unlocked_at: now });
    }
  }

  if (newlyUnlocked.length > 0) {
    saveUnlocked(unlocked);
  }

  return newlyUnlocked;
}

/**
 * Get all achievements with unlock status.
 */
export function getAllAchievements(): (Achievement & { unlocked: boolean })[] {
  const unlocked = loadUnlocked();
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: !!unlocked[a.id],
    unlocked_at: unlocked[a.id] || undefined,
  }));
}

/**
 * Get count of unlocked achievements.
 */
export function getUnlockedCount(): { unlocked: number; total: number } {
  const unlocked = loadUnlocked();
  return {
    unlocked: Object.keys(unlocked).length,
    total: ACHIEVEMENTS.length,
  };
}
