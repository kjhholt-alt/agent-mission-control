'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  action: () => void;
  category?: string;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Find matching shortcut
      const shortcut = shortcuts.find((s) => {
        const keyMatch = s.key.toLowerCase() === event.key.toLowerCase();
        const ctrlMatch = s.ctrlKey === undefined || s.ctrlKey === event.ctrlKey;
        const shiftMatch = s.shiftKey === undefined || s.shiftKey === event.shiftKey;
        const altMatch = s.altKey === undefined || s.altKey === event.altKey;

        return keyMatch && ctrlMatch && shiftMatch && altMatch;
      });

      if (shortcut) {
        // Prevent default browser behavior for ctrl+number shortcuts
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
        }
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

export function useGlobalShortcuts(
  onCommandPalette: () => void,
  onHelp: () => void
) {
  const router = useRouter();

  const shortcuts: KeyboardShortcut[] = [
    // Navigation shortcuts
    {
      key: '1',
      ctrlKey: true,
      description: 'Go to Dashboard',
      action: () => router.push('/'),
      category: 'Navigation',
    },
    {
      key: '2',
      ctrlKey: true,
      description: 'Go to Tasks (Ops)',
      action: () => router.push('/ops'),
      category: 'Navigation',
    },
    {
      key: '3',
      ctrlKey: true,
      description: 'Go to Workers (Ops)',
      action: () => router.push('/ops'),
      category: 'Navigation',
    },
    {
      key: '4',
      ctrlKey: true,
      description: 'Go to Factory',
      action: () => router.push('/game'),
      category: 'Navigation',
    },
    {
      key: 't',
      ctrlKey: true,
      description: 'Go to Today',
      action: () => router.push('/today'),
      category: 'Navigation',
    },
    {
      key: 'c',
      ctrlKey: true,
      shiftKey: true,
      description: 'Go to Command',
      action: () => router.push('/command'),
      category: 'Navigation',
    },
    {
      key: 'o',
      ctrlKey: true,
      description: 'Go to Oracle',
      action: () => router.push('/oracle'),
      category: 'Navigation',
    },
    {
      key: 's',
      ctrlKey: true,
      shiftKey: true,
      description: 'Go to Sessions',
      action: () => router.push('/sessions'),
      category: 'Navigation',
    },
    // Command palette
    {
      key: 'k',
      ctrlKey: true,
      description: 'Open Command Palette',
      action: onCommandPalette,
      category: 'Actions',
    },
    // Help
    {
      key: '?',
      shiftKey: true,
      description: 'Show Keyboard Shortcuts',
      action: onHelp,
      category: 'Help',
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}
