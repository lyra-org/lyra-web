<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import { onMount } from "svelte";
  import {
    ApiError,
    fetchServerSettings,
    updateServerSettings,
    resetServerSettings,
  } from "./api";
  import type {
    ServerSettingsResponse,
    ServerSettingField,
    ServerSettingValue,
  } from "./types";

  let { dirty = $bindable(false), busy = $bindable(false) } = $props<{
    dirty?: boolean;
    busy?: boolean;
  }>();
  let settings = $state<ServerSettingsResponse | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);
  let drafts = $state<Record<string, string | boolean>>({});
  let resets = $state<Record<string, boolean>>({});
  let changed = $derived(
    settings?.groups
      .flatMap((group) => group.fields)
      .filter(
        (field) =>
          !field.locked &&
          (resets[field.key] ||
            drafts[field.key] !== displayValue(field.value, field.type)),
      ) ?? [],
  );
  $effect(() => {
    dirty = changed.length > 0;
  });

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-[#BB7FB5] focus:outline-none disabled:opacity-50 dark:border-neutral-600 dark:bg-[#1b1d1e] dark:text-neutral-100";

  function displayValue(
    value: ServerSettingValue,
    type: ServerSettingField["type"],
  ): string | boolean {
    if (type === "bool") return value === true;
    if (Array.isArray(value)) return value.join("\n");
    return value == null ? "" : String(value);
  }

  function apply(response: ServerSettingsResponse) {
    settings = response;
    drafts = Object.fromEntries(
      response.groups.flatMap((group) =>
        group.fields.map((field) => [
          field.key,
          displayValue(field.value, field.type),
        ]),
      ),
    );
    resets = {};
  }

  function edit(field: ServerSettingField, value: string | boolean) {
    drafts[field.key] = value;
    resets[field.key] = false;
    error = null;
    message = null;
  }

  function resetField(field: ServerSettingField) {
    drafts[field.key] = displayValue(field.default, field.type);
    resets[field.key] = true;
    error = null;
    message = null;
  }

  async function load() {
    loading = true;
    error = null;
    try {
      apply(await fetchServerSettings());
    } catch {
      error =
        "Unable to load server settings. Check your connection and permissions, then retry.";
    } finally {
      loading = false;
    }
  }

  function valueFor(field: ServerSettingField): ServerSettingValue {
    if (resets[field.key]) return null;
    const value = drafts[field.key];
    if (field.type === "bool") return value === true;
    const text = String(value);
    if (field.type === "string_list")
      return text
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    if (field.type === "number") {
      if (!text.trim() && !field.required) return null;
      const number = Number(text);
      if (
        !text.trim() ||
        !Number.isSafeInteger(number) ||
        number < field.min ||
        (field.max != null && number > field.max)
      ) {
        throw new Error(
          `${field.label}: enter a whole number from ${field.min} to ${Math.min(field.max ?? Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)}.`,
        );
      }
      return number;
    }
    if (!text && !field.required) return null;
    if (!text.trim() && field.required)
      throw new Error(`${field.label} is required.`);
    return text;
  }

  function failure(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 409)
        return "A changed setting is now locked by config.json. Reload settings before trying again.";
      if (err.status === 400)
        return "The server rejected these values. Check the field descriptions and try again.";
      if (err.status === 403)
        return "You need a signed-in session with permission to manage server settings.";
    }
    return err instanceof Error
      ? err.message
      : "Unable to update server settings.";
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !changed.length) return;
    error = null;
    message = null;
    busy = true;
    try {
      const values = Object.fromEntries(
        changed.map((field) => [field.key, valueFor(field)]),
      );
      apply(await updateServerSettings(values));
      message = "Server settings saved.";
    } catch (err) {
      error = failure(err);
    } finally {
      busy = false;
    }
  }

  async function resetAll() {
    if (
      busy ||
      !confirm(
        "Reset all stored server settings? Values from config.json will remain in effect; other settings will use their defaults.",
      )
    )
      return;
    busy = true;
    error = null;
    message = null;
    try {
      apply(await resetServerSettings());
      message = "Stored server settings reset.";
    } catch (err) {
      error = failure(err);
    } finally {
      busy = false;
    }
  }

  function discard() {
    if (busy || !settings) return;
    apply(settings);
    error = null;
    message = null;
  }

  onMount(load);
</script>

<div class="px-6 pt-5 pb-1">
  <h3 class="text-base font-semibold text-slate-900 dark:text-neutral-100">
    Server
  </h3>
</div>
{#if loading}
  <p role="status" class="px-6 py-5 text-sm">Loading server settings…</p>
{:else if !settings}
  <div class="space-y-3 px-6 py-5">
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">{error}</p>
    <button type="button" onclick={load} class="text-sm underline">Retry</button
    >
  </div>
{:else}
  <form class="flex min-h-0 flex-1 flex-col" onsubmit={save}>
    <div class="flex-1 space-y-7 overflow-y-auto px-6 py-5">
      {#if settings.pending_restart.length}
        <div
          role="status"
          class="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <p class="font-medium">Restart the server to apply these changes:</p>
          <ul class="mt-1 list-inside list-disc">
            {#each settings.pending_restart as key}
              <li>
                {settings.groups
                  .flatMap((group) => group.fields)
                  .find((field) => field.key === key)?.label ?? key}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
      {#each settings.groups as group (group.id)}
        {@const groupNeedsRestart =
          group.fields.length > 0 &&
          group.fields.every((field) => field.restart_required)}
        <fieldset class="space-y-5" disabled={busy}>
          <legend
            class="mb-3 text-sm font-semibold"
            class:sr-only={group.id === "server"}
          >
            {group.label}
            {#if groupNeedsRestart}<span
                class="ml-2 text-xs font-normal text-slate-500 dark:text-neutral-400"
                >Requires restart</span
              >{/if}
          </legend>
          {#each group.fields as field (field.key)}
            {@const id = `server-setting-${field.key}`}
            <div class="max-w-xl space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  {#if field.type === "bool"}
                    <input
                      {id}
                      type="checkbox"
                      checked={drafts[field.key] === true}
                      disabled={field.locked}
                      onchange={(event) =>
                        edit(field, event.currentTarget.checked)}
                      aria-describedby={`${id}-description`}
                      class="h-4 w-4 accent-[#BB7FB5] disabled:opacity-50"
                    />
                  {/if}
                  <label
                    for={id}
                    class="text-sm font-medium text-slate-800 dark:text-neutral-200"
                    >{field.label}</label
                  >
                </div>
                <div
                  class="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-neutral-400"
                >
                  {#if field.locked}<span>Locked by config.json</span>{/if}
                  {#if resets[field.key]}<span>Reset pending</span>{/if}
                  {#if field.restart_required && !groupNeedsRestart}<span
                      >Requires restart</span
                    >{/if}
                  {#if !field.locked && !resets[field.key] && (field.source === "database" || drafts[field.key] !== displayValue(field.value, field.type))}
                    <button
                      type="button"
                      onclick={() => resetField(field)}
                      disabled={busy}
                      class="underline disabled:opacity-40">Use default</button
                    >
                  {/if}
                </div>
              </div>
              {#if field.type === "string_list"}
                <textarea
                  {id}
                  rows={3}
                  value={String(drafts[field.key] ?? "")}
                  disabled={field.locked}
                  oninput={(event) => edit(field, event.currentTarget.value)}
                  aria-describedby={`${id}-description`}
                  class={inputClass}></textarea>
              {:else if field.type !== "bool"}
                <input
                  {id}
                  type="text"
                  inputmode={field.type === "number" ? "numeric" : "text"}
                  value={String(drafts[field.key] ?? "")}
                  required={field.required && !resets[field.key]}
                  disabled={field.locked}
                  oninput={(event) => edit(field, event.currentTarget.value)}
                  aria-describedby={`${id}-description`}
                  class={inputClass}
                />
              {/if}
              <p
                id={`${id}-description`}
                class="text-xs text-slate-500 dark:text-neutral-400"
              >
                {field.description}{field.type === "string_list"
                  ? " One entry per line."
                  : ""}
              </p>
            </div>
          {/each}
        </fieldset>
      {/each}
      <details class="text-sm">
        <summary
          class="cursor-pointer font-medium text-slate-600 dark:text-neutral-400"
          >Advanced</summary
        >
        <dl
          class="mt-3 space-y-2 break-all text-slate-600 dark:text-neutral-300"
        >
          <div>
            <dt>Port</dt>
            <dd>{settings.boot.port}</dd>
          </div>
          <div>
            <dt>Data directory</dt>
            <dd>{settings.boot.data_dir}</dd>
          </div>
          <div>
            <dt>Database</dt>
            <dd>{settings.boot.db.kind} · {settings.boot.db.path}</dd>
          </div>
        </dl>
        <div class="mt-4">
          <button
            type="button"
            onclick={resetAll}
            disabled={busy}
            class="text-sm text-red-600 disabled:opacity-50 dark:text-red-400"
            >Reset all</button
          >
        </div>
      </details>
    </div>
    <div
      class="space-y-3 border-t border-slate-200 px-6 py-4 dark:border-neutral-800"
    >
      {#if error}<p role="alert" class="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>{/if}
      {#if message}<p
          role="status"
          class="text-sm text-green-700 dark:text-green-400"
        >
          {message}
        </p>{/if}
      <div class="flex flex-wrap items-center gap-3">
        <div class="ml-auto flex gap-2">
          {#if dirty}
            <button
              type="button"
              onclick={discard}
              disabled={busy || !dirty}
              class="rounded-md px-3 py-2 text-sm disabled:opacity-50"
              >Discard</button
            >
          {/if}
          <button
            type="submit"
            disabled={busy || !dirty}
            class="rounded-md bg-[#E6CEE3] px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50 dark:bg-[#BB7FB5] dark:text-white"
            >{busy ? "Applying…" : "Save"}</button
          >
        </div>
      </div>
    </div>
  </form>
{/if}
