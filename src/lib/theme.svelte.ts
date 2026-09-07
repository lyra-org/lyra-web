// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "lyra-theme";

function readStoredMode(): ThemeMode {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isDarkActive(m: ThemeMode): boolean {
  return m === "dark" || (m === "system" && systemPrefersDark());
}

function applyDarkClass(active: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", active);
}

const initialMode = readStoredMode();
let mode = $state<ThemeMode>(initialMode);

// Apply on import so the body picks up the right palette before mount.
if (typeof window !== "undefined") {
  applyDarkClass(isDarkActive(initialMode));
  // React to OS theme changes while in "system" mode.
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (mode === "system") applyDarkClass(systemPrefersDark());
    });
}

const ORDER: ThemeMode[] = ["system", "light", "dark"];

export function getTheme() {
  return {
    get mode() {
      return mode;
    },
    get isDark() {
      return isDarkActive(mode);
    },
    setMode(next: ThemeMode) {
      mode = next;
      if (next === "system") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, next);
      }
      applyDarkClass(isDarkActive(next));
    },
    cycle() {
      const idx = ORDER.indexOf(mode);
      this.setMode(ORDER[(idx + 1) % ORDER.length]);
    },
  };
}
