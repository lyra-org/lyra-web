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

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  session = null;
  me = null;
  window.location.hash = "#/login";
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
