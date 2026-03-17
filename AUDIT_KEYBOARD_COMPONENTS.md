# Nexus Keyboard Handling & Component Structure Audit
**Date:** 2026-03-17
**Auditor:** Claude Code
**Status:** ✅ COMPREHENSIVE REVIEW COMPLETE

---

## 1. KEYBOARD HANDLING AUDIT

### 1.1 Core Implementation: `use-hotkeys.ts`

**Quality: ✅ GOOD**

#### Strengths
- ✅ **Clean API**: Simple `HotkeyConfig` interface with clear semantics
- ✅ **Input awareness**: Correctly detects `INPUT`, `TEXTAREA`, `SELECT`, and `contentEditable` elements
- ✅ **Cross-platform support**: Properly handles `Ctrl`/`Meta` for Windows/Linux/Mac
- ✅ **Memory management**: Proper cleanup with `removeEventListener` on unmount
- ✅ **Memoization**: Uses `useCallback` to prevent unnecessary re-renders
- ✅ **TypeScript**: Fully typed with proper type definitions

#### Issues Found

**🔴 CRITICAL: Dependency Array Bug (line 44)**
```typescript
const handleKeyDown = useCallback(
  (e: KeyboardEvent) => { ... },
  [hotkeys]  // ← BUG: hotkeys array changes on every render
);
```

**Problem:**
- If `hotkeys` is created inline (which it is in all use cases), it's a new array object every render
- This causes `handleKeyDown` to be recreated every render
- Which causes the event listener to be re-registered every render (destroy → create cycle)
- **Performance impact:** Potential memory leaks, excessive DOM cleanup, wasted CPU cycles

**Example from `page.tsx` (line 67):**
```typescript
useNavigationHotkeys([
  { key: "n", handler: () => setSpawnOpen(true) },
  { key: "r", handler: () => { fetchAgents(); fetchLiveSessions(); } },
]);
// ↑ New array created every render!
```

**Fix:**
```typescript
export function useHotkeys(hotkeys: HotkeyConfig[]) {
  // Move hotkey validation to a stable key
  const hotkeyKey = JSON.stringify(hotkeys); // Memoize the hotkey config

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { ... },
    [hotkeyKey]  // Now stable unless hotkeys actually change
  );
  // OR: Use useMemo to stabilize the array
  const stableHotkeys = useMemo(() => hotkeys, [JSON.stringify(hotkeys)]);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { ... },
    [stableHotkeys]
  );
}
```

**Better approach: Accept hotkey callbacks separately**
```typescript
interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  handler: HotkeyHandler;
  ignoreInputs?: boolean;
}

// In the hook:
useEffect(() => {
  // Reconstruct the handler with stable reference
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [handleKeyDown]); // handleKeyDown is stable because handlers are stable
```

---

**🟡 MODERATE: Handler Loop Has No Prioritization (line 30-42)**
```typescript
for (const hotkey of hotkeys) {
  if (keyMatch && ctrlMatch) {
    e.preventDefault();
    hotkey.handler();
    return; // ← Early exit is good, but no priority/conflict resolution
  }
}
```

**Problem:**
- If two hotkeys map to the same key (e.g., `"n"`), first one wins
- No logging of conflicts, no warnings to developer
- As app grows, accidental collisions will be silent

**Recommendation:**
```typescript
// Option 1: Warn in development
if (process.env.NODE_ENV === "development" && duplicates.length > 0) {
  console.warn(`Hotkey conflicts detected: ${duplicates.join(", ")}`);
}

// Option 2: Support priority levels
interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  handler: HotkeyHandler;
  ignoreInputs?: boolean;
  priority?: number; // Higher = fires first
}

hotkeys.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
```

---

**🟡 MODERATE: No Global Hotkey Namespace (lines 56-67)**
```typescript
export function useNavigationHotkeys(extras?: HotkeyConfig[]) {
  useHotkeys([
    { key: "1", handler: () => (window.location.href = "/") },
    { key: "2", handler: () => (window.location.href = "/ops") },
    // ... 5 more hardcoded routes
    ...(extras || []),
  ]);
}
```

**Problem:**
- Routes are hardcoded strings ("/" → "/" navigation)
- No route validation at build time
- If a route changes, hotkeys silently break
- No way to easily test which hotkeys work where
- Duplicate navigation logic: also in `command-bar.tsx` (lines 58, 68, 78, etc.)

**Recommendation:**
```typescript
// Create a routes registry
const NEXUS_ROUTES = {
  DASHBOARD: "/",
  OPS: "/ops",
  GAME: "/game",
  ORACLE: "/oracle",
  SESSIONS: "/sessions",
  TEMPLATES: "/templates",
  FUSION: "/fusion",
} as const;

// Type-safe navigation hook
export function useNavigationHotkeys(extras?: HotkeyConfig[]) {
  const router = useRouter();

  useHotkeys([
    { key: "1", handler: () => router.push(NEXUS_ROUTES.DASHBOARD) },
    { key: "2", handler: () => router.push(NEXUS_ROUTES.OPS) },
    // ... rest
  ]);
}
```

**Benefits:**
- Single source of truth for routes
- Routes validated at build time
- Easy to add new hotkeys without duplicating routes
- Test-friendly

---

**🟡 MODERATE: preventDefault() Called Unconditionally (line 38)**
```typescript
if (keyMatch && ctrlMatch) {
  e.preventDefault();  // ← Always prevents default
  hotkey.handler();
  return;
}
```

**Problem:**
- Some handlers might want to allow default browser behavior
- Example: User presses "N" while typing a task name → should NOT prevent default
- No way to customize this per hotkey

**Recommendation:**
```typescript
interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  handler: HotkeyHandler;
  ignoreInputs?: boolean;
  preventDefault?: boolean; // Default: true for Ctrl+X, false for alphanumeric
}

const shouldPrevent = hotkey.preventDefault ?? (!hotkey.ctrl);
if (shouldPrevent) e.preventDefault();
```

---

### 1.2 Command Palette: `command-bar.tsx`

**Quality: ✅ MOSTLY GOOD with UX issues**

#### Strengths
- ✅ **Clean architecture**: Commands in data structure, not hardcoded in JSX
- ✅ **Keyboard navigation**: Arrow keys work smoothly
- ✅ **Filtering**: Works with fuzzy search
- ✅ **Focus management**: Auto-focuses input on open
- ✅ **Mouse support**: Can click to select
- ✅ **Visual feedback**: Selected item highlighted
- ✅ **Escape closes**: Standard UX

#### Issues Found

**🔴 CRITICAL: Duplicate Navigation Logic (lines 39-141)**
```typescript
const commands: CommandItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    shortcut: "1",
    action: () => { window.location.href = "/"; },
  },
  {
    id: "ops",
    label: "Operations Center",
    shortcut: "2",
    action: () => { window.location.href = "/ops"; },
  },
  // ... 5 more identical patterns
];
```

**Problem:**
- Navigation routes hardcoded in TWO places:
  1. `useNavigationHotkeys()` in `use-hotkeys.ts` (lines 58-64)
  2. `CommandBar` component (lines 39-141)
- If a route changes, BOTH places must be updated
- This violates **DRY principle** (Don't Repeat Yourself)
- Easy to get out of sync

**Impact:** Currently 7 navigation commands duplicated across 2 files = **100% duplication**

**Fix:** Extract to shared config
```typescript
// lib/navigation.ts
export const NAVIGATION_COMMANDS = [
  { key: "1", label: "Dashboard", route: "/" },
  { key: "2", label: "Operations Center", route: "/ops" },
  { key: "3", label: "3D Factory", route: "/game" },
  { key: "4", label: "Oracle", route: "/oracle" },
  { key: "5", label: "Session History", route: "/sessions" },
  { key: "6", label: "Mission Templates", route: "/templates" },
  { key: "7", label: "Fusion", route: "/fusion" },
] as const;

// Then reuse in both places
```

---

**🟡 MODERATE: Commands Array Recreated Every Render (line 39)**
```typescript
export function CommandBar({ onSpawn, onRefresh }: CommandBarProps) {
  // ... state

  const commands: CommandItem[] = [
    // 10 items, each with a new arrow function
  ];
  // ← commands is a new array every render!

  const filtered = commands.filter(...);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // ... uses filtered
    },
    [open, filtered, selectedIndex] // ← filtered changes every render!
  );
}
```

**Problem:**
- `commands` array created on every render
- This invalidates the `filtered` array
- Which invalidates `handleKeyDown` callback
- Which re-registers the event listener

**Performance impact:** LOW in practice (command palette is modal), but wasteful

**Fix:**
```typescript
const commands: CommandItem[] = useMemo(() => [
  {
    id: "spawn",
    label: "New Mission",
    // ...
  },
  // ... rest
], [onSpawn, onRefresh]);
```

---

**🟡 MODERATE: Missing Keyboard Shortcut (No hotkey to open CommandBar outside button)**
```typescript
// Command palette opens on:
// 1. Ctrl+K (global hotkey in handleKeyDown, line 150)
// 2. User clicks button (implicit, not shown in this code)

// But: Only the dashboard page uses CommandBar!
// Other pages (ops, game, oracle) don't have command palette
```

**Problem:**
- Users can't access command palette from most pages
- Inconsistent UX: Ctrl+K works on dashboard but not on /ops or /game
- Forces users to use side nav instead of keyboard

**Solution:**
```typescript
// app/layout.tsx or a client wrapper
export function LayoutWithCommandBar() {
  return (
    <div>
      <CommandBar onSpawn={...} onRefresh={...} />
      <GlobalNav />
      <main>{children}</main>
    </div>
  );
}
```

---

**🟡 MINOR: Arrow Key Navigation Could Loop (lines 165-170)**
```typescript
if (e.key === "ArrowDown") {
  e.preventDefault();
  setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
  // ↑ Stops at end, doesn't wrap around
} else if (e.key === "ArrowUp") {
  e.preventDefault();
  setSelectedIndex((prev) => Math.max(prev - 1, 0));
  // ↑ Stops at start, doesn't wrap around
}
```

**Analysis:**
- **Pros:** Safe, prevents index out of bounds
- **Cons:** No wrapping (Cmd Palette in VS Code wraps around)
- **Assessment:** Not a bug, preference-based

**Optional enhancement for better UX:**
```typescript
if (e.key === "ArrowDown") {
  e.preventDefault();
  setSelectedIndex((prev) => (prev + 1) % filtered.length);
} else if (e.key === "ArrowUp") {
  e.preventDefault();
  setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
}
```

---

### 1.3 Dashboard Integration: `app/page.tsx`

**Quality: ✅ GOOD implementation, but incomplete coverage**

#### Strengths
- ✅ **Keyboard shortcuts work**: N spawns, R refreshes, 1-7 navigate
- ✅ **Proper handler callbacks**: Uses `useCallback` for fetch functions
- ✅ **Navigation hotkeys used correctly**: Passes extras array to `useNavigationHotkeys`

#### Issues Found

**🟡 MODERATE: Hotkeys Only Work on Dashboard (line 67)**
```typescript
// In app/page.tsx
useNavigationHotkeys([
  { key: "n", handler: () => setSpawnOpen(true) },
  { key: "r", handler: () => { fetchAgents(); fetchLiveSessions(); } },
]);
// ↑ Only on dashboard!
```

**Problem:**
- `N` (spawn) and `R` (refresh) only work on `/`
- Users on `/ops`, `/game`, `/oracle` can't use these hotkeys
- Navigation hotkeys (1-7) work everywhere ✅, but spawn/refresh don't
- Inconsistent experience

**Recommendation:**
```typescript
// Lift hotkey handlers to a layout wrapper
// app/layout.tsx or new app/global-hotkeys.tsx
export function GlobalHotkeys() {
  useNavigationHotkeys([
    {
      key: "n",
      handler: () => {
        // Dispatch event or use global state to trigger spawn modal
        window.dispatchEvent(new CustomEvent("spawn-mission"));
      }
    },
    // ... rest
  ]);
}
```

---

## 2. COMPONENT STRUCTURE AUDIT

### 2.1 Overall Architecture

**Quality: ✅ GOOD organization, some consolidation opportunities**

#### Strengths
- ✅ **Domain-based organization**: Components grouped by feature (game3d, ops, command)
- ✅ **Clear naming**: PascalCase for components, kebab-case for files
- ✅ **Proper separation of concerns**: UI, logic, utilities separated
- ✅ **Reusable hooks**: `use-hotkeys`, `useOpsData`, `useGameData`
- ✅ **Type safety**: TypeScript used throughout

#### Issues Found

**🟡 MODERATE: Props Drilling in Game/Ops Components**

Example from exploration:
```typescript
interface GameCanvasProps {
  hoveredBuilding: string | null;
  selectedBuilding: string | null;
  selectedWorker: string | null;
  workers: Worker[];
  buildings?: Building[];
  conveyors?: ConveyorBelt[];
  onHoverBuilding: (id: string | null) => void;
  onClickBuilding: (id: string) => void;
  onClickWorker: (id: string) => void;
  isMobile?: boolean;
  isStandupActive?: boolean;
}
// ↑ 11 props! Deep drilling tree
```

**Assessment:**
- Acceptable for localized component trees
- Could benefit from context if more than 3 levels deep
- Currently manageable but watch for growth

**Recommendation:**
```typescript
// Create a GameContext for game-specific state
const GameContext = createContext<GameState | null>(null);

export function useGameState() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameState must be inside GameProvider");
  return ctx;
}

// In game/page.tsx
<GameProvider state={gameState}>
  <GameCanvas /> {/* Can now use useGameState() */}
</GameProvider>
```

---

**🟡 MODERATE: Component Size Distribution Uneven**

Analysis of component sizes:
```
Tier 4 (1000+ LOC):
  - Worker3D.tsx (1,591 LOC)  ← Complex animation engine
  - game/page.tsx (1,522 LOC) ← Multiple concerns
  - oracle/page.tsx (981 LOC) ← Chat + briefing logic

Tier 3 (400-650 LOC):
  - template-library.tsx (647 LOC)
  - workbench.tsx (402 LOC)
  - session-list.tsx (367 LOC)

Tier 2 (100-400 LOC): Many components
Tier 1 (<100 LOC): A few utilities
```

**Assessment:**
- Worker3D is a specialized case (animation logic) → acceptable
- game/page.tsx could be split (scene setup, state mgmt, rendering)
- oracle/page.tsx could split chat from briefing logic

**Not a critical issue**, but refactoring opportunities:

```typescript
// Instead of:
// app/game/page.tsx (1,522 LOC)

// Split into:
// app/game/page.tsx (300 LOC - layout)
// components/game3d/GameScene.tsx (500 LOC - R3F setup)
// components/game3d/GameStateManager.tsx (400 LOC - state logic)
// components/game3d/GameControls.tsx (300 LOC - controls)
```

---

**🟡 MODERATE: No Centralized Command Registry**

Current state:
```typescript
// 1. Hotkeys defined in use-hotkeys.ts
// 2. Commands defined in command-bar.tsx
// 3. Keyboard handlers defined in individual components (TaskInputBar, etc.)
// 4. Extra hotkeys per-page (N, R in dashboard)
```

**Problem:**
- Command registry is scattered across 4+ files
- Hard to audit what hotkeys exist
- Easy to create conflicts (what if two places try to handle "N"?)
- No central source of truth

**Recommendation:**
```typescript
// lib/commands.ts - Single source of truth
export const NEXUS_COMMANDS = {
  // Navigation
  NAVIGATE_DASHBOARD: { key: "1", route: "/" },
  NAVIGATE_OPS: { key: "2", route: "/ops" },
  NAVIGATE_GAME: { key: "3", route: "/game" },
  // ... rest

  // Actions
  SPAWN_MISSION: { key: "n" },
  REFRESH_DATA: { key: "r" },
  OPEN_COMMAND_PALETTE: { key: "k", ctrl: true },

  // Component-local
  SUBMIT_TASK: { key: "Enter" },
} as const;

// Type-safe getter
export const getCommand = (id: keyof typeof NEXUS_COMMANDS) =>
  NEXUS_COMMANDS[id];
```

---

### 2.2 Hook Organization

**Quality: ✅ GOOD**

Current hooks:
```
✅ use-hotkeys.ts - Good, single responsibility
✅ use-mobile.ts - Tiny utility, fine
⚠️  use-ops-data.ts - Large (300+ LOC), considers splitting
✅ use-realtime-connection.ts - Clean abstraction
⚠️  achievements.ts - Large (5,679 LOC), but specialized
⚠️  workflows.ts - Large (12,528 LOC), but specialized
```

**Assessment:**
- Specialized hooks (achievements, workflows) are large but self-contained ✅
- Generic data hooks (use-ops-data) are getting large, consider:
  ```typescript
  // Split into:
  // use-ops-tasks.ts - Task loading/filtering
  // use-ops-workers.ts - Worker data
  // use-ops-budget.ts - Budget tracking
  ```

---

### 2.3 UI Primitive Usage

**Quality: ✅ EXCELLENT**

- ✅ Using shadcn/ui for consistency
- ✅ Lucide icons throughout
- ✅ Framer Motion for animations
- ✅ Tailwind for styling
- ✅ No ad-hoc styled components

**No issues found** in this layer.

---

## 3. CROSS-CUTTING CONCERNS

### 3.1 Event Listener Management

**Current pattern:**
```typescript
// Every component that uses keyboard does this:
const handleKeyDown = useCallback((...) => {...}, [deps]);

useEffect(() => {
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [handleKeyDown]);
```

**Issues:**
- **3 separate listeners**: useHotkeys, CommandBar, TaskInputBar
- **Potential conflicts**: First listener to preventDefault() wins
- **Order-dependent**: Which listener registers first?
- **No coordination**: No way to know what hotkeys are active

**Recommendation:**
```typescript
// Create a central hotkey dispatcher
class HotkeyDispatcher {
  private handlers = new Map<string, HotkeyHandler[]>();

  register(hotkey: HotkeyConfig) {
    const key = `${hotkey.key}_${hotkey.ctrl ? "ctrl" : ""}`;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, []);
    }
    this.handlers.get(key)!.push(hotkey.handler);
  }

  unregister(hotkey: HotkeyConfig) {
    // ...
  }

  dispatch(e: KeyboardEvent) {
    // Call all handlers, with priority support
  }
}

// Then:
// useHotkeys, CommandBar, and local handlers all register with dispatcher
// Single window listener, cleaner conflicts
```

---

### 3.2 Testing Considerations

**Current state:** No keyboard or component tests visible

**Recommendation:**
```typescript
// __tests__/use-hotkeys.test.ts
describe("useHotkeys", () => {
  it("should fire handler when key matches", () => {
    const handler = jest.fn();
    renderHook(() => useHotkeys([{ key: "n", handler }]));

    fireEvent.keyDown(window, { key: "n" });
    expect(handler).toHaveBeenCalled();
  });

  it("should skip when ignoreInputs=true and user is typing", () => {
    const handler = jest.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);

    renderHook(() => useHotkeys([{ key: "n", handler, ignoreInputs: true }]));

    input.focus();
    fireEvent.keyDown(input, { key: "n" });
    expect(handler).not.toHaveBeenCalled();
  });
});
```

---

## 4. SUMMARY & RECOMMENDATIONS

### Quick Wins (Implement Today)

1. **Fix dependency array in `use-hotkeys.ts`** 🔴 CRITICAL
   - Current: re-registers listener every render
   - Time: 15 minutes
   - Impact: Eliminates unnecessary DOM churn

2. **Extract route registry to `lib/navigation.ts`** 🟡 IMPORTANT
   - Current: Hardcoded in 2 places, hard to maintain
   - Time: 30 minutes
   - Impact: Single source of truth, easier to test

3. **Add command palette to all pages** 🟡 IMPORTANT
   - Current: Only on dashboard
   - Time: 20 minutes
   - Impact: Consistent keyboard UX everywhere

### Medium-Term Improvements (Next Sprint)

4. **Centralize hotkey registry** 🟡 NICE-TO-HAVE
   - Current: Scattered across files
   - Time: 1 hour
   - Impact: Audit-friendly, conflict-proof

5. **Add priority levels to hotkeys** 🟡 NICE-TO-HAVE
   - Current: First match wins
   - Time: 30 minutes
   - Impact: Resolves conflicts gracefully

6. **Split large components** 🟡 OPTIONAL
   - Current: Worker3D (1,591), game/page.tsx (1,522), oracle/page.tsx (981)
   - Time: 2 hours per component
   - Impact: Easier to test, maintain, reuse

### Testing Strategy

7. **Add hotkey tests**
   - Coverage: use-hotkeys.ts, CommandBar, integration tests
   - Time: 2 hours
   - Impact: Prevent regressions

---

## 5. FILES AFFECTED

### High Priority
- `src/lib/use-hotkeys.ts` — Fix dependency array, add tests
- `src/components/command-bar.tsx` — Use route registry
- `src/app/page.tsx` — Lift hotkeys to layout
- **NEW:** `src/lib/navigation.ts` — Route registry
- **NEW:** `src/lib/commands.ts` — Command registry

### Medium Priority
- `src/app/layout.tsx` — Import global hotkeys
- `src/components/command/TaskInputBar.tsx` — Review keyboard handling
- `src/components/game3d/*` — Consider context wrapper

### Testing
- **NEW:** `__tests__/use-hotkeys.test.ts`
- **NEW:** `__tests__/command-bar.test.tsx`

---

## 6. SCORE CARD

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| **Keyboard Handling** | 7/10 | ⚠️ NEEDS FIXES | Dependency bug + routing duplication |
| **Component Structure** | 8/10 | ✅ GOOD | Well organized, some consolidation possible |
| **Code Reusability** | 6/10 | ⚠️ DUPLICATED | Navigation logic in 2 places |
| **Testing** | 0/10 | ❌ NONE | No keyboard or component tests |
| **Documentation** | 7/10 | ✅ GOOD | Clear comments, but no hotkey documentation |
| **Accessibility** | 6/10 | ⚠️ NEEDS WORK | No ARIA labels on command items, limited keyboard nav |
| **Performance** | 6/10 | ⚠️ MINOR ISSUES | Unnecessary re-renders due to dependency bugs |
| **Maintainability** | 6/10 | ⚠️ SCATTERED LOGIC | Commands/routes spread across multiple files |

**OVERALL: 6.5/10 - FUNCTIONAL BUT NEEDS CLEANUP**

---

## Checklist for Implementation

- [ ] Fix `useHotkeys` dependency array
- [ ] Extract route registry to `lib/navigation.ts`
- [ ] Update `useNavigationHotkeys` to use registry
- [ ] Update `CommandBar` to use registry
- [ ] Add command palette to `app/layout.tsx`
- [ ] Create `lib/commands.ts` for centralized registry
- [ ] Add hotkey tests to `__tests__/`
- [ ] Add HOTKEYS.md documentation
- [ ] Remove duplicate route navigation logic
- [ ] Update CLAUDE.md with keyboard shortcut reference

