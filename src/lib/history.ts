// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

// View state (scroll position, list pages) is kept in each history entry so
// Back and Forward return to where the user left off. Every entry gets a key,
// and writes name the entry they belong to, so a save that finishes after a
// navigation can't land on the next entry.

type EntryState = {
  key?: string;
  view?: Record<string, unknown>;
  [name: string]: unknown;
};

function current(): EntryState {
  const state = history.state;
  return state && typeof state === "object" ? state : {};
}

// Safari throws once a page makes too many history calls in a short window.
function write(state: EntryState) {
  try {
    history.replaceState(state, "");
  } catch {
    // The state is a convenience; losing it only loses the restore.
  }
}

function newKey() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function entryKey(): string {
  const state = current();
  if (typeof state.key === "string") return state.key;
  const key = newKey();
  write({ ...state, key });
  return key;
}

export function readView(name: string): unknown {
  return current().view?.[name];
}

export function writeView(key: string, name: string, value: unknown) {
  const state = current();
  if (state.key !== key) return;
  write({ ...state, view: { ...state.view, [name]: value } });
}

// Opens a new entry without firing hashchange, so the caller updates the
// route itself.
export function pushEntry(url: string, state: Record<string, unknown> = {}) {
  flushScroll();
  try {
    history.pushState({ ...state, key: newKey() }, "", url);
  } catch {
    location.hash = new URL(url, location.href).hash;
  }
}

export function replaceEntry(url: string) {
  const { key, view: _view, ...state } = current();
  try {
    history.replaceState({ ...state, key: key ?? newKey() }, "", url);
  } catch {
    // Keep the current URL; the view still shows the new state.
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let restore: { stop: () => void; y: number } | null = null;

function flushScroll() {
  if (saveTimer === undefined) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const key = current().key;
  if (key) writeView(key, "scroll", window.scrollY);
}

function onScroll() {
  const key = current().key;
  if (!key) return;
  if (restore) {
    // Scrolling caused by the restore itself, or by the page shrinking while
    // views swap, isn't the user's position. Any other scroll, such as
    // dragging the scrollbar, means the user has taken over.
    const bottom =
      document.documentElement.scrollHeight - window.innerHeight - 2;
    if (Math.abs(window.scrollY - restore.y) <= 2 || window.scrollY >= bottom)
      return;
    restore.stop();
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    writeView(key, "scroll", window.scrollY);
  }, 200);
}

// Content loads after the route renders, so the saved position is held while
// the page grows, until the user takes over or loading has had its chance.
function holdScroll(y: number) {
  const apply = () => window.scrollTo(0, y);
  const observer = new ResizeObserver(apply);
  const events = ["wheel", "touchstart", "keydown", "pointerdown"];
  const stop = () => {
    observer.disconnect();
    clearTimeout(timer);
    for (const event of events) removeEventListener(event, stop, true);
    if (restore?.stop === stop) restore = null;
  };
  const timer = setTimeout(stop, 5000);
  for (const event of events) addEventListener(event, stop, true);
  observer.observe(document.documentElement);
  restore = { stop, y };
  apply();
}

// Called after every navigation. New entries start at the top; entries
// reached with Back or Forward return to their saved position.
export function restoreScroll() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  restore?.stop();
  const saved = readView("scroll");
  entryKey();
  if (typeof saved === "number") holdScroll(saved);
  else window.scrollTo(0, 0);
}

history.scrollRestoration = "manual";

// A reload starts the page fresh, at the first page and the top.
const navigation = performance.getEntriesByType("navigation")[0] as
  | PerformanceNavigationTiming
  | undefined;
if (navigation?.type === "reload") {
  const { view: _view, ...state } = current();
  write(state);
}

addEventListener("scroll", onScroll, { passive: true });
// A link click, the mouse back button or Alt+Left navigates before the next
// save would run.
for (const event of ["click", "pointerdown", "keydown"])
  addEventListener(event, flushScroll, true);
addEventListener("pagehide", flushScroll);
restoreScroll();
