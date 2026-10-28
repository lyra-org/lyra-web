// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { MeResponse, Permission, Session } from "./types";

const TOKEN_KEY = "token";

let session = $state<Session | null>(restore());
let me = $state<MeResponse | null>(null);

function restore(): Session | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return { token };
}

function login(s: Session) {
  localStorage.setItem(TOKEN_KEY, s.token);
  me = null;
  session = s;
}

// Clears the local session. The reload drops per-user state kept outside
// components (player, favorites, tags) so none of it carries over to the next
// account. Without a session there is nothing to clear, which also keeps a
// failed sign-in from reloading the login page.
function logout() {
  if (session === null) return;
  localStorage.removeItem(TOKEN_KEY);
  session = null;
  me = null;
  history.replaceState(history.state, "", "#/login");
  window.location.reload();
}

function setMe(m: MeResponse | null) {
  me = m;
}

function hasPermission(permission: Permission): boolean {
  const permissions = me?.permissions ?? [];
  return permissions.includes("admin") || permissions.includes(permission);
}

export function getAuth() {
  return {
    get session() {
      return session;
    },
    get isLoggedIn() {
      return session !== null;
    },
    get token() {
      return session?.token ?? null;
    },
    get me() {
      return me;
    },
    login,
    logout,
    setMe,
    hasPermission,
  };
}
