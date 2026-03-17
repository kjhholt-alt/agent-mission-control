'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  const shortcuts: Shortcut[] = [
    // Navigation
    { keys: ['Ctrl', '1'], description: 'Go to Dashboard', category: 'Navigation' },
    { keys: ['Ctrl', '2'], description: 'Go to Ops Center (Tasks)', category: 'Navigation' },
    { keys: ['Ctrl', '3'], description: 'Go to Ops Center (Workers)', category: 'Navigation' },
    { keys: ['Ctrl', '4'], description: 'Go to Factory', category: 'Navigation' },
    { keys: ['Ctrl', 'T'], description: 'Go to Today', category: 'Navigation' },
    { keys: ['Ctrl', 'Shift', 'C'], description: 'Go to Command', category: 'Navigation' },
    { keys: ['Ctrl', 'O'], description: 'Go to Oracle', category: 'Navigation' },
    { keys: ['Ctrl', 'Shift', 'S'], description: 'Go to Sessions', category: 'Navigation' },
    // Actions
    { keys: ['Ctrl', 'K'], description: 'Open Command Palette', category: 'Actions' },
    { keys: ['Shift', '?'], description: 'Show Keyboard Shortcuts', category: 'Help' },
  ];

  const categories = Array.from(new Set(shortcuts.map((s) => s.category)));

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-2xl mx-4 bg-[#0a0a12] border border-cyan-500/30 rounded-lg shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Keyboard className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          {/* Shortcuts List */}
          <div className="max-h-[70vh] overflow-y-auto p-6">
            {categories.map((category) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-xs uppercase tracking-wider text-cyan-400 font-bold mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts
                    .filter((s) => s.category === category)
                    .map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/5 transition-colors"
                      >
                        <span className="text-sm text-zinc-300">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <kbd className="px-2 py-1 bg-white/10 rounded text-xs font-mono border border-white/20 text-white min-w-[2rem] text-center">
                                {key}
                              </kbd>
                              {i < shortcut.keys.length - 1 && (
                                <span className="text-zinc-500 text-xs">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/10 text-xs text-zinc-500 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] border border-white/10">Esc</kbd> or{' '}
            <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] border border-white/10">Shift</kbd>{' '}
            <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] border border-white/10">?</kbd> to close
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
