// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import type { Session } from "./types";

const TOKEN_KEY = "token";

let session = $state<Session | null>(restore());

function restore(): Session | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return { token };
}

function login(s: Session) {
  localStorage.setItem(TOKEN_KEY, s.token);
  session = s;
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  session = null;
  window.location.hash = "#/login";
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
    login,
    logout,
  };
}
