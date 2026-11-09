<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import {
    applyMetadataChanges,
    fetchArtistSummary,
    fetchEntityMetadata,
    fetchExternalIds,
    fetchLabels,
    fetchProviders,
    previewMetadataChanges,
    refreshEntity,
  } from "./api";
  import { getAuth } from "./auth.svelte.ts";
  import { catalogChanged } from "./catalog.svelte.ts";
  import { staleReview, withExpected } from "./metadataChanges";
  import {
    ARTIST_TYPES,
    CREDIT_TYPES,
    describeField,
    filledArtistIds,
    KINDS,
    NAMES,
    ORDER,
    RELATION_TYPES,
    RELEASE_TYPES,
    REQUIRED,
  } from "./metadataFields";
  import type {
    ExternalIdResponse,
    LabelResponse,
    MetadataChange,
    MetadataChangePreview,
    MetadataCreditValue,
    MetadataFieldDiff,
    MetadataFieldEdit,
    MetadataFieldName,
    MetadataLabelValue,
    MetadataRelationValue,
    MetadataSnapshot,
    ProviderResponse,
    ReleaseResponse,
  } from "./types";
  import ArtistPicker from "./ArtistPicker.svelte";
  import MergeReview from "./MergeReview.svelte";
  import Modal from "./Modal.svelte";
  import ReleasePicker from "./ReleasePicker.svelte";

  interface Props {
    entityId: string;
    // A saved edit changed what the entity shows. A merge reloads the whole
    // page instead.
    onchanged?: () => void;
    onclose: () => void;
  }

  let { entityId, onchanged, onclose }: Props = $props();

  interface ProviderGroup {
    providerId: string;
    displayName: string;
    position: number;
    ids: ExternalIdResponse[];
  }

  const NOUNS = { release: "album", artist: "artist", track: "track" } as const;

  const auth = getAuth();

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none disabled:opacity-50 dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400";
  const smallInputClass =
    "min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400";

  let snapshot = $state.raw<MetadataSnapshot | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Drafts per field kind. Scalars are edited as strings.
  let text = $state<Partial<Record<MetadataFieldName, string>>>({});
  let genres = $state<string[]>([]);
  let labels = $state<MetadataLabelValue[]>([]);
  let credits = $state<MetadataCreditValue[]>([]);
  let relations = $state<MetadataRelationValue[]>([]);
  // Manual fields to hand back to tags and providers.
  let inherit = $state<MetadataFieldName[]>([]);

  let genreInput = $state("");
  let allLabels = $state<LabelResponse[]>([]);
  let artistNames = $state<Record<string, string>>({});

  let ids = $state<ExternalIdResponse[]>([]);
  let providers = $state<ProviderResponse[]>([]);
  // Drafts of the manual and resolved IDs, by idKey.
  let idDrafts = $state<Record<string, string>>({});
  // Manual IDs to hand back to the provider.
  let inheritedIds = $state<string[]>([]);
  let droppedAliases = $state<string[]>([]);

  // Duplicates to merge into this entity, which always wins, so the page it was
  // opened from stays.
  let losers = $state<{ id: string; name: string }[]>([]);

  let tab = $state<"details" | "ids" | "merge">("details");
  let step = $state<"edit" | "review" | "saved">("edit");
  let previews = $state<MetadataChangePreview[]>([]);
  let busy = $state(false);
  let notice = $state<string | null>(null);
  let saved = false;
  let merged = false;

  let fields = $derived(
    snapshot
      ? ORDER[snapshot.entity_type].filter((f) => snapshot!.fields[f])
      : [],
  );
  let noun = $derived(snapshot ? NOUNS[snapshot.entity_type] : "entity");
  let canMerge = $derived(
    snapshot?.entity_type === "release" || snapshot?.entity_type === "artist",
  );

  let idGroups = $derived.by(() => {
    const byProvider = new Map<string, ProviderGroup>();
    const sorted = [...ids].sort(
      (a, b) =>
        a.id_type.localeCompare(b.id_type) ||
        Number(a.source === "alias") - Number(b.source === "alias"),
    );
    for (const id of sorted) {
      let group = byProvider.get(id.provider_id);
      if (!group) {
        const provider = providers.find(
          (p) => p.provider_id === id.provider_id,
        );
        group = {
          providerId: id.provider_id,
          displayName: provider?.display_name ?? id.provider_id,
          position: provider?.position ?? Infinity,
          ids: [],
        };
        byProvider.set(id.provider_id, group);
      }
      group.ids.push(id);
    }
    return [...byProvider.values()].sort(
      (a, b) =>
        a.position - b.position || a.displayName.localeCompare(b.displayName),
    );
  });

  $effect(() => {
    load(entityId);
  });

  async function load(id: string) {
    loading = true;
    error = null;
    try {
      const [loaded, loadedIds, loadedProviders] = await Promise.all([
        fetchEntityMetadata(id),
        fetchExternalIds(id),
        fetchProviders(),
      ]);
      snapshot = loaded;
      reset(loaded);
      ids = loadedIds;
      providers = loadedProviders;
      idDrafts = Object.fromEntries(
        loadedIds.map((entry) => [idKey(entry), entry.id_value]),
      );
      if (loaded.fields.labels) {
        fetchLabels()
          .then((list) => (allLabels = list))
          .catch(() => {});
      }
      loadArtistNames([...credits, ...relations].map((c) => c.artist_id));
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load metadata";
    } finally {
      loading = false;
    }
  }

  function reset(loaded: MetadataSnapshot) {
    const next: Partial<Record<MetadataFieldName, string>> = {};
    for (const [name, state] of Object.entries(loaded.fields)) {
      const field = name as MetadataFieldName;
      const value = state?.value;
      if (typeof value === "string" || typeof value === "number") {
        next[field] = String(value);
      } else if (value == null) {
        next[field] = "";
      }
    }
    text = next;
    genres = [...((loaded.fields.genres?.value as string[]) ?? [])];
    labels = structuredClone(
      (loaded.fields.labels?.value as MetadataLabelValue[]) ?? [],
    );
    credits = structuredClone(
      (loaded.fields.credits?.value as MetadataCreditValue[]) ?? [],
    );
    relations = structuredClone(
      (loaded.fields.relations?.value as MetadataRelationValue[]) ?? [],
    );
    inherit = [];
  }

  async function loadArtistNames(ids: string[]) {
    const missing = [...new Set(ids)].filter((id) => !(id in artistNames));
    const found = await Promise.all(
      missing.map((id) =>
        fetchArtistSummary(id)
          .then((a) => [id, a.name] as const)
          .catch(() => [id, null] as const),
      ),
    );
    for (const [id, name] of found) {
      if (name != null) artistNames[id] = name;
    }
  }

  function trimmed(value: string | null | undefined): string | null {
    const t = value?.trim() ?? "";
    return t === "" ? null : t;
  }

  // A value as an edit would send it. Loaded lists pass through here too, so
  // comparing them with a draft can't trip over their shape or key order.
  function editValue(field: MetadataFieldName, value: unknown): unknown {
    switch (KINDS[field]) {
      case "number": {
        const t = trimmed(value == null ? null : String(value));
        return t == null ? null : Number(t);
      }
      case "genres":
        return value;
      case "labels":
        return (value as MetadataLabelValue[]).map((l) => ({
          id: l.id,
          catalog_number: trimmed(l.catalog_number),
        }));
      case "credits":
        return (value as MetadataCreditValue[]).map((c) => ({
          artist_id: c.artist_id,
          type: c.type,
          detail: trimmed(c.detail),
        }));
      case "relations":
        return (value as MetadataRelationValue[]).map((r) => ({
          artist_id: r.artist_id,
          type: r.type,
          attributes: trimmed(r.attributes),
        }));
      default:
        return trimmed(value as string | null | undefined);
    }
  }

  function draftValue(field: MetadataFieldName): unknown {
    switch (KINDS[field]) {
      case "genres":
        return editValue(field, genres);
      case "labels":
        return editValue(field, labels);
      case "credits":
        return editValue(field, credits);
      case "relations":
        return editValue(field, relations);
      default:
        return editValue(field, text[field]);
    }
  }

  function loadedValue(field: MetadataFieldName): unknown {
    const value = snapshot?.fields[field]?.value ?? null;
    return Array.isArray(value) ? editValue(field, value) : value;
  }

  function sourceNote(
    entry: MetadataFieldDiff,
    unchanged: boolean,
  ): string | null {
    if (entry.before.source === "manual" && entry.after.source === "resolved") {
      return "Back to tags and providers";
    }
    return unchanged ? "Stops following tags and providers" : null;
  }

  function isEdited(field: MetadataFieldName): boolean {
    if (inherit.includes(field)) return false;
    const loaded = loadedValue(field);
    // An untouched box is no edit, even if trimming would change what it holds.
    if (!Array.isArray(loaded) && text[field] === String(loaded ?? "")) {
      return false;
    }
    return JSON.stringify(draftValue(field)) !== JSON.stringify(loaded);
  }

  function isManual(field: MetadataFieldName): boolean {
    return snapshot?.fields[field]?.source === "manual";
  }

  function fieldError(field: MetadataFieldName): string | null {
    if (inherit.includes(field)) return null;
    const kind = KINDS[field];
    const t = trimmed(text[field]);
    if (REQUIRED.includes(field) && t == null) return "Required";
    if (kind === "number" && t != null) {
      const n = Number(t);
      if (!Number.isInteger(n) || n < 1) return "Whole number from 1";
      if (field === "year" && n > 9999) return "Up to 9999";
    }
    if (kind === "date" && t != null && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(t)) {
      return "YYYY, YYYY-MM or YYYY-MM-DD";
    }
    return null;
  }

  let edits = $derived.by((): MetadataFieldEdit[] =>
    fields.flatMap((field): MetadataFieldEdit[] => {
      if (inherit.includes(field)) return [{ field, operation: "inherit" }];
      if (!isEdited(field)) return [];
      return [{ field, operation: "set", value: draftValue(field) }];
    }),
  );

  let idChanges = $derived(
    ids.flatMap((id): MetadataChange[] => {
      const key = idKey(id);
      const target = {
        entity_id: entityId,
        provider_id: id.provider_id,
        id_type: id.id_type,
      };
      if (id.source === "alias") {
        return droppedAliases.includes(key)
          ? [
              {
                ...target,
                action: "remove_external_id_alias",
                id_value: id.id_value,
              },
            ]
          : [];
      }
      if (inheritedIds.includes(key)) {
        return [{ ...target, action: "inherit_external_id" }];
      }
      const value = idDrafts[key].trim();
      return value && value !== id.id_value
        ? [{ ...target, action: "set_external_id", id_value: value }]
        : [];
    }),
  );

  // Edits run first, so that a merge fills in only what they leave out.
  let changeSet = $derived.by((): MetadataChange[] => [
    ...(edits.length > 0
      ? [{ action: "edit_metadata" as const, entity_id: entityId, edits }]
      : []),
    ...idChanges,
    ...(losers.length > 0
      ? [
          {
            action: "merge" as const,
            winner_id: entityId,
            loser_ids: losers.map((l) => l.id),
          },
        ]
      : []),
  ]);

  let changeCount = $derived(edits.length + idChanges.length + losers.length);
  let merging = $derived(losers.length > 0);

  let invalidFields = $derived(fields.some((f) => fieldError(f) != null));
  let invalidIds = $derived(ids.some((id) => idError(id) != null));
  let invalid = $derived(invalidFields || invalidIds);

  let tabs = $derived([
    {
      id: "details" as const,
      label: "Details",
      changed: edits.length > 0,
      problem: invalidFields,
    },
    {
      id: "ids" as const,
      label: "External IDs",
      changed: idChanges.length > 0,
      problem: invalidIds,
    },
    ...(canMerge
      ? [
          {
            id: "merge" as const,
            label: "Merge",
            changed: losers.length > 0,
            problem: false,
          },
        ]
      : []),
  ]);

  function idKey(id: ExternalIdResponse): string {
    const key = `${id.provider_id}/${id.id_type}`;
    return id.source === "alias" ? `${key}/${id.id_value}` : key;
  }

  // An unmatched ID holds an empty value, which may stay empty.
  function idError(id: ExternalIdResponse): string | null {
    if (id.source === "alias" || inheritedIds.includes(idKey(id))) return null;
    return id.id_value !== "" && !idDrafts[idKey(id)].trim()
      ? "Can't be blank"
      : null;
  }

  function isIdEdited(id: ExternalIdResponse): boolean {
    const key = idKey(id);
    if (id.source === "alias") return droppedAliases.includes(key);
    return idDrafts[key].trim() !== id.id_value;
  }

  function toggleInheritId(id: ExternalIdResponse) {
    const key = idKey(id);
    if (inheritedIds.includes(key)) {
      inheritedIds = inheritedIds.filter((k) => k !== key);
      return;
    }
    idDrafts[key] = id.id_value;
    inheritedIds = [...inheritedIds, key];
  }

  function toggleAlias(id: ExternalIdResponse) {
    const key = idKey(id);
    droppedAliases = droppedAliases.includes(key)
      ? droppedAliases.filter((k) => k !== key)
      : [...droppedAliases, key];
  }

  function providerName(providerId: string): string {
    return (
      providers.find((p) => p.provider_id === providerId)?.display_name ??
      providerId
    );
  }

  function releaseName(release: ReleaseResponse): string {
    const artists = release.artists?.map((a) => a.name).join(", ");
    return artists ? `${release.title} · ${artists}` : release.title;
  }

  function toggleInherit(field: MetadataFieldName) {
    if (inherit.includes(field)) {
      inherit = inherit.filter((f) => f !== field);
      return;
    }
    // Drops any edit; the field now follows tags and providers.
    if (snapshot) restoreField(field, snapshot);
    inherit = [...inherit, field];
  }

  function restoreField(field: MetadataFieldName, loaded: MetadataSnapshot) {
    const value = loaded.fields[field]?.value;
    switch (KINDS[field]) {
      case "genres":
        genres = [...(value as string[])];
        break;
      case "labels":
        labels = structuredClone(value as MetadataLabelValue[]);
        break;
      case "credits":
        credits = structuredClone(value as MetadataCreditValue[]);
        break;
      case "relations":
        relations = structuredClone(value as MetadataRelationValue[]);
        break;
      default:
        text[field] = value == null ? "" : String(value);
    }
  }

  function addGenre() {
    const name = genreInput.trim().replace(/,$/, "").trim();
    genreInput = "";
    if (!name) return;
    if (genres.some((g) => g.toLowerCase() === name.toLowerCase())) return;
    genres = [...genres, name];
  }

  function handleGenreKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addGenre();
    } else if (e.key === "Backspace" && genreInput === "" && genres.length) {
      genres = genres.slice(0, -1);
    }
  }

  function addLabel(id: string) {
    const label = allLabels.find((l) => l.id === id);
    if (!label) return;
    labels = [...labels, { id, name: label.name, catalog_number: null }];
  }

  function showPreviews(next: MetadataChangePreview[]) {
    previews = next;
    const fills = next.flatMap((p) =>
      p.action === "merge" ? p.manual_fills : [],
    );
    loadArtistNames(filledArtistIds(fills));
  }

  async function review() {
    if (changeSet.length === 0 || invalid) return;
    busy = true;
    error = null;
    notice = null;
    try {
      showPreviews(await previewMetadataChanges(changeSet));
      step = "review";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to check the edit";
    } finally {
      busy = false;
    }
  }

  async function apply() {
    busy = true;
    error = null;
    notice = null;
    try {
      await applyMetadataChanges(withExpected(changeSet, previews));
      saved = true;
      merged = merging;
      await followIds();
    } catch (err) {
      await reviewAgain(err);
    } finally {
      busy = false;
    }
  }

  // Shows what the set does now when something it expected no longer holds.
  async function reviewAgain(failure: unknown) {
    try {
      const next = await staleReview(changeSet, failure);
      if (next) {
        showPreviews(next);
        notice =
          "The metadata no longer matches what you reviewed. These are the changes as they stand now.";
      } else {
        error = failure instanceof Error ? failure.message : "Failed to save";
      }
    } catch (previewErr) {
      step = "edit";
      error =
        previewErr instanceof Error
          ? previewErr.message
          : "Failed to check the edit";
    }
  }

  // Metadata follows the IDs in effect, so a change to them needs a refresh.
  // That takes its own permission; without it, the metadata catches up on the
  // next refresh.
  async function followIds() {
    const changedIds = changeSet.some(
      (c) =>
        c.action === "set_external_id" || c.action === "inherit_external_id",
    );
    if (!changedIds) return finish();
    if (!auth.hasPermission("sync_metadata")) {
      notice = `The ${noun}'s metadata follows the new IDs on its next refresh.`;
      step = "saved";
      return;
    }
    try {
      await refreshEntity(entityId);
      finish();
    } catch (err) {
      notice = `Refreshing the ${noun} failed: ${
        err instanceof Error ? err.message : "unknown error"
      }`;
      step = "saved";
    }
  }

  function finish() {
    if (merged) catalogChanged();
    else if (saved) onchanged?.();
    onclose();
  }

  function artistName(id: string): string {
    return artistNames[id] ?? "Unknown artist";
  }

  function idValueLines(value: string | undefined): string[] {
    if (value == null) return [];
    return [value || "Unmatched"];
  }
</script>

{#snippet removeButton(label: string, onclick: () => void)}
  <button
    type="button"
    class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
    aria-label={label}
    title={label}
    {onclick}
  >
    <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path
        d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
      />
    </svg>
  </button>
{/snippet}

{#snippet resetButton(
  active: boolean,
  title: string,
  label: string,
  onclick: () => void,
)}
  <button
    type="button"
    class="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
    class:text-[#BB7FB5]={active}
    {title}
    aria-label={label}
    {onclick}
  >
    <svg
      class="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5"
      />
    </svg>
  </button>
{/snippet}

{#snippet rowLabel(
  name: string,
  edited: boolean,
  marked: boolean,
  badge: string | null,
)}
  <div
    class="flex h-[2.125rem] flex-wrap content-center items-center gap-x-1.5 gap-y-0.5 text-sm"
    class:text-slate-500={!edited}
    class:dark:text-neutral-400={!edited}
    class:font-medium={edited}
    class:text-slate-900={edited}
    class:dark:text-white={edited}
  >
    <!-- As tall as an input, so the label centers on the control's first
    line. The badge drops to its own line when the label leaves no room,
    and the pair then spreads evenly above and below. -->
    <span class="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
      {#if marked}
        <span
          class="h-1.5 w-1.5 shrink-0 rounded-full bg-[#BB7FB5]"
          aria-hidden="true"
        ></span>
      {/if}
      <span class="truncate" title={name}>{name}</span>
    </span>
    {#if badge}
      <span
        class="rounded bg-[#E6CEE3] px-1.5 text-xs font-normal text-slate-900 dark:bg-[#BB7FB5] dark:text-white"
        >{badge}</span
      >
    {/if}
  </div>
{/snippet}

{#snippet tabBar()}
  <div
    class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs dark:border-neutral-700 dark:bg-[#1b1d1e]"
    role="tablist"
    aria-label="What to edit"
  >
    {#each tabs as option (option.id)}
      {@const active = tab === option.id}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        class="flex items-center gap-1.5 rounded px-3 py-1 font-medium transition-colors"
        class:bg-[#E6CEE3]={active}
        class:text-slate-900={active}
        class:dark:bg-[#BB7FB5]={active}
        class:dark:text-white={active}
        class:text-slate-600={!active && !option.problem}
        class:dark:text-neutral-400={!active && !option.problem}
        class:text-red-600={!active && option.problem}
        class:dark:text-red-400={!active && option.problem}
        onclick={() => (tab = option.id)}
      >
        {option.label}
        {#if option.changed}
          <span
            class="h-1.5 w-1.5 rounded-full bg-[#BB7FB5]"
            class:dark:bg-white={active}
            aria-label="Changed"
          ></span>
        {/if}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet diffRow(
  name: string,
  note: string | null,
  before: string[],
  after: string[],
)}
  <li class="grid grid-cols-[9rem_1fr] gap-x-3 text-sm">
    <span class="break-words text-slate-500 dark:text-neutral-400">{name}</span>
    <div class="min-w-0">
      {#each before as line, i (i)}
        <p
          class="break-words text-slate-400 line-through dark:text-neutral-500"
        >
          {line}
        </p>
      {/each}
      {#each after as line, i (i)}
        <p class="break-words text-slate-900 dark:text-neutral-100">{line}</p>
      {:else}
        <p class="text-slate-900 italic dark:text-neutral-100">Removed</p>
      {/each}
      {#if note}
        <p class="text-xs text-slate-500 dark:text-neutral-400">{note}</p>
      {/if}
    </div>
  </li>
{/snippet}

{#snippet control(field: MetadataFieldName)}
  {@const kind = KINDS[field]}
  {@const disabled = inherit.includes(field)}
  {#if disabled}
    <p
      class="rounded-md border border-dashed border-slate-300 px-2.5 py-1.5 text-sm text-slate-500 italic dark:border-neutral-600 dark:text-neutral-400"
    >
      Will use the value from tags and providers
    </p>
  {:else if kind === "text" || kind === "date"}
    <input
      type="text"
      class={inputClass}
      placeholder={kind === "date" ? "YYYY-MM-DD" : ""}
      bind:value={text[field]}
    />
  {:else if kind === "textarea"}
    <textarea rows="4" class={inputClass} bind:value={text[field]}></textarea>
  {:else if kind === "number"}
    <input
      type="text"
      inputmode="numeric"
      class="{inputClass} max-w-28"
      bind:value={text[field]}
    />
  {:else if kind === "release_type" || kind === "artist_type"}
    <select class="{inputClass} max-w-48" bind:value={text[field]}>
      {#if kind === "release_type"}
        <option value="">Not set</option>
      {/if}
      {#each kind === "release_type" ? RELEASE_TYPES : ARTIST_TYPES as [value, label] (value)}
        <option {value}>{label}</option>
      {/each}
    </select>
  {:else if kind === "genres"}
    <div
      class="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1.5 focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-500 dark:border-neutral-600 dark:bg-[#1b1d1e] dark:focus-within:border-neutral-400 dark:focus-within:ring-neutral-400"
    >
      {#each genres as genre (genre)}
        <span
          class="flex items-center gap-1 rounded bg-slate-100 py-0.5 pr-1 pl-2 text-xs text-slate-700 dark:bg-neutral-700 dark:text-neutral-200"
        >
          {genre}
          <button
            type="button"
            class="rounded text-slate-400 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-white"
            aria-label="Remove {genre}"
            onclick={() => (genres = genres.filter((g) => g !== genre))}
          >
            <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
              />
            </svg>
          </button>
        </span>
      {/each}
      <input
        type="text"
        class="min-w-24 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
        placeholder={genres.length ? "" : "Add a genre…"}
        bind:value={genreInput}
        onkeydown={handleGenreKeydown}
        onblur={addGenre}
      />
    </div>
  {:else if kind === "labels"}
    <div class="space-y-1.5">
      {#each labels as label, i (label.id)}
        <div class="flex items-center gap-2">
          <span
            class="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-neutral-100"
            >{label.name}</span
          >
          <input
            type="text"
            class="{smallInputClass} w-36"
            placeholder="Catalog number"
            bind:value={labels[i].catalog_number}
          />
          {@render removeButton(`Remove ${label.name}`, () => {
            labels = labels.filter((l) => l.id !== label.id);
          })}
        </div>
      {/each}
      <select
        class="w-full rounded-md border border-dashed border-slate-300 bg-transparent px-2 py-1.5 text-sm text-slate-500 focus:border-slate-500 focus:outline-none dark:border-neutral-600 dark:text-neutral-400"
        value=""
        onchange={(e) => {
          addLabel(e.currentTarget.value);
          e.currentTarget.value = "";
        }}
      >
        <option value="" disabled>Add a label…</option>
        {#each allLabels.filter((l) => !labels.some((x) => x.id === l.id)) as option (option.id)}
          <option value={option.id}>{option.name}</option>
        {/each}
      </select>
    </div>
  {:else if kind === "credits"}
    <div class="space-y-1.5">
      {#each credits as credit, i (i)}
        <div class="flex items-center gap-2">
          <span
            class="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-neutral-100"
            title={artistName(credit.artist_id)}
            >{artistName(credit.artist_id)}</span
          >
          <select class="{smallInputClass} w-36" bind:value={credits[i].type}>
            {#each CREDIT_TYPES as [value, label] (value)}
              <option {value}>{label}</option>
            {/each}
          </select>
          <input
            type="text"
            class="{smallInputClass} w-32"
            placeholder="Detail"
            bind:value={credits[i].detail}
          />
          {@render removeButton(
            `Remove ${artistName(credit.artist_id)}`,
            () => {
              credits = credits.filter((_, j) => j !== i);
            },
          )}
        </div>
      {/each}
      <ArtistPicker
        placeholder="Credit an artist…"
        onpick={(artist) => {
          artistNames[artist.id] = artist.name;
          credits = [
            ...credits,
            { artist_id: artist.id, type: "artist", detail: null },
          ];
        }}
      />
    </div>
  {:else if kind === "relations"}
    <div class="space-y-1.5">
      {#each relations as relation, i (i)}
        <div class="flex items-center gap-2">
          <span
            class="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-neutral-100"
            >{artistName(relation.artist_id)}</span
          >
          <select class="{smallInputClass} w-32" bind:value={relations[i].type}>
            {#each RELATION_TYPES as [value, label] (value)}
              <option {value}>{label}</option>
            {/each}
          </select>
          <input
            type="text"
            class="{smallInputClass} w-32"
            placeholder="Attributes"
            bind:value={relations[i].attributes}
          />
          {@render removeButton(
            `Remove ${artistName(relation.artist_id)}`,
            () => {
              relations = relations.filter((_, j) => j !== i);
            },
          )}
        </div>
      {/each}
      <ArtistPicker
        placeholder="Add a member or voice actor…"
        exclude={[entityId]}
        onpick={(artist) => {
          artistNames[artist.id] = artist.name;
          relations = [
            ...relations,
            { artist_id: artist.id, type: "member_of", attributes: null },
          ];
        }}
      />
    </div>
  {/if}
{/snippet}

<Modal
  title="Edit metadata"
  width="wide"
  toolbar={snapshot && step === "edit" ? tabBar : undefined}
  onclose={() => {
    if (!busy) finish();
  }}
>
  {#if loading}
    <p class="text-sm text-slate-500 dark:text-neutral-400">Loading…</p>
  {:else if snapshot && step === "edit" && tab === "details"}
    <!-- One grid for all rows, so they share column widths. -->
    <div class="grid grid-cols-[8rem_1fr_2rem] items-start gap-x-3 gap-y-3">
      {#each fields as field (field)}
        {@const edited = isEdited(field)}
        {@const problem = fieldError(field)}
        <div class="contents">
          {@render rowLabel(
            NAMES[field],
            edited,
            edited || inherit.includes(field),
            isManual(field) && !inherit.includes(field) ? "Manual" : null,
          )}
          <div class="min-w-0">
            {@render control(field)}
            {#if problem}
              <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                {problem}
              </p>
            {/if}
          </div>
          <div class="pt-0.5">
            {#if isManual(field)}
              {@render resetButton(
                inherit.includes(field),
                inherit.includes(field)
                  ? "Keep the manual value"
                  : "Drop the manual value and use tags and providers",
                inherit.includes(field)
                  ? `Keep the manual ${NAMES[field].toLowerCase()}`
                  : `Reset ${NAMES[field].toLowerCase()}`,
                () => toggleInherit(field),
              )}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else if snapshot && step === "edit" && tab === "ids"}
    {#if ids.length === 0}
      <p class="text-sm text-slate-500 dark:text-neutral-400">
        This {noun} has no external IDs.
      </p>
    {/if}
    <div class="grid grid-cols-[8rem_1fr_2rem] items-start gap-x-3 gap-y-3">
      {#each idGroups as group (group.providerId)}
        <h4
          class="col-span-full -mb-1 text-sm font-medium text-slate-700 dark:text-neutral-200"
        >
          {group.displayName}
        </h4>
        {#each group.ids as id (idKey(id))}
          {@const key = idKey(id)}
          {@const inherited = inheritedIds.includes(key)}
          {@const dropped = droppedAliases.includes(key)}
          {@const edited = isIdEdited(id)}
          {@const problem = idError(id)}
          <div class="contents">
            {@render rowLabel(
              id.id_type,
              edited,
              edited || inherited,
              id.source === "alias"
                ? "Alias"
                : id.source === "manual" && !inherited
                  ? "Manual"
                  : null,
            )}
            <div class="min-w-0">
              {#if id.source === "alias"}
                <p
                  class="px-2.5 py-1.5 font-mono text-xs break-all text-slate-900 dark:text-neutral-100"
                  class:line-through={dropped}
                  title="Kept from a merged duplicate; it still finds this {noun}"
                >
                  {id.id_value}
                </p>
                {#if dropped}
                  <p
                    class="px-2.5 text-xs text-slate-400 dark:text-neutral-500"
                  >
                    Will stop finding this {noun}
                  </p>
                {/if}
              {:else if inherited}
                <p
                  class="rounded-md border border-dashed border-slate-300 px-2.5 py-1.5 text-sm text-slate-500 italic dark:border-neutral-600 dark:text-neutral-400"
                >
                  {id.resolved_value != null
                    ? "Will use the provider's value"
                    : "Will be removed; the provider has none"}
                </p>
              {:else}
                <input
                  type="text"
                  aria-label="{group.displayName} {id.id_type}"
                  class="{inputClass} font-mono !text-xs"
                  placeholder={id.id_value === "" ? "Unmatched" : ""}
                  bind:value={idDrafts[key]}
                />
              {/if}
              {#if problem}
                <p class="mt-1 text-xs text-red-600 dark:text-red-400">
                  {problem}
                </p>
              {/if}
              {#if id.source !== "alias" && (id.resolved_value != null || edited)}
                <p
                  class="mt-1 font-mono text-xs break-all text-slate-400 dark:text-neutral-500"
                >
                  Provider: {(id.resolved_value ?? id.id_value) || "Unmatched"}
                </p>
              {/if}
            </div>
            <div class="pt-0.5">
              {#if id.source === "manual"}
                {@render resetButton(
                  inherited,
                  inherited
                    ? "Keep the manual ID"
                    : id.resolved_value != null
                      ? "Drop the manual ID and use the provider's"
                      : "Drop the manual ID; the provider has none",
                  inherited
                    ? `Keep the manual ${id.id_type}`
                    : `Reset ${id.id_type}`,
                  () => toggleInheritId(id),
                )}
              {:else if id.source === "alias"}
                {#if dropped}
                  {@render resetButton(
                    true,
                    "Keep this alias",
                    `Keep the ${id.id_type} alias`,
                    () => toggleAlias(id),
                  )}
                {:else}
                  {@render removeButton(`Remove the ${id.id_type} alias`, () =>
                    toggleAlias(id),
                  )}
                {/if}
              {/if}
            </div>
          </div>
        {/each}
      {/each}
    </div>
  {:else if snapshot && step === "edit"}
    <div class="space-y-2">
      <p class="text-sm text-slate-500 dark:text-neutral-400">
        Duplicates added here merge into this {noun} and are deleted.
      </p>
      {#each losers as loser (loser.id)}
        <div class="flex items-center gap-2">
          <span
            class="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-neutral-100"
            title={loser.name}>{loser.name}</span
          >
          {@render removeButton(`Keep ${loser.name}`, () => {
            losers = losers.filter((l) => l.id !== loser.id);
          })}
        </div>
      {/each}
      {#if snapshot.entity_type === "release"}
        <ReleasePicker
          placeholder="Find a duplicate album…"
          exclude={[entityId, ...losers.map((l) => l.id)]}
          onpick={(release) => {
            losers = [
              ...losers,
              { id: release.id, name: releaseName(release) },
            ];
          }}
        />
      {:else}
        <ArtistPicker
          placeholder="Find a duplicate artist…"
          exclude={[entityId, ...losers.map((l) => l.id)]}
          onpick={(artist) => {
            losers = [...losers, { id: artist.id, name: artist.name }];
          }}
        />
      {/if}
    </div>
  {:else if snapshot && step === "review"}
    {#if notice}
      <p class="text-sm font-medium text-slate-900 dark:text-neutral-100">
        {notice}
      </p>
    {/if}
    <ul class="space-y-3">
      {#each previews as preview, i (i)}
        {#if preview.action === "edit_metadata"}
          {#each preview.diff as entry (entry.field)}
            {@const unchanged =
              JSON.stringify(entry.before.value) ===
              JSON.stringify(entry.after.value)}
            {@render diffRow(
              NAMES[entry.field],
              sourceNote(entry, unchanged),
              unchanged
                ? []
                : describeField(entry.field, entry.before.value, artistName),
              describeField(entry.field, entry.after.value, artistName),
            )}
          {/each}
        {:else if preview.action === "set_external_id"}
          {@render diffRow(
            `${providerName(preview.provider_id)} ${preview.id_type}`,
            null,
            idValueLines(preview.current?.id_value),
            [preview.id_value],
          )}
        {:else if preview.action === "inherit_external_id"}
          {@render diffRow(
            `${providerName(preview.provider_id)} ${preview.id_type}`,
            "Back to the provider",
            idValueLines(preview.current.id_value),
            idValueLines(preview.current.resolved_value),
          )}
        {:else if preview.action === "remove_external_id_alias"}
          {@render diffRow(
            `${providerName(preview.provider_id)} ${preview.id_type}`,
            "Alias",
            [preview.id_value],
            [],
          )}
        {:else if preview.action === "merge"}
          <li>
            <MergeReview
              {preview}
              names={Object.fromEntries(losers.map((l) => [l.id, l.name]))}
              {artistName}
              {providerName}
            />
          </li>
        {/if}
      {/each}
    </ul>
  {:else if step === "saved"}
    <p class="text-sm text-slate-900 dark:text-neutral-100">
      Your changes are saved.
    </p>
    {#if notice}
      <p class="text-sm text-slate-600 dark:text-neutral-300">{notice}</p>
    {/if}
  {/if}
  {#if error}
    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}

  {#snippet footer()}
    {#if step === "edit"}
      <button
        type="button"
        class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
        onclick={onclose}
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={busy || changeSet.length === 0 || invalid}
        class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
        onclick={review}
      >
        {busy
          ? "Checking…"
          : changeCount === 0
            ? "Review changes"
            : `Review ${changeCount} ${changeCount === 1 ? "change" : "changes"}`}
      </button>
    {:else if step === "review"}
      <button
        type="button"
        disabled={busy}
        class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
        onclick={() => {
          step = "edit";
          notice = null;
        }}
      >
        Back
      </button>
      <button
        type="button"
        disabled={busy}
        class={merging
          ? "rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
          : "rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"}
        onclick={apply}
      >
        {busy ? "Saving…" : merging ? "Merge" : "Save"}
      </button>
    {:else}
      <button
        type="button"
        class="rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
        onclick={finish}
      >
        Close
      </button>
    {/if}
  {/snippet}
</Modal>
