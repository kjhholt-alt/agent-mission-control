'use client';

import { useState } from 'react';
import { CommandPalette } from './command-palette';
import { ShortcutsHelp } from './shortcuts-help';
import { useGlobalShortcuts } from '@/hooks/useKeyboardShortcuts';

export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  useGlobalShortcuts(
    () => setIsCommandPaletteOpen(true),
    () => setIsShortcutsHelpOpen(true)
  );

  return (
    <>
      {children}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
      <ShortcutsHelp
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
    </>
  );
}
