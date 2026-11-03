<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script module lang="ts">
  import type {
    ArtistRelationType,
    ArtistType,
    CreditType,
    MetadataEntityType,
    MetadataFieldName,
    ReleaseType,
  } from "./types";

  type FieldKind =
    | "text"
    | "textarea"
    | "date"
    | "number"
    | "release_type"
    | "artist_type"
    | "genres"
    | "labels"
    | "credits"
    | "relations";

  const KINDS: Record<MetadataFieldName, FieldKind> = {
    release_title: "text",
    track_title: "text",
    artist_name: "text",
    sort_title: "text",
    sort_name: "text",
    description: "textarea",
    release_type: "release_type",
    artist_type: "artist_type",
    release_date: "date",
    year: "number",
    disc: "number",
    disc_total: "number",
    track: "number",
    track_total: "number",
    genres: "genres",
    labels: "labels",
    credits: "credits",
    relations: "relations",
  };

  const NAMES: Record<MetadataFieldName, string> = {
    release_title: "Title",
    track_title: "Title",
    artist_name: "Name",
    sort_title: "Sort title",
    sort_name: "Sort name",
    description: "Description",
    release_type: "Type",
    artist_type: "Type",
    release_date: "Release date",
    year: "Year",
    disc: "Disc",
    disc_total: "Disc total",
    track: "Track",
    track_total: "Track total",
    genres: "Genres",
    labels: "Labels",
    credits: "Credits",
    relations: "Related artists",
  };

  // Fields that must keep a value.
  const REQUIRED: MetadataFieldName[] = [
    "release_title",
    "track_title",
    "artist_name",
  ];

  const ORDER: Record<MetadataEntityType, MetadataFieldName[]> = {
    release: [
      "release_title",
      "sort_title",
      "release_type",
      "release_date",
      "description",
      "genres",
      "labels",
      "credits",
    ],
    track: [
      "track_title",
      "sort_title",
      "year",
      "disc",
      "disc_total",
      "track",
      "track_total",
      "credits",
    ],
    artist: [
      "artist_name",
      "sort_name",
      "artist_type",
      "description",
      "relations",
    ],
  };

  const RELEASE_TYPES: [ReleaseType, string][] = [
    ["album", "Album"],
    ["single", "Single"],
    ["ep", "EP"],
    ["compilation", "Compilation"],
    ["soundtrack", "Soundtrack"],
    ["live", "Live"],
    ["remix", "Remix"],
    ["broadcast", "Broadcast"],
    ["other", "Other"],
    ["unknown", "Unknown"],
  ];

  const ARTIST_TYPES: [ArtistType, string][] = [
    ["person", "Person"],
    ["group", "Group"],
    ["character", "Character"],
    ["orchestra", "Orchestra"],
    ["choir", "Choir"],
  ];

  const CREDIT_TYPES: [CreditType, string][] = [
    ["artist", "Artist"],
    ["vocalist", "Vocalist"],
    ["instrumentalist", "Instrumentalist"],
    ["composer", "Composer"],
    ["lyricist", "Lyricist"],
    ["arranger", "Arranger"],
    ["writer", "Writer"],
    ["producer", "Producer"],
    ["conductor", "Conductor"],
    ["engineer", "Engineer"],
    ["mixer", "Mixer"],
    ["remixer", "Remixer"],
  ];

  // Relations point into the edited artist, so each names the related artist's
  // role toward it.
  const RELATION_TYPES: [ArtistRelationType, string][] = [
    ["member_of", "Member"],
    ["voice_actor", "Voice actor"],
  ];

  function optionLabel<T extends string>(
    options: [T, string][],
    value: unknown,
  ): string {
    return options.find(([v]) => v === value)?.[1] ?? String(value);
  }
</script>

<script lang="ts">
  import {
    ApiError,
    applyEntityMetadata,
    fetchArtistSummary,
    fetchEntityMetadata,
    fetchLabels,
    previewEntityMetadata,
  } from "./api";
  import type {
    LabelResponse,
    MetadataChange,
    MetadataCreditValue,
    MetadataFieldDiff,
    MetadataLabelValue,
    MetadataRelationValue,
    MetadataSnapshot,
  } from "./types";
  import ArtistPicker from "./ArtistPicker.svelte";
  import Modal from "./Modal.svelte";

  interface Props {
    entityId: string;
    onclose: () => void;
    // Called with the saved metadata after an edit applies.
    onsaved?: (snapshot: MetadataSnapshot) => void;
  }

  let { entityId, onclose, onsaved }: Props = $props();

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none disabled:opacity-50 dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400 dark:focus:ring-neutral-400";
  const smallInputClass =
    "min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400";

  let snapshot = $state<MetadataSnapshot | null>(null);
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

  let step = $state<"edit" | "review">("edit");
  let diff = $state<MetadataFieldDiff[]>([]);
  let busy = $state(false);
  let notice = $state<string | null>(null);

  let fields = $derived(
    snapshot
      ? ORDER[snapshot.entity_type].filter((f) => snapshot!.fields[f])
      : [],
  );

  $effect(() => {
    load(entityId);
  });

  async function load(id: string) {
    loading = true;
    error = null;
    try {
      const loaded = await fetchEntityMetadata(id);
      snapshot = loaded;
      reset(loaded);
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

  // The value an edit would send, in the form the server compares.
  function draftValue(field: MetadataFieldName): unknown {
    switch (KINDS[field]) {
      case "number": {
        const t = trimmed(text[field]);
        return t == null ? null : Number(t);
      }
      case "genres":
        return genres;
      case "labels":
        return labels.map((l) => ({
          id: l.id,
          catalog_number: trimmed(l.catalog_number),
        }));
      case "credits":
        return credits.map((c) => ({
          artist_id: c.artist_id,
          type: c.type,
          detail: trimmed(c.detail),
        }));
      case "relations":
        return relations.map((r) => ({
          artist_id: r.artist_id,
          type: r.type,
          attributes: trimmed(r.attributes),
        }));
      default:
        return trimmed(text[field]);
    }
  }

  function loadedValue(field: MetadataFieldName): unknown {
    const value = snapshot?.fields[field]?.value ?? null;
    if (KINDS[field] === "labels") {
      return (value as MetadataLabelValue[]).map((l) => ({
        id: l.id,
        catalog_number: l.catalog_number,
      }));
    }
    return value;
  }

  function isEdited(field: MetadataFieldName): boolean {
    return (
      !inherit.includes(field) &&
      JSON.stringify(draftValue(field)) !== JSON.stringify(loadedValue(field))
    );
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

  let changes = $derived.by((): MetadataChange[] =>
    fields.flatMap((field): MetadataChange[] => {
      if (inherit.includes(field)) return [{ field, operation: "inherit" }];
      if (!isEdited(field)) return [];
      return [{ field, operation: "set", value: draftValue(field) }];
    }),
  );

  let invalid = $derived(fields.some((f) => fieldError(f) != null));

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

  async function review() {
    if (changes.length === 0 || invalid) return;
    busy = true;
    error = null;
    notice = null;
    try {
      diff = await previewEntityMetadata(entityId, changes);
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
      const saved = await applyEntityMetadata(entityId, changes, diff);
      onsaved?.(saved);
      onclose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Someone else changed the metadata; show what this edit does now.
        try {
          diff = await previewEntityMetadata(entityId, changes);
          notice =
            "The metadata changed while you were reviewing. These are the changes as they stand now.";
        } catch (previewErr) {
          step = "edit";
          error =
            previewErr instanceof Error
              ? previewErr.message
              : "Failed to check the edit";
        }
      } else {
        error = err instanceof Error ? err.message : "Failed to save";
      }
    } finally {
      busy = false;
    }
  }

  function artistName(id: string): string {
    return artistNames[id] ?? "Unknown artist";
  }

  // A readable form of a field value for the review step.
  function describe(field: MetadataFieldName, value: unknown): string[] {
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      return [];
    }
    switch (KINDS[field]) {
      case "release_type":
        return [optionLabel(RELEASE_TYPES, value)];
      case "artist_type":
        return [optionLabel(ARTIST_TYPES, value)];
      case "genres":
        return [(value as string[]).join(", ")];
      case "labels":
        return (value as MetadataLabelValue[]).map((l) =>
          l.catalog_number ? `${l.name} · ${l.catalog_number}` : l.name,
        );
      case "credits":
        return (value as MetadataCreditValue[]).map(
          (c) =>
            `${artistName(c.artist_id)} · ${optionLabel(CREDIT_TYPES, c.type)}${c.detail ? ` (${c.detail})` : ""}`,
        );
      case "relations":
        return (value as MetadataRelationValue[]).map(
          (r) =>
            `${artistName(r.artist_id)} · ${optionLabel(RELATION_TYPES, r.type)}${r.attributes ? ` (${r.attributes})` : ""}`,
        );
      default:
        return [String(value)];
    }
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
  onclose={() => {
    if (!busy) onclose();
  }}
>
  {#if loading}
    <p class="text-sm text-slate-500 dark:text-neutral-400">Loading…</p>
  {:else if snapshot && step === "edit"}
    <!-- One grid for all rows, so they share column widths. -->
    <div class="grid grid-cols-[8rem_1fr_2rem] items-start gap-x-3 gap-y-3">
      {#each fields as field (field)}
        {@const edited = isEdited(field)}
        {@const problem = fieldError(field)}
        <div class="contents">
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
            <span class="flex items-center gap-1.5 whitespace-nowrap">
              {#if edited || inherit.includes(field)}
                <span
                  class="h-1.5 w-1.5 shrink-0 rounded-full bg-[#BB7FB5]"
                  aria-hidden="true"
                ></span>
              {/if}
              {NAMES[field]}
            </span>
            {#if isManual(field) && !inherit.includes(field)}
              <span
                class="rounded bg-[#E6CEE3] px-1.5 text-xs font-normal text-slate-900 dark:bg-[#BB7FB5] dark:text-white"
                >Manual</span
              >
            {/if}
          </div>
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
              <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                class:text-[#BB7FB5]={inherit.includes(field)}
                title={inherit.includes(field)
                  ? "Keep the manual value"
                  : "Drop the manual value and use tags and providers"}
                aria-label={inherit.includes(field)
                  ? `Keep the manual ${NAMES[field].toLowerCase()}`
                  : `Reset ${NAMES[field].toLowerCase()}`}
                onclick={() => toggleInherit(field)}
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
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else if snapshot && step === "review"}
    {#if notice}
      <p
        class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
      >
        {notice}
      </p>
    {/if}
    <ul class="space-y-3">
      {#each diff as entry (entry.field)}
        {@const before = describe(entry.field, entry.before.value)}
        {@const after = describe(entry.field, entry.after.value)}
        <li class="text-sm">
          <div class="flex items-center gap-2">
            <span class="font-medium text-slate-900 dark:text-neutral-100"
              >{NAMES[entry.field]}</span
            >
            {#if entry.before.source !== entry.after.source}
              <span class="text-xs text-slate-500 dark:text-neutral-400">
                {entry.after.source === "manual"
                  ? "becomes manual"
                  : "back to tags and providers"}
              </span>
            {/if}
          </div>
          <div class="mt-1 grid grid-cols-[1fr_auto_1fr] gap-2">
            <div
              class="rounded bg-slate-50 px-2 py-1 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400"
            >
              {#each before as line, i (i)}<p class="break-words">
                  {line}
                </p>{:else}<p class="italic">Empty</p>{/each}
            </div>
            <span class="pt-1 text-slate-400 dark:text-neutral-500">→</span>
            <div
              class="rounded bg-[#E6CEE3]/40 px-2 py-1 text-slate-900 dark:bg-[#BB7FB5]/20 dark:text-neutral-100"
            >
              {#each after as line, i (i)}<p class="break-words">
                  {line}
                </p>{:else}<p class="italic">Empty</p>{/each}
            </div>
          </div>
        </li>
      {/each}
    </ul>
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
        disabled={busy || changes.length === 0 || invalid}
        class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
        onclick={review}
      >
        {busy
          ? "Checking…"
          : changes.length === 0
            ? "Review changes"
            : `Review ${changes.length} ${changes.length === 1 ? "change" : "changes"}`}
      </button>
    {:else}
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
        disabled={busy || diff.length === 0}
        class="rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
        onclick={apply}
      >
        {busy ? "Saving…" : "Save"}
      </button>
    {/if}
  {/snippet}
</Modal>
