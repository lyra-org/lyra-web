<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import AlbumPage from "./lib/AlbumPage.svelte";
  import ArtistPage from "./lib/ArtistPage.svelte";
  import GenrePage from "./lib/GenrePage.svelte";
  import TrackPage from "./lib/TrackPage.svelte";
  import LibraryArtists from "./lib/LibraryArtists.svelte";
  import LibraryGenres from "./lib/LibraryGenres.svelte";
  import LibraryTracks from "./lib/LibraryTracks.svelte";
  import LibraryList from "./lib/LibraryList.svelte";
  import LibraryAlbums from "./lib/LibraryAlbums.svelte";
  import LoginPage from "./lib/LoginPage.svelte";
  import RegisterPage from "./lib/RegisterPage.svelte";
  import PluginSetupPage from "./lib/PluginSetupPage.svelte";
  import PlaylistList from "./lib/PlaylistList.svelte";
  import PlaylistPage from "./lib/PlaylistPage.svelte";
  import NowPlayingPage from "./lib/NowPlayingPage.svelte";
  import Player from "./lib/Player.svelte";
  import SettingsPanel from "./lib/SettingsPanel.svelte";
  import DevicesPanel from "./lib/DevicesPanel.svelte";
  import DeviceIcon from "./lib/DeviceIcon.svelte";
  import SearchNav from "./lib/SearchNav.svelte";
  import SearchResults from "./lib/SearchResults.svelte";
  import { onMount, untrack } from "svelte";
  import { getAuth } from "./lib/auth.svelte.ts";
  import { catalogRevision } from "./lib/catalog.svelte.ts";
  import { getSetup } from "./lib/setup.svelte.ts";
  import { getPluginUpdates } from "./lib/pluginUpdates.svelte.ts";
  import { getPlayer } from "./lib/player.svelte.ts";
  import { getTheme } from "./lib/theme.svelte.ts";
  import {
    connect as wsConnect,
    disconnect as wsDisconnect,
  } from "./lib/ws.svelte.ts";
  import { getDevices } from "./lib/devices.svelte.ts";
  import { endSession } from "./lib/api";
  import MixButton from "./lib/MixButton.svelte";
  import HeaderMixMenu from "./lib/HeaderMixMenu.svelte";
  import ContextMenu, {
    anchorBelow,
    type MenuAnchor,
  } from "./lib/ContextMenu.svelte";
  import MenuItem from "./lib/MenuItem.svelte";
  import { headerMixForRoute } from "./lib/headerMix.svelte.ts";
  import { pushEntry, replaceEntry, restoreScroll } from "./lib/history.ts";
  import logo from "./assets/logo.svg";

  const auth = getAuth();
  const setup = getSetup();
  const pluginUpdates = getPluginUpdates();
  const theme = getTheme();
  const devices = getDevices();
  const player = getPlayer();

  let loggingOut = $state(false);

  async function logOut() {
    if (loggingOut) return;
    loggingOut = true;
    // Send the final playback report while the session is still valid, but
    // don't let a slow server hold up signing out.
    await Promise.race([
      player.stop(),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    await endSession();
    auth.logout();
  }

  $effect(() => {
    if (auth.isLoggedIn) {
      wsConnect();
    } else {
      wsDisconnect();
    }
  });

  $effect(() => {
    const nowPlaying = [player.currentTrack?.title, player.currentArtistNames];
    document.title = nowPlaying.filter(Boolean).join(" - ") || "Lyra";
  });

  let hash = $state(window.location.hash);
  let settingsOpen = $state(false);
  let moreAnchor = $state<MenuAnchor | null>(null);
  let searchQuery = $state("");
  let committedSearchQuery = $state("");

  // Server discovery and onboarding.
  let booted = $state(false);
  let loginUsername = $state("");
  let loginNotice = $state<string | null>(null);

  onMount(() => {
    setup.refresh().finally(() => (booted = true));
  });

  // Load the current user's permissions once per session token. On logout
  // (or a 401 from the API) drop everything tied to the previous session.
  $effect(() => {
    const token = auth.token;
    if (token == null) {
      setup.clearSession();
      pluginUpdates.clear();
      return;
    }
    if (
      setup.meRequestedFor !== token ||
      (setup.meLoadedFor !== token && !setup.meLoading && setup.meError == null)
    ) {
      setup.loadMe();
    }
  });

  // Count the updates the server's daily check held for an admin once the
  // account's permissions are known.
  $effect(() => {
    if (auth.token != null && setup.meLoadedFor === auth.token) {
      void pluginUpdates.load();
    }
  });

  type Screen =
    | "loading"
    | "server_error"
    | "register"
    | "login"
    | "account_error"
    | "plugin_setup"
    | "app";

  let screen = $derived.by((): Screen => {
    if (!booted) return "loading";
    if (setup.info == null) {
      return setup.infoError != null ? "server_error" : "loading";
    }
    if (!auth.isLoggedIn) {
      return setup.accountRequired ? "register" : "login";
    }
    if (setup.meLoadedFor !== auth.token) {
      return setup.meError != null ? "account_error" : "loading";
    }
    if (setup.pluginSelectionRequired && auth.hasPermission("manage_plugins")) {
      return "plugin_setup";
    }
    return "app";
  });

  async function onSignedIn() {
    loginNotice = null;
    loginUsername = "";
    await setup.refresh();
  }

  function onRegisterLoginFailed(username: string, message: string) {
    loginUsername = username;
    loginNotice = `Your account was created, but signing in failed (${message}). Please sign in.`;
    setup.refresh();
  }

  function onAccountExists() {
    loginNotice = "An account already exists on this server. Please sign in.";
    setup.refresh();
  }

  $effect(() => {
    if (!auth.isLoggedIn && devices.panelOpen) {
      devices.closePanel();
    }
  });

  function onHashChange() {
    hash = window.location.hash;
    restoreScroll();
  }

  // Search is its own history entry: opening it pushes one, refining the
  // query replaces it, so Back from a result returns to the same results.
  function openSearch() {
    pushEntry("#/search", { searchOpened: true });
    onHashChange();
  }

  function closeSearch() {
    if (history.state?.searchOpened) history.back();
    else window.location.hash = "#/";
  }

  type Route =
    | { page: "login" }
    | { page: "libraries" }
    | { page: "library"; id: string }
    | { page: "library_artists"; id: string }
    | { page: "library_tracks"; id: string }
    | { page: "library_genres"; id: string }
    | { page: "track"; id: string }
    | { page: "album"; id: string }
    | { page: "artist"; id: string }
    | { page: "genre"; id: string }
    | { page: "playlists" }
    | { page: "playlist"; id: string }
    | { page: "now_playing" }
    | { page: "search"; query: string };

  let route = $derived.by((): Route => {
    if (hash === "#/login") return { page: "login" };

    if (!auth.isLoggedIn) return { page: "login" };

    if (hash === "#/now-playing") return { page: "now_playing" };

    const searchMatch = hash.match(/^#\/search(?:\?(.*))?$/);
    if (searchMatch) {
      const query = new URLSearchParams(searchMatch[1] ?? "").get("q") ?? "";
      return { page: "search", query: query.trim() };
    }

    const libraryArtistsMatch = hash.match(/^#\/libraries\/([^/]+)\/artists$/);
    if (libraryArtistsMatch)
      return { page: "library_artists", id: libraryArtistsMatch[1] };

    const libraryTracksMatch = hash.match(/^#\/libraries\/([^/]+)\/tracks$/);
    if (libraryTracksMatch)
      return { page: "library_tracks", id: libraryTracksMatch[1] };

    const libraryGenresMatch = hash.match(/^#\/libraries\/([^/]+)\/genres$/);
    if (libraryGenresMatch)
      return { page: "library_genres", id: libraryGenresMatch[1] };

    const libraryMatch = hash.match(/^#\/libraries\/([^/]+)$/);
    if (libraryMatch) return { page: "library", id: libraryMatch[1] };

    const albumMatch = hash.match(/^#\/albums\/([^/]+)$/);
    if (albumMatch) return { page: "album", id: albumMatch[1] };

    const trackMatch = hash.match(/^#\/tracks\/([^/]+)$/);
    if (trackMatch) return { page: "track", id: trackMatch[1] };

    const artistMatch = hash.match(/^#\/artists\/([^/]+)$/);
    if (artistMatch) return { page: "artist", id: artistMatch[1] };

    const genreMatch = hash.match(/^#\/genres\/([^/]+)$/);
    if (genreMatch) return { page: "genre", id: genreMatch[1] };

    const playlistMatch = hash.match(/^#\/playlists\/([^/]+)$/);
    if (playlistMatch) return { page: "playlist", id: playlistMatch[1] };

    if (hash === "#/playlists") return { page: "playlists" };

    return { page: "libraries" };
  });

  $effect(() => {
    if (auth.isLoggedIn && route.page === "login") {
      // Replace the entry so Back doesn't return to the login URL.
      window.location.replace("#/");
    }
  });

  let searchOpen = $derived(route.page === "search");

  // Entering a search entry fills the field from its URL; leaving clears it.
  $effect.pre(() => {
    const query = route.page === "search" ? route.query : "";
    untrack(() => {
      if (query === committedSearchQuery && searchQuery.trim() === query)
        return;
      searchQuery = query;
      committedSearchQuery = query;
    });
  });

  // Updating the URL is best-effort: browsers drop history writes past a rate
  // limit, so results follow the committed query rather than the URL. This
  // runs before the results render, so a new query never restores a stale page.
  $effect.pre(() => {
    if (route.page !== "search") return;
    const query = route.query;
    // Wait for the typed query to settle before replacing the entry.
    if (searchQuery.trim() && !committedSearchQuery) return;
    if (committedSearchQuery === query) return;
    replaceEntry(
      committedSearchQuery
        ? `#/search?${new URLSearchParams({ q: committedSearchQuery })}`
        : "#/search",
    );
    hash = window.location.hash;
  });

  let currentLibraryId = $state<string | null>(null);

  $effect(() => {
    if (
      route.page === "library" ||
      route.page === "library_artists" ||
      route.page === "library_tracks" ||
      route.page === "library_genres"
    ) {
      currentLibraryId = route.id;
    }
  });

  let isLibrarySection = $derived(
    route.page === "libraries" ||
      route.page === "library" ||
      route.page === "album",
  );
  let isArtistSection = $derived(
    route.page === "library_artists" || route.page === "artist",
  );
  let isTracksSection = $derived(
    route.page === "library_tracks" || route.page === "track",
  );
  let isGenreSection = $derived(
    route.page === "library_genres" || route.page === "genre",
  );
  let isPlaylistSection = $derived(
    route.page === "playlists" || route.page === "playlist",
  );

  function libraryHref(suffix: string): string {
    return currentLibraryId != null
      ? `#/libraries/${currentLibraryId}${suffix}`
      : "#/";
  }

  let navItems = $derived([
    { label: "Albums", href: libraryHref(""), active: isLibrarySection },
    {
      label: "Artists",
      href: libraryHref("/artists"),
      active: isArtistSection,
    },
    { label: "Tracks", href: libraryHref("/tracks"), active: isTracksSection },
    { label: "Genres", href: libraryHref("/genres"), active: isGenreSection },
    { label: "Playlists", href: "#/playlists", active: isPlaylistSection },
  ]);

  let themeLabel = $derived(
    theme.mode === "system"
      ? "Theme: system (click for light)"
      : theme.mode === "light"
        ? "Theme: light (click for dark)"
        : "Theme: dark (click for system)",
  );

  let headerMix = $derived(
    headerMixForRoute(route, player.currentTrack, player.playbackContext),
  );
</script>

<svelte:window onhashchange={onHashChange} />

{#snippet themeToggle()}
  <button
    type="button"
    aria-label={themeLabel}
    title={themeLabel}
    class="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:h-8 sm:w-8 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
    onclick={() => theme.cycle()}
  >
    {#if theme.mode === "system"}
      <!-- Monitor icon -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="4" width="18" height="12" rx="2" ry="2" />
        <path stroke-linecap="round" d="M8 20h8M12 16v4" />
      </svg>
    {:else if theme.mode === "light"}
      <!-- Sun icon -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          stroke-linecap="round"
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        />
      </svg>
    {:else}
      <!-- Moon icon -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
        />
      </svg>
    {/if}
  </button>
{/snippet}

{#if screen !== "app"}
  <main class="min-h-screen bg-white dark:bg-[#1b1d1e]">
    <div class="absolute top-3 right-3 flex items-center gap-2">
      {@render themeToggle()}
      {#if auth.isLoggedIn}
        <button
          class="text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          disabled={loggingOut}
          onclick={logOut}
        >
          Log out
        </button>
      {/if}
    </div>
    {#if screen === "loading"}
      <div class="flex min-h-screen items-center justify-center">
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-neutral-600 dark:border-t-neutral-300"
        ></div>
      </div>
    {:else if screen === "register"}
      <RegisterPage
        ondone={onSignedIn}
        onloginfailed={onRegisterLoginFailed}
        onaccountexists={onAccountExists}
      />
    {:else if screen === "login"}
      <LoginPage
        initialUsername={loginUsername}
        notice={loginNotice}
        ondone={onSignedIn}
      />
    {:else if screen === "server_error" || screen === "account_error"}
      <div class="flex min-h-screen items-center justify-center px-4">
        <div class="w-full max-w-sm text-center">
          <p role="alert" class="text-sm text-red-600 dark:text-red-400">
            {#if screen === "server_error"}
              Couldn't reach the server: {setup.infoError}
            {:else}
              Couldn't load your account: {setup.meError}
            {/if}
          </p>
          <button
            type="button"
            class="mt-4 rounded-md bg-[#E6CEE3] px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-[#d4b5cf] dark:bg-[#BB7FB5] dark:text-white dark:hover:bg-[#cfa2c9]"
            onclick={() =>
              screen === "server_error" ? setup.refresh() : setup.loadMe()}
          >
            Retry
          </button>
        </div>
      </div>
    {:else if screen === "plugin_setup"}
      <PluginSetupPage
        ondone={async () => {
          await setup.refresh();
        }}
      />
    {/if}
  </main>
{:else}
  <main class="min-h-screen bg-white dark:bg-[#1b1d1e]">
    <header
      class="relative flex flex-wrap items-center gap-x-2 gap-y-1 bg-slate-50 px-4 py-2 sm:gap-4 sm:px-6 sm:py-4 dark:bg-[#181a1b]"
    >
      <a href="#/">
        <img src={logo} alt="Lyra" class="h-10 w-10 scale-175" />
      </a>
      {#if searchOpen}
        <SearchNav
          bind:query={searchQuery}
          bind:committedQuery={committedSearchQuery}
          onclose={closeSearch}
        />
      {:else if route.page !== "libraries"}
        <nav
          class="order-last -mb-2 flex w-full gap-6 overflow-x-auto sm:mb-0 sm:justify-center xl:pointer-events-none xl:absolute xl:inset-x-0 xl:order-none xl:w-auto"
        >
          <div
            class="pointer-events-auto flex w-full sm:w-auto sm:shrink-0 sm:gap-6"
          >
            {#each navItems as item (item.label)}
              <a
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                class="flex-auto border-b-2 py-2.5 text-center text-sm font-semibold transition-colors sm:flex-none sm:border-0 sm:py-0 sm:text-xl {item.active
                  ? 'border-[#BB7FB5] text-slate-900 dark:text-neutral-100'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300'}"
                >{item.label}</a
              >
            {/each}
          </div>
        </nav>
      {/if}
      <div class="ml-auto flex items-center gap-0.5 sm:gap-2">
        <button
          type="button"
          aria-label="Search your music"
          title={searchOpen ? "Close search" : "Search your music"}
          aria-expanded={searchOpen}
          aria-controls={searchOpen ? "search-results" : undefined}
          class="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:h-8 sm:w-8 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
          onclick={() => (searchOpen ? closeSearch() : openSearch())}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path stroke-linecap="round" d="m16 16 4.5 4.5" />
          </svg>
        </button>
        {#if headerMix}
          <MixButton
            variant="icon"
            label={headerMix.label}
            title={headerMix.title}
            load={headerMix.load}
            startTrack={headerMix.startTrack}
            cover={headerMix.cover}
          />
          <HeaderMixMenu config={headerMix} />
        {/if}
        <div class="hidden sm:block">
          {@render themeToggle()}
        </div>
        <button
          type="button"
          aria-label={devices.controlled
            ? `Open devices (playing on ${devices.deviceName(devices.controlled)})`
            : "Open devices"}
          title={devices.controlled
            ? `Playing on ${devices.deviceName(devices.controlled)}`
            : "Devices"}
          class="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:h-8 sm:w-8 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
          onclick={() => devices.openPanel()}
        >
          <DeviceIcon kind="devices" class="h-5 w-5" />
          {#if devices.controlled}
            <span
              class="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-[#BB7FB5] ring-2 ring-slate-50 dark:ring-[#181a1b]"
            ></span>
          {:else if !devices.online}
            <span
              class="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-slate-50 dark:ring-[#181a1b]"
            ></span>
          {/if}
        </button>
        <button
          type="button"
          aria-label={pluginUpdates.awaitingApproval > 0
            ? `Open settings (${pluginUpdates.awaitingApproval} plugin update${pluginUpdates.awaitingApproval === 1 ? "" : "s"} waiting for approval)`
            : "Open settings"}
          title="Settings"
          class="relative hidden h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:flex dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
          onclick={() => (settingsOpen = true)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
            />
          </svg>
          {#if pluginUpdates.awaitingApproval > 0}
            <span
              class="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#E6CEE3] px-1 text-[9px] font-semibold text-slate-900 dark:bg-[#BB7FB5] dark:text-white"
              >{pluginUpdates.awaitingApproval}</span
            >
          {/if}
        </button>
        <button
          class="hidden text-sm text-slate-500 hover:text-slate-700 sm:block dark:text-neutral-400 dark:hover:text-neutral-200"
          disabled={loggingOut}
          onclick={logOut}
        >
          Log out
        </button>
        <button
          type="button"
          aria-label={pluginUpdates.awaitingApproval > 0
            ? `More options (${pluginUpdates.awaitingApproval} plugin update${pluginUpdates.awaitingApproval === 1 ? "" : "s"} waiting for approval)`
            : "More options"}
          title="More"
          aria-haspopup="menu"
          aria-expanded={moreAnchor != null}
          class="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:hidden dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
          onclick={(e) =>
            (moreAnchor = moreAnchor ? null : anchorBelow(e.currentTarget))}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="12" cy="5" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="12" cy="19" r="1.75" />
          </svg>
          {#if pluginUpdates.awaitingApproval > 0}
            <span
              class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#BB7FB5] ring-2 ring-slate-50 dark:ring-[#181a1b]"
            ></span>
          {/if}
        </button>
        {#if moreAnchor}
          <ContextMenu anchor={moreAnchor} onclose={() => (moreAnchor = null)}>
            <MenuItem onclick={() => theme.cycle()}
              >Theme: {theme.mode}</MenuItem
            >
            <MenuItem
              onclick={() => {
                moreAnchor = null;
                settingsOpen = true;
              }}
            >
              Settings
              {#if pluginUpdates.awaitingApproval > 0}
                <span
                  class="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E6CEE3] px-1 text-[10px] font-semibold text-slate-900 dark:bg-[#BB7FB5] dark:text-white"
                  >{pluginUpdates.awaitingApproval}</span
                >
              {/if}
            </MenuItem>
            <MenuItem
              onclick={() => {
                moreAnchor = null;
                logOut();
              }}>Log out</MenuItem
            >
          </ContextMenu>
        {/if}
      </div>
    </header>
    <section class="mx-auto max-w-7xl px-4 py-6 pb-20 sm:px-6">
      {#key catalogRevision()}
        {#if route.page === "search"}
          <div id="search-results">
            {#if !searchQuery.trim()}
              <p
                role="status"
                class="py-12 text-center text-slate-500 dark:text-neutral-400"
              >
                Search for albums, artists, and tracks.
              </p>
            {:else if !committedSearchQuery}
              <p
                role="status"
                class="py-12 text-center text-slate-500 dark:text-neutral-400"
              >
                Searching…
              </p>
            {:else}
              <SearchResults query={committedSearchQuery} />
            {/if}
          </div>
        {:else if route.page === "library"}
          {#key route.id}
            <LibraryAlbums libraryId={route.id} />
          {/key}
        {:else if route.page === "library_artists"}
          {#key route.id}
            <LibraryArtists libraryId={route.id} />
          {/key}
        {:else if route.page === "library_tracks"}
          {#key route.id}
            <LibraryTracks libraryId={route.id} />
          {/key}
        {:else if route.page === "library_genres"}
          {#key route.id}
            <LibraryGenres libraryId={route.id} />
          {/key}
        {:else if route.page === "track"}
          {#key route.id}
            <TrackPage trackId={route.id} />
          {/key}
        {:else if route.page === "album"}
          {#key route.id}
            <AlbumPage albumId={route.id} />
          {/key}
        {:else if route.page === "artist"}
          {#key route.id}
            <ArtistPage artistId={route.id} />
          {/key}
        {:else if route.page === "genre"}
          {#key route.id}
            <GenrePage genreId={route.id} libraryId={currentLibraryId} />
          {/key}
        {:else if route.page === "playlists"}
          <PlaylistList />
        {:else if route.page === "playlist"}
          {#key route.id}
            <PlaylistPage playlistId={route.id} />
          {/key}
        {:else if route.page === "now_playing"}
          <NowPlayingPage />
        {:else}
          <LibraryList />
        {/if}
      {/key}
    </section>
    {#if route.page !== "now_playing"}
      <Player />
    {/if}
    {#if settingsOpen}
      <SettingsPanel onclose={() => (settingsOpen = false)} />
    {/if}
    {#if devices.panelOpen}
      <DevicesPanel onclose={() => devices.closePanel()} />
    {/if}
  </main>
{/if}
