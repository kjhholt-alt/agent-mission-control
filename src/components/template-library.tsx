"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Rocket,
  Trash2,
  Edit3,
  Copy,
  X,
  Code,
  Search,
  Shield,
  Mail,
  Upload,
  Lightbulb,
  Wrench,
} from "lucide-react";
import type {
  MissionTemplate,
  WorkerType,
  TemplateCategory,
} from "@/lib/collector-types";

const STORAGE_KEY = "nexus-mission-templates";

const CATEGORY_CONFIG: Record<
  TemplateCategory,
  { label: string; icon: React.ReactNode; color: string }
> = {
  build: {
    label: "Build",
    icon: <Code className="w-3.5 h-3.5" />,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  review: {
    label: "Review",
    icon: <Shield className="w-3.5 h-3.5" />,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  prospect: {
    label: "Prospect",
    icon: <Search className="w-3.5 h-3.5" />,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  deploy: {
    label: "Deploy",
    icon: <Upload className="w-3.5 h-3.5" />,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },
  research: {
    label: "Research",
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  maintenance: {
    label: "Maintenance",
    icon: <Wrench className="w-3.5 h-3.5" />,
    color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
  },
};

const DEFAULT_TEMPLATES: MissionTemplate[] = [
  {
    id: "t-1",
    name: "Add Feature",
    goal: "Implement a new feature: [describe feature]. Write clean code, add tests, and ensure it builds successfully.",
    project: "nexus",
    worker_type: "builder",
    category: "build",
    priority: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-2",
    name: "Code Review",
    goal: "Review the latest changes for bugs, security issues, code quality problems, and adherence to project conventions. Report high-confidence issues only.",
    project: "nexus",
    worker_type: "inspector",
    category: "review",
    priority: 40,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-3",
    name: "Prospect Businesses",
    goal: "Find 50 businesses in [city/industry] with website, email, and phone. Focus on small businesses without modern websites. Score each prospect.",
    project: "buildkit-services",
    worker_type: "miner",
    category: "prospect",
    priority: 60,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-4",
    name: "Deploy to Production",
    goal: "Run all tests, fix any failures, then deploy to production. Verify the deployment is live and working. Report the deployment URL.",
    project: "nexus",
    worker_type: "deployer",
    category: "deploy",
    priority: 20,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-5",
    name: "Research & Plan",
    goal: "Research [topic/technology] and create a detailed implementation plan. Consider trade-offs, identify risks, and suggest the best approach.",
    project: "nexus",
    worker_type: "scout",
    category: "research",
    priority: 70,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-6",
    name: "Fix Failing Tests",
    goal: "Run the full test suite, identify all failures, fix them, and verify all tests pass. Do not skip or disable tests.",
    project: "nexus",
    worker_type: "builder",
    category: "maintenance",
    priority: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // ── Deere / Work Templates ──
  {
    id: "t-deere-1",
    name: "Analyze Financial Data",
    goal: "Read the provided financial data file (CSV/Excel). Calculate key metrics: totals by category, month-over-month changes, budget vs actual variances. Flag any line items exceeding 5% variance. Present results in a clear table format with a brief summary paragraph.",
    project: "nexus",
    worker_type: "scout",
    category: "research",
    priority: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-deere-2",
    name: "Draft Email Response",
    goal: "Draft a professional finance/business email. Context: [paste the email you're replying to or describe the situation]. Tone: professional but approachable. Include: clear action items, relevant data points, and next steps. Keep under 200 words unless complexity requires more.",
    project: "nexus",
    worker_type: "builder",
    category: "build",
    priority: 40,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-deere-3",
    name: "Meeting Prep",
    goal: "Prepare for a meeting about [topic]. Generate: 1) A structured agenda (30-60 min format), 2) Key talking points with supporting data, 3) Anticipated questions and prepared answers, 4) Action items template for follow-up. Attendees: [list attendees and their roles].",
    project: "nexus",
    worker_type: "scout",
    category: "research",
    priority: 35,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-deere-4",
    name: "Generate Report",
    goal: "Generate a formatted report from the provided data. Report type: [monthly close / variance analysis / budget forecast / executive summary]. Include: title page info, executive summary, detailed analysis with tables, key findings, and recommendations. Format for easy copy-paste into PowerPoint or Word.",
    project: "nexus",
    worker_type: "builder",
    category: "build",
    priority: 25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-deere-5",
    name: "Review Spreadsheet",
    goal: "Review the provided spreadsheet/data for: 1) Formula errors or circular references, 2) Data inconsistencies (mismatched totals, missing values, outliers), 3) Format issues, 4) Logic errors in calculations. Report each issue with cell reference, current value, and suggested fix. Prioritize by severity.",
    project: "nexus",
    worker_type: "inspector",
    category: "review",
    priority: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // ── Personal Project Templates ──
  {
    id: "t-mp-health",
    name: "MoneyPrinter Health Check",
    goal: "Check MoneyPrinter bot health: verify Railway deployment is running, check recent trades in the last 24h, review P&L, check wallet balance, verify whale_watch_v1 strategy is active. Report any issues. If the bot is stale (>30 min no heartbeat), flag immediately.",
    project: "MoneyPrinter",
    worker_type: "inspector",
    category: "maintenance",
    priority: 20,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-mp-pnl",
    name: "MoneyPrinter P&L Report",
    goal: "Generate a P&L report for MoneyPrinter: pull trade history from Supabase, calculate total profit/loss, win rate, average position size, best/worst trades. Compare this week vs last week. Output as a formatted summary ready for Discord.",
    project: "MoneyPrinter",
    worker_type: "scout",
    category: "research",
    priority: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-pcb-seo",
    name: "PC Bottleneck: Publish SEO Post",
    goal: "Run the AUTOPILOT SEO pipeline for PC Bottleneck Analyzer: generate a new SEO blog post targeting high-value PC hardware keywords, optimize for search, add Amazon affiliate links (tag: bottleneck20-20), commit and push to trigger Vercel deploy.",
    project: "pc-bottleneck-analyzer",
    worker_type: "builder",
    category: "build",
    priority: 40,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-afb-seo",
    name: "Finance Brief: Publish SEO Post",
    goal: "Run the AUTOPILOT Finance pipeline for AI Finance Brief: generate a new finance SEO blog post targeting investment/market keywords, optimize for search, commit and push to trigger Vercel deploy.",
    project: "ai-finance-brief",
    worker_type: "builder",
    category: "build",
    priority: 40,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-bk-prospect",
    name: "BuildKit: Find New Prospects",
    goal: "Run the BuildKit Services prospector tool to find 25 new local business prospects. Target: small businesses in Florida without modern websites. Enrich with email/phone. Score by confidence. Append to the prospect database. Report summary of new finds.",
    project: "buildkit-services",
    worker_type: "miner",
    category: "prospect",
    priority: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-bh-tests",
    name: "BarrelHouse CRM: Run Tests",
    goal: "Run the full BarrelHouse CRM test suite. Report pass/fail counts, any failures with details, and whether the deployment at barrelhouse-crm.vercel.app is healthy. If tests fail, investigate and fix if the fix is obvious.",
    project: "BarrelHouseCRM",
    worker_type: "inspector",
    category: "review",
    priority: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-nexus-health",
    name: "Nexus: Full System Health Check",
    goal: "Run scripts/ops/health-check.py to verify all Nexus infrastructure: Supabase connectivity, Vercel deployment, Discord webhook, task queue depth, active workers, n8n status. Report any failures and suggest fixes.",
    project: "nexus",
    worker_type: "inspector",
    category: "maintenance",
    priority: 15,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-all-deps",
    name: "Update Dependencies",
    goal: "Check for outdated npm dependencies in the specified project. Run npm outdated, identify any with known security vulnerabilities (npm audit). Update patch/minor versions. Do NOT update major versions without listing breaking changes first. Run tests after updating.",
    project: "nexus",
    worker_type: "builder",
    category: "maintenance",
    priority: 60,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function loadTemplates(): MissionTemplate[] {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_TEMPLATES;
}

function saveTemplates(templates: MissionTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

interface TemplateLibraryProps {
  onLaunch?: (template: MissionTemplate) => void;
}

export function TemplateLibrary({ onLaunch }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Form state
  const [formName, setFormName] = useState("");
  const [formGoal, setFormGoal] = useState("");
  const [formProject, setFormProject] = useState("nexus");
  const [formWorkerType, setFormWorkerType] = useState<WorkerType>("any");
  const [formCategory, setFormCategory] = useState<TemplateCategory>("build");
  const [formPriority, setFormPriority] = useState(50);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const filtered =
    categoryFilter === "all"
      ? templates
      : templates.filter((t) => t.category === categoryFilter);

  const handleSave = () => {
    if (!formName.trim() || !formGoal.trim()) return;

    const now = new Date().toISOString();

    if (editingId) {
      const updated = templates.map((t) =>
        t.id === editingId
          ? {
              ...t,
              name: formName,
              goal: formGoal,
              project: formProject,
              worker_type: formWorkerType,
              category: formCategory,
              priority: formPriority,
              updated_at: now,
            }
          : t
      );
      setTemplates(updated);
      saveTemplates(updated);
    } else {
      const newTemplate: MissionTemplate = {
        id: `t-${Date.now()}`,
        name: formName,
        goal: formGoal,
        project: formProject,
        worker_type: formWorkerType,
        category: formCategory,
        priority: formPriority,
        created_at: now,
        updated_at: now,
      };
      const updated = [...templates, newTemplate];
      setTemplates(updated);
      saveTemplates(updated);
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
  };

  const handleEdit = (t: MissionTemplate) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormGoal(t.goal);
    setFormProject(t.project);
    setFormWorkerType(t.worker_type);
    setFormCategory(t.category);
    setFormPriority(t.priority);
    setCreating(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setCreating(false);
    setFormName("");
    setFormGoal("");
    setFormProject("nexus");
    setFormWorkerType("any");
    setFormCategory("build");
    setFormPriority(50);
  };

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setCategoryFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            categoryFilter === "all"
              ? "bg-white/10 text-white border-white/20"
              : "text-zinc-500 border-zinc-800 hover:border-zinc-700"
          }`}
        >
          All ({templates.length})
        </button>
        {(Object.keys(CATEGORY_CONFIG) as TemplateCategory[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const count = templates.filter((t) => t.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                categoryFilter === cat
                  ? cfg.color
                  : "text-zinc-500 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              {cfg.icon}
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((template) => {
            const catCfg = CATEGORY_CONFIG[template.category];
            return (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 hover:border-cyan-500/20 transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${catCfg.color}`}
                    >
                      {catCfg.icon}
                      {catCfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-white"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(template.goal)
                      }
                      className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-white"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-white mb-1">
                  {template.name}
                </h3>
                <p className="text-xs text-zinc-500 line-clamp-3 mb-3">
                  {template.goal}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                    <span>{template.project}</span>
                    <span className="text-zinc-800">|</span>
                    <span>P{template.priority}</span>
                  </div>
                  <button
                    onClick={() => onLaunch?.(template)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/20 transition-colors"
                  >
                    <Rocket className="w-3 h-3" />
                    Launch
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Add new card */}
        <motion.button
          layout
          onClick={() => setCreating(true)}
          className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-cyan-500/30 hover:bg-cyan-500/[0.02] transition-colors min-h-[160px]"
        >
          <Plus className="w-6 h-6 text-zinc-700" />
          <span className="text-xs text-zinc-600">New Template</span>
        </motion.button>
      </div>

      {/* Create/Edit modal */}
      <AnimatePresence>
        {creating && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
              onClick={resetForm}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[201]"
            >
              <div className="bg-[#0f0f18] border border-cyan-500/20 rounded-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <h2 className="text-sm font-semibold text-white">
                    {editingId ? "Edit Template" : "New Template"}
                  </h2>
                  <button
                    onClick={resetForm}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., Add API Endpoint"
                      className="w-full bg-[#0a0a12] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-cyan-500/40"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                      Goal Prompt
                    </label>
                    <textarea
                      value={formGoal}
                      onChange={(e) => setFormGoal(e.target.value)}
                      placeholder="What should the agent do?"
                      rows={3}
                      className="w-full bg-[#0a0a12] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 outline-none focus:border-cyan-500/40 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                        Category
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) =>
                          setFormCategory(e.target.value as TemplateCategory)
                        }
                        className="w-full bg-[#0a0a12] border border-zinc-800 rounded-lg px-2.5 py-2.5 text-xs text-white outline-none appearance-none"
                      >
                        {(
                          Object.keys(CATEGORY_CONFIG) as TemplateCategory[]
                        ).map((cat) => (
                          <option key={cat} value={cat}>
                            {CATEGORY_CONFIG[cat].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                        Worker
                      </label>
                      <select
                        value={formWorkerType}
                        onChange={(e) =>
                          setFormWorkerType(e.target.value as WorkerType)
                        }
                        className="w-full bg-[#0a0a12] border border-zinc-800 rounded-lg px-2.5 py-2.5 text-xs text-white outline-none appearance-none"
                      >
                        <option value="any">Auto</option>
                        <option value="builder">Builder</option>
                        <option value="inspector">Inspector</option>
                        <option value="miner">Miner</option>
                        <option value="scout">Scout</option>
                        <option value="deployer">Deployer</option>
                        <option value="messenger">Messenger</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                        Priority
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={formPriority}
                        onChange={(e) =>
                          setFormPriority(parseInt(e.target.value) || 50)
                        }
                        className="w-full bg-[#0a0a12] border border-zinc-800 rounded-lg px-2.5 py-2.5 text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-2">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 rounded-lg text-sm text-zinc-500 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!formName.trim() || !formGoal.trim()}
                    className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors disabled:opacity-40"
                  >
                    {editingId ? "Save Changes" : "Create Template"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
