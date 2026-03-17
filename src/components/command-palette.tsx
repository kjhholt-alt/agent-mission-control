'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Command,
  ListTodo,
  Users,
  Factory,
  Eye,
  History,
  FileText,
  Workflow,
  Zap,
  Trophy,
  Settings,
  Calendar,
  X,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Go to main dashboard',
      icon: <Home className="w-4 h-4" />,
      action: () => router.push('/'),
      keywords: ['home', 'main', 'overview'],
    },
    {
      id: 'today',
      label: 'Today',
      description: 'Personal dashboard',
      icon: <Calendar className="w-4 h-4" />,
      action: () => router.push('/today'),
      keywords: ['daily', 'personal'],
    },
    {
      id: 'command',
      label: 'Command',
      description: 'Work logs and kanban',
      icon: <Command className="w-4 h-4" />,
      action: () => router.push('/command'),
      keywords: ['logs', 'work'],
    },
    {
      id: 'ops',
      label: 'Ops Center',
      description: 'Tasks, workers, and pipelines',
      icon: <ListTodo className="w-4 h-4" />,
      action: () => router.push('/ops'),
      keywords: ['tasks', 'workers', 'operations'],
    },
    {
      id: 'factory',
      label: 'Factory',
      description: '3D factory visualization',
      icon: <Factory className="w-4 h-4" />,
      action: () => router.push('/game'),
      keywords: ['3d', 'game', 'visualization'],
    },
    {
      id: 'oracle',
      label: 'Oracle',
      description: 'AI decision engine',
      icon: <Eye className="w-4 h-4" />,
      action: () => router.push('/oracle'),
      keywords: ['ai', 'decisions'],
    },
    {
      id: 'sessions',
      label: 'Sessions',
      description: 'Session history',
      icon: <History className="w-4 h-4" />,
      action: () => router.push('/sessions'),
      keywords: ['history', 'logs'],
    },
    {
      id: 'templates',
      label: 'Templates',
      description: 'Mission template library',
      icon: <FileText className="w-4 h-4" />,
      action: () => router.push('/templates'),
      keywords: ['missions', 'library'],
    },
    {
      id: 'workflows',
      label: 'Workflows',
      description: 'Multi-step pipelines',
      icon: <Workflow className="w-4 h-4" />,
      action: () => router.push('/workflows'),
      keywords: ['pipelines', 'flows'],
    },
    {
      id: 'fusion',
      label: 'Fusion',
      description: 'Cross-project intelligence',
      icon: <Zap className="w-4 h-4" />,
      action: () => router.push('/fusion'),
      keywords: ['intelligence', 'git', 'cross-project'],
    },
    {
      id: 'achievements',
      label: 'Achievements',
      description: 'Trophy gallery',
      icon: <Trophy className="w-4 h-4" />,
      action: () => router.push('/achievements'),
      keywords: ['trophies', 'awards'],
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'API connections',
      icon: <Settings className="w-4 h-4" />,
      action: () => router.push('/settings'),
      keywords: ['config', 'api'],
    },
  ];

  const filteredCommands = commands.filter((cmd) => {
    const searchLower = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.keywords?.some((kw) => kw.includes(searchLower))
    );
  });

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh] bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-2xl mx-4 bg-[#0a0a12] border border-cyan-500/30 rounded-lg shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
            <Command className="w-5 h-5 text-cyan-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search commands or navigate pages..."
              className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-sm"
            />
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-zinc-500 text-sm">
                No commands found
              </div>
            ) : (
              <div className="py-2">
                {filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      index === selectedIndex
                        ? 'bg-cyan-500/20 border-l-2 border-cyan-400'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div
                      className={`${
                        index === selectedIndex ? 'text-cyan-400' : 'text-zinc-400'
                      }`}
                    >
                      {cmd.icon}
                    </div>
                    <div className="flex-1">
                      <div
                        className={`text-sm font-medium ${
                          index === selectedIndex ? 'text-white' : 'text-zinc-200'
                        }`}
                      >
                        {cmd.label}
                      </div>
                      {cmd.description && (
                        <div className="text-xs text-zinc-500">{cmd.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-white/10 flex items-center gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] border border-white/10">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] border border-white/10">
                ↓
              </kbd>
              <span>navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] border border-white/10">
                Enter
              </kbd>
              <span>select</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] border border-white/10">
                Esc
              </kbd>
              <span>close</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
