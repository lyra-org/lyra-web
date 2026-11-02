// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

// The server accepts at most 500 targets per bulk check.
const CHECK_CAP = 500;

/**
 * The caller's per-target state, such as favorites or ratings, loaded through
 * a bulk check endpoint. Loads requested in the same tick share one check.
 */
export function createTargetStates<T>(
  check: (targetIds: string[]) => Promise<Record<string, T>>,
) {
  const states = $state<Record<string, T>>({});
  const loadingIds = $state<Record<string, boolean>>({});
  const savingIds = $state<Record<string, boolean>>({});

  const pending = new Map<string, Promise<T>>();
  let batch:
    | { ids: string[]; response: Promise<Record<string, T>> }
    | undefined;

  function load(targetId: string): Promise<T> {
    if (targetId in states) return Promise.resolve(states[targetId]);

    const existing = pending.get(targetId);
    if (existing) return existing;

    if (!batch) {
      const ids: string[] = [];
      const response = Promise.resolve().then(() => {
        if (batch?.ids === ids) batch = undefined;
        return check(ids);
      });
      batch = { ids, response };
    }

    const { ids, response } = batch;
    ids.push(targetId);
    if (ids.length === CHECK_CAP) batch = undefined;

    loadingIds[targetId] = true;
    const request = response
      .then((res) => {
        if (!(targetId in res))
          throw new Error(`Missing state for ${targetId}`);
        states[targetId] = res[targetId];
        return res[targetId];
      })
      .finally(() => {
        loadingIds[targetId] = false;
        pending.delete(targetId);
      });
    pending.set(targetId, request);
    return request;
  }

  /** Shows `next` at once, restoring the previous state if `save` fails. */
  async function update(
    targetId: string,
    next: T,
    save: () => Promise<void>,
  ): Promise<void> {
    const current = await load(targetId);
    states[targetId] = next;
    savingIds[targetId] = true;
    try {
      await save();
    } catch (err) {
      states[targetId] = current;
      throw err;
    } finally {
      savingIds[targetId] = false;
    }
  }

  return {
    get: (targetId: string): T | undefined => states[targetId],
    isLoading: (targetId: string): boolean => loadingIds[targetId] ?? false,
    isSaving: (targetId: string): boolean => savingIds[targetId] ?? false,
    load,
    update,
  };
}
