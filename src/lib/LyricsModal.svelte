<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { getAuth } from "./auth.svelte.ts";
  import {
    deleteLyrics,
    fetchLyrics,
    fetchLyricsCandidates,
    refreshLyrics,
    saveLyrics,
  } from "./api";
  import {
    editableLyrics,
    lyricsProviderNames,
    lyricsSourceLabel,
  } from "./lyrics";
  import Modal from "./Modal.svelte";
  import type {
    LyricsCandidateSummaryResponse,
    LyricsRefreshResponse,
    LyricsResponse,
    LyricsScope,
  } from "./types";

  interface Props {
    trackId: string;
    title: string;
    // The track's lyrics may have changed.
    onchanged?: () => void;
    onclose: () => void;
  }

  let { trackId, title, onchanged, onclose }: Props = $props();

  const auth = getAuth();
  const tabs = [
    { id: "sources", label: "Sources" },
    { id: "edit", label: "Edit" },
  ] as const;

  let canShare = $derived(auth.hasPermission("manage_metadata"));
  let canFind = $derived(auth.hasPermission("sync_metadata"));

  let tab = $state<(typeof tabs)[number]["id"]>("sources");
  let candidates = $state<LyricsCandidateSummaryResponse[] | null>(null);
  let providerNames = $state<Record<string, string>>({});
  let text = $state("");
  let language = $state("");
  let scope = $state<LyricsScope>("personal");
  let loadedText = $state("");
  let loadedLanguage = $state("");
  let saving = $state(false);
  let removing = $state<string | null>(null);
  let finding = $state(false);
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);

  let dirty = $derived(text !== loadedText || language !== loadedLanguage);
  let hasPersonal = $derived(
    candidates?.some((c) => c.scope === "personal") ?? false,
  );
  let hasSharedManual = $derived(candidates?.some(isSharedManual) ?? false);
  // The server serves only the winning entry, so with a personal copy the
  // editor cannot start from the shared text it is about to replace.
  let replacesUnseen = $derived(
    scope === "shared" && hasPersonal && hasSharedManual,
  );

  function isSharedManual(c: LyricsCandidateSummaryResponse): boolean {
    return c.scope === "shared" && c.source === "manual";
  }

  function fillEditor(served: LyricsResponse | null) {
    loadedText = text = served ? editableLyrics(served) : "";
    loadedLanguage = language =
      served && served.language !== "und" ? served.language : "";
    scope =
      canShare && served?.scope === "shared" && served.source === "manual"
        ? "shared"
        : "personal";
  }

  let latestLoad = 0;

  async function load(): Promise<LyricsCandidateSummaryResponse[] | null> {
    const current = ++latestLoad;
    try {
      const [listed, served] = await Promise.all([
        fetchLyricsCandidates(trackId),
        fetchLyrics(trackId),
      ]);
      if (current !== latestLoad) return null;
      candidates = listed.items;
      if (!dirty) fillEditor(served);
      return listed.items;
    } catch (err) {
      if (current === latestLoad) {
        error = err instanceof Error ? err.message : "Couldn't load lyrics.";
      }
      return null;
    }
  }

  load();
  lyricsProviderNames().then(
    (names) => (providerNames = names),
    () => {},
  );

  function detailsOf(c: LyricsCandidateSummaryResponse): string {
    return [
      c.lrc_available ? "Synced" : c.has_word_cues ? null : "Plain text",
      c.has_word_cues ? "Word timing" : null,
      c.language !== "und" ? c.language.toUpperCase() : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function canRemove(c: LyricsCandidateSummaryResponse): boolean {
    return c.scope === "personal" || (canShare && isSharedManual(c));
  }

  async function remove(c: LyricsCandidateSummaryResponse) {
    const whose = c.scope === "personal" ? "your" : "the shared";
    if (removing || !confirm(`Remove ${whose} lyrics for ${title}?`)) return;
    removing = c.id;
    error = null;
    notice = null;
    try {
      await deleteLyrics(trackId, c.scope);
      await load();
      onchanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Couldn't remove lyrics.";
    } finally {
      removing = null;
    }
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || saving) return;
    saving = true;
    error = null;
    notice = null;
    try {
      await saveLyrics(trackId, scope, body, language.trim());
      loadedText = text;
      loadedLanguage = language;
      tab = "sources";
      notice = "Lyrics saved.";
      await load();
      onchanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Couldn't save lyrics.";
    } finally {
      saving = false;
    }
  }

  function stamp(c: LyricsCandidateSummaryResponse): string {
    return `${c.id}:${c.updated_at}`;
  }

  function providerList(ids: string[]): string {
    return ids.map((id) => providerNames[id] ?? id).join(", ");
  }

  // A clean refresh says only that nothing failed, so what was found comes
  // from comparing the entries before and after it.
  function findResult(
    outcome: LyricsRefreshResponse,
    items: LyricsCandidateSummaryResponse[],
    before: Set<string>,
  ): string {
    const failed = outcome.failed_providers;
    const busy = outcome.in_progress_providers;
    const parts: string[] = [];
    if (items.some((c) => !before.has(stamp(c)))) {
      parts.push("Found new lyrics.");
    } else if (failed.length === 0 && busy.length === 0) {
      parts.push(
        items.length > 0 ? "No new lyrics found." : "No lyrics found.",
      );
    }
    if (failed.length > 0) {
      parts.push(`Couldn't get lyrics from ${providerList(failed)}.`);
    }
    if (busy.length > 0) {
      parts.push(`Still waiting on ${providerList(busy)}. Try again shortly.`);
    }
    return parts.join(" ");
  }

  async function find() {
    if (finding) return;
    finding = true;
    error = null;
    notice = null;
    const before = new Set((candidates ?? []).map(stamp));
    try {
      const outcome = await refreshLyrics(trackId);
      const items = await load();
      onchanged?.();
      if (items) notice = findResult(outcome, items, before);
    } catch (err) {
      error = err instanceof Error ? err.message : "Couldn't find lyrics.";
    } finally {
      finding = false;
    }
  }

  function close() {
    if (saving || removing) return;
    if (dirty && !confirm("Discard your unsaved lyrics?")) return;
    onclose();
  }
</script>

<Modal title="Lyrics" subtitle={title} onclose={close}>
  {#snippet toolbar()}
    <div
      class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs dark:border-neutral-700 dark:bg-[#1b1d1e]"
      role="tablist"
      aria-label="Lyrics"
    >
      {#each tabs as option (option.id)}
        {@const active = tab === option.id}
        <button
          type="button"
          role="tab"
          aria-selected={active}
          class="rounded px-3 py-1 font-medium transition-colors"
          class:bg-[#E6CEE3]={active}
          class:text-slate-900={active}
          class:dark:bg-[#BB7FB5]={active}
          class:dark:text-white={active}
          class:text-slate-600={!active}
          class:dark:text-neutral-400={!active}
          onclick={() => (tab = option.id)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  {/snippet}

  {#if tab === "sources"}
    {#if candidates === null}
      {#if !error}
        <p class="text-sm text-slate-500 dark:text-neutral-400">Loading…</p>
      {/if}
    {:else if candidates.length === 0}
      <p class="text-sm text-slate-500 dark:text-neutral-400">
        No lyrics for this track yet.
      </p>
    {:else}
      <ul class="divide-y divide-slate-100 dark:divide-neutral-800">
        {#each candidates as candidate, i (candidate.id)}
          <li class="flex items-center justify-between gap-3 py-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-sm">
                <span class="truncate">
                  {lyricsSourceLabel(candidate, providerNames)}
                </span>
                {#if i === 0}
                  <span
                    class="shrink-0 rounded bg-[#E6CEE3] px-1.5 text-xs text-slate-900 dark:bg-[#BB7FB5] dark:text-white"
                    >In use</span
                  >
                {/if}
              </div>
              <div class="text-xs text-slate-500 dark:text-neutral-400">
                {detailsOf(candidate)}
              </div>
            </div>
            {#if canRemove(candidate)}
              <button
                type="button"
                class="shrink-0 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-slate-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-neutral-700"
                disabled={removing !== null}
                onclick={() => remove(candidate)}
              >
                {removing === candidate.id ? "Removing…" : "Remove"}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <form id="lyrics-edit" class="space-y-3 text-sm" onsubmit={save}>
      <textarea
        bind:value={text}
        rows="14"
        disabled={candidates === null}
        spellcheck="false"
        placeholder="Paste plain text or timed LRC lines…"
        aria-label="Lyrics"
        class="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
      ></textarea>
      <p class="text-xs text-slate-500 dark:text-neutral-400">
        Timed lines look like [01:23.45] and follow along with playback.
      </p>
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label
          class="flex items-center gap-2 text-slate-700 dark:text-neutral-300"
        >
          Language
          <input
            type="text"
            bind:value={language}
            placeholder="en, Japanese…"
            class="w-32 rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
          />
        </label>
        {#if canShare}
          <div class="flex items-center gap-4">
            <label
              class="flex items-center gap-1.5 text-slate-700 dark:text-neutral-300"
            >
              <input type="radio" bind:group={scope} value="personal" />
              Just for me
            </label>
            <label
              class="flex items-center gap-1.5 text-slate-700 dark:text-neutral-300"
            >
              <input type="radio" bind:group={scope} value="shared" />
              Everyone
            </label>
          </div>
        {/if}
      </div>
      {#if replacesUnseen}
        <p class="text-xs text-slate-500 dark:text-neutral-400">
          This replaces the current shared lyrics, which can't be shown here
          while you have your own.
        </p>
      {/if}
    </form>
  {/if}

  {#if error}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {:else if notice}
    <p role="status" class="text-sm text-slate-600 dark:text-neutral-300">
      {notice}
    </p>
  {/if}

  {#snippet footer()}
    <button
      type="button"
      class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
      onclick={close}
    >
      Close
    </button>
    {#if tab === "edit"}
      <button
        type="submit"
        form="lyrics-edit"
        disabled={!text.trim() || candidates === null || saving}
        class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    {:else if canFind}
      <button
        type="button"
        disabled={finding}
        class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
        onclick={find}
      >
        {finding ? "Finding…" : "Find lyrics"}
      </button>
    {/if}
  {/snippet}
</Modal>
